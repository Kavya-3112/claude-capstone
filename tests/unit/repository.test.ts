import { describe, it, expect } from 'vitest';
import { BACKUP_KEY, STORAGE_KEY } from '../../src/config';
import { ContactRepository } from '../../src/storage/repository';
import { serializeEnvelope, type Contact } from '../../src/storage/schema';
import { FakeAdapter, quota, security, unavailable } from './fakeAdapter';

const c = (id: string, seq: number): Contact => ({
  id,
  name: 'N' + id,
  phone: '555-123-4567',
  createdSeq: seq,
  createdAt: '',
});
const valid = (...cs: Contact[]) => serializeEnvelope(cs, cs.length + 5);
// 3 valid + 2 invalid (duplicate id, duplicate createdSeq)
const mixed = JSON.stringify({
  version: 1,
  nextSeq: 10,
  contacts: [c('a', 0), c('b', 1), c('a', 2), c('x', 1), c('d', 3)],
});
const corrupt = '{not json';

describe('ContactRepository.load (T-08)', () => {
  it('empty when the key is absent', () => {
    expect(new ContactRepository(new FakeAdapter()).load()).toEqual({ kind: 'empty' });
  });
  it('ok for valid data', () => {
    const repo = new ContactRepository(new FakeAdapter({ [STORAGE_KEY]: valid(c('a', 0)) }));
    const r = repo.load();
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.contacts.map((x) => x.id)).toEqual(['a']);
  });
  it('unreadable for malformed JSON; original untouched and no writes', () => {
    const fake = new FakeAdapter({ [STORAGE_KEY]: corrupt });
    const r = new ContactRepository(fake).load();
    expect(r).toMatchObject({ kind: 'unreadable', raw: corrupt, salvaged: [] });
    expect(fake.data.get(STORAGE_KEY)).toBe(corrupt);
    expect(fake.writes).toEqual([]);
  });
  it('unreadable with salvage and invalid count for the 3 valid + 2 invalid case', () => {
    const fake = new FakeAdapter({ [STORAGE_KEY]: mixed });
    const r = new ContactRepository(fake).load();
    expect(r).toMatchObject({ kind: 'unreadable', invalidCount: 2 });
    if (r.kind === 'unreadable') expect(r.salvaged).toHaveLength(3);
    expect(fake.data.get(STORAGE_KEY)).toBe(mixed);
    expect(fake.writes).toEqual([]);
  });
  it('unavailable when get fails (security and unknown causes)', () => {
    const fake = new FakeAdapter();
    fake.failOn('get', security);
    expect(new ContactRepository(fake).load()).toEqual({ kind: 'unavailable', cause: 'security' });
  });
  it('a stale nextSeq is recomputed on load and the value is not rewritten', () => {
    const raw = JSON.stringify({ version: 1, nextSeq: 0, contacts: [c('a', 4)] });
    const fake = new FakeAdapter({ [STORAGE_KEY]: raw });
    expect(new ContactRepository(fake).load()).toMatchObject({ kind: 'ok', nextSeq: 5, nextSeqRecomputed: true });
    expect(fake.writes).toEqual([]);
  });
});

describe('ContactRepository.save (T-08)', () => {
  it('writes and round-trips', () => {
    const fake = new FakeAdapter();
    const repo = new ContactRepository(fake);
    repo.load();
    expect(repo.save([c('a', 0)], 1)).toEqual({ kind: 'ok' });
    const again = new ContactRepository(fake).load();
    expect(again).toMatchObject({ kind: 'ok', nextSeq: 1 });
  });
  it('quota and security write failures are reported as writeFailed, never thrown', () => {
    const fake = new FakeAdapter();
    const repo = new ContactRepository(fake);
    repo.load();
    fake.failOn('set', quota);
    expect(repo.save([c('a', 0)], 1)).toMatchObject({ kind: 'writeFailed', cause: 'quota' });
    fake.clearFailures();
    fake.failOn('set', security);
    expect(repo.save([c('a', 0)], 1)).toMatchObject({ kind: 'writeFailed', cause: 'security' });
    expect(fake.data.has(STORAGE_KEY)).toBe(false);
  });
  it('a failed write leaves the previous value and a retry succeeds', () => {
    const before = valid(c('a', 0));
    const fake = new FakeAdapter({ [STORAGE_KEY]: before });
    const repo = new ContactRepository(fake);
    repo.load();
    fake.failOn('set', quota);
    expect(repo.save([c('a', 0), c('b', 1)], 2).kind).toBe('writeFailed');
    expect(fake.data.get(STORAGE_KEY)).toBe(before);
    fake.clearFailures();
    expect(repo.save([c('a', 0), c('b', 1)], 2)).toEqual({ kind: 'ok' });
  });
  it('a read failure before writing is reported as writeFailed', () => {
    const fake = new FakeAdapter();
    const repo = new ContactRepository(fake);
    repo.load();
    fake.failOn('get', security);
    expect(repo.save([], 0)).toMatchObject({ kind: 'writeFailed', cause: 'security' });
  });
  it('never writes the contacts key while unreadable', () => {
    const fake = new FakeAdapter({ [STORAGE_KEY]: corrupt });
    const repo = new ContactRepository(fake);
    repo.load();
    expect(repo.save([c('a', 0)], 1)).toEqual({ kind: 'blocked' });
    expect(fake.writes).toEqual([]);
    expect(fake.data.get(STORAGE_KEY)).toBe(corrupt);
  });
});

describe('staleness check (T-09; FR-57, decision 5)', () => {
  it('refuses a write when the raw value changed since load, and does not overwrite', () => {
    const fake = new FakeAdapter({ [STORAGE_KEY]: valid(c('a', 0)) });
    const repo = new ContactRepository(fake);
    repo.load();
    const other = valid(c('a', 0), c('tabA', 1));
    fake.data.set(STORAGE_KEY, other); // another tab wrote
    expect(repo.save([c('a', 0), c('mine', 1)], 2)).toEqual({ kind: 'stale' });
    expect(fake.data.get(STORAGE_KEY)).toBe(other);
    expect(fake.writes).toEqual([]);
  });
  it('accepts a write when unchanged, and again after its own write', () => {
    const fake = new FakeAdapter({ [STORAGE_KEY]: valid(c('a', 0)) });
    const repo = new ContactRepository(fake);
    repo.load();
    expect(repo.save([c('a', 0), c('b', 1)], 2).kind).toBe('ok');
    expect(repo.save([c('a', 0), c('b', 1), c('c', 2)], 3).kind).toBe('ok');
  });
  it('refuses a write when the key was removed by someone else', () => {
    const fake = new FakeAdapter({ [STORAGE_KEY]: valid(c('a', 0)) });
    const repo = new ContactRepository(fake);
    repo.load();
    fake.data.delete(STORAGE_KEY);
    expect(repo.save([c('a', 0)], 1)).toEqual({ kind: 'stale' });
  });
  it('a failed write does not move the baseline', () => {
    const fake = new FakeAdapter();
    const repo = new ContactRepository(fake);
    repo.load();
    fake.failOn('set', quota);
    repo.save([c('a', 0)], 1);
    fake.clearFailures();
    expect(repo.save([c('a', 0)], 1).kind).toBe('ok');
  });
  it('unavailable at load, then available and still empty: warning first, then the write succeeds', () => {
    const fake = new FakeAdapter();
    fake.failOn('get', unavailable);
    const repo = new ContactRepository(fake);
    expect(repo.load().kind).toBe('unavailable');
    expect(repo.needsUnavailableWarning).toBe(true);
    fake.clearFailures();
    expect(repo.save([c('a', 0)], 1)).toEqual({ kind: 'warningRequired' });
    expect(fake.writes).toEqual([]);
    repo.acknowledgeUnavailableWarning();
    expect(repo.save([c('a', 0)], 1)).toEqual({ kind: 'ok' });
  });
  it('unavailable at load, then a value appears: write refused as stale (baseline is absent)', () => {
    const fake = new FakeAdapter();
    fake.failOn('get', unavailable);
    const repo = new ContactRepository(fake);
    repo.load();
    fake.clearFailures();
    const existing = valid(c('old', 0));
    fake.data.set(STORAGE_KEY, existing);
    repo.acknowledgeUnavailableWarning();
    expect(repo.save([c('a', 0)], 1)).toEqual({ kind: 'stale' });
    expect(fake.data.get(STORAGE_KEY)).toBe(existing);
  });
  it('a successful reload clears the unavailable warning', () => {
    const fake = new FakeAdapter();
    fake.failOn('get', unavailable);
    const repo = new ContactRepository(fake);
    repo.load();
    fake.clearFailures();
    expect(repo.load()).toEqual({ kind: 'empty' });
    expect(repo.needsUnavailableWarning).toBe(false);
  });
});

describe('backup-then-replace (T-10; FR-43, FR-44, FR-51, decision 4)', () => {
  const setup = (initial: Record<string, string> = { [STORAGE_KEY]: mixed }) => {
    const fake = new FakeAdapter(initial);
    const repo = new ContactRepository(fake);
    repo.load();
    return { fake, repo };
  };

  it('happy path: backup written, new envelope written, backup removed only after confirmation', () => {
    const { fake, repo } = setup();
    const r = repo.replaceUnreadable({ userHasOwnCopy: false });
    expect(r).toMatchObject({ kind: 'replaced', backupKept: true });
    expect(fake.data.get(BACKUP_KEY)).toBe(mixed);
    expect(new ContactRepository(fake).load()).toMatchObject({ kind: 'ok' });
    expect(fake.data.has(BACKUP_KEY)).toBe(true); // not removed until confirmation
    expect(repo.confirmReplacement()).toEqual({ kind: 'ok' });
    expect(fake.data.has(BACKUP_KEY)).toBe(false);
    expect(repo.save([c('a', 0)], 1).kind).toBe('ok'); // usable again
  });
  it('the original is untouched until replaceUnreadable is called', () => {
    const { fake } = setup();
    expect(fake.data.get(STORAGE_KEY)).toBe(mixed);
    expect(fake.writes).toEqual([]);
  });
  it('backup write failure aborts: contacts key untouched', () => {
    const { fake, repo } = setup();
    fake.failOn('set', quota, BACKUP_KEY);
    expect(repo.replaceUnreadable({ userHasOwnCopy: false })).toMatchObject({ kind: 'backupFailed', cause: 'quota' });
    expect(fake.data.get(STORAGE_KEY)).toBe(mixed);
    expect(fake.writesTo(STORAGE_KEY)).toEqual([]);
  });
  it('backup write failure proceeds only when the user confirmed their own copy (architecture step 3)', () => {
    const { fake, repo } = setup();
    fake.failOn('set', quota, BACKUP_KEY);
    const r = repo.replaceUnreadable({ userHasOwnCopy: true });
    expect(r).toMatchObject({ kind: 'replaced', backupKept: false });
    expect(fake.data.has(BACKUP_KEY)).toBe(false);
    expect(repo.confirmReplacement()).toEqual({ kind: 'ok' }); // nothing to remove
  });
  it('contacts write failure leaves the original and keeps the backup', () => {
    const { fake, repo } = setup();
    fake.failOn('set', quota, STORAGE_KEY);
    const r = repo.replaceUnreadable({ userHasOwnCopy: false });
    expect(r).toMatchObject({ kind: 'writeFailed', cause: 'quota', backupKept: true });
    expect(fake.data.get(STORAGE_KEY)).toBe(mixed);
    expect(fake.data.get(BACKUP_KEY)).toBe(mixed);
    expect(repo.save([c('a', 0)], 1)).toEqual({ kind: 'blocked' }); // still in recovery
  });
  it('backup removal failure is non-fatal and retryable', () => {
    const { fake, repo } = setup();
    repo.replaceUnreadable({ userHasOwnCopy: false });
    fake.failOn('remove', security, BACKUP_KEY);
    expect(repo.confirmReplacement()).toMatchObject({ kind: 'failed', cause: 'security' });
    expect(repo.save([c('a', 0)], 1).kind).toBe('ok'); // app keeps working
    fake.clearFailures();
    expect(repo.confirmReplacement()).toEqual({ kind: 'ok' });
    expect(fake.data.has(BACKUP_KEY)).toBe(false);
  });
  it('leftover backup plus new corruption: replacement refused, leftover not overwritten (decision 4)', () => {
    const leftover = 'older raw original';
    const { fake, repo } = setup({ [STORAGE_KEY]: corrupt, [BACKUP_KEY]: leftover });
    expect(repo.checkLeftoverBackup()).toEqual({ kind: 'present', raw: leftover });
    expect(repo.replaceUnreadable({ userHasOwnCopy: true })).toEqual({ kind: 'leftoverBackupPending' });
    expect(fake.data.get(BACKUP_KEY)).toBe(leftover);
    expect(fake.data.get(STORAGE_KEY)).toBe(corrupt);
    expect(fake.writes).toEqual([]);
  });
  it('after the user discards the leftover, replacement proceeds', () => {
    const { fake, repo } = setup({ [STORAGE_KEY]: corrupt, [BACKUP_KEY]: 'old' });
    expect(repo.discardBackup()).toEqual({ kind: 'ok' });
    expect(repo.replaceUnreadable({ userHasOwnCopy: false })).toMatchObject({ kind: 'replaced' });
    expect(fake.data.get(BACKUP_KEY)).toBe(corrupt);
  });
  it('restoring a leftover writes it back, then removes it; removal failure is reported', () => {
    const good = valid(c('a', 0));
    const { fake, repo } = setup({ [STORAGE_KEY]: valid(), [BACKUP_KEY]: good });
    expect(repo.restoreLeftoverBackup()).toEqual({ kind: 'restored', backupRemoved: true });
    expect(fake.data.get(STORAGE_KEY)).toBe(good);
    expect(fake.data.has(BACKUP_KEY)).toBe(false);
    const f2 = setup({ [STORAGE_KEY]: valid(), [BACKUP_KEY]: good });
    f2.fake.failOn('remove', security, BACKUP_KEY);
    expect(f2.repo.restoreLeftoverBackup()).toEqual({ kind: 'restored', backupRemoved: false });
  });
  it('restore with no backup, or failing writes, is reported without throwing', () => {
    const none = setup({ [STORAGE_KEY]: valid() });
    expect(none.repo.restoreLeftoverBackup()).toEqual({ kind: 'noBackup' });
    const failing = setup({ [STORAGE_KEY]: valid(), [BACKUP_KEY]: 'x' });
    failing.fake.failOn('set', quota, STORAGE_KEY);
    expect(failing.repo.restoreLeftoverBackup()).toMatchObject({ kind: 'failed', cause: 'quota' });
    expect(failing.fake.data.get(BACKUP_KEY)).toBe('x');
  });
  it('replacement is refused when the raw value changed since load', () => {
    const { fake, repo } = setup();
    fake.data.set(STORAGE_KEY, valid(c('z', 0)));
    expect(repo.replaceUnreadable({ userHasOwnCopy: false })).toEqual({ kind: 'stale' });
    expect(fake.writes).toEqual([]);
  });
  it('replacement outside recovery is refused', () => {
    const { repo } = setup({ [STORAGE_KEY]: valid(c('a', 0)) });
    expect(repo.replaceUnreadable({ userHasOwnCopy: false })).toEqual({ kind: 'notInRecovery' });
  });
  it('malformed value replaced by an empty list when nothing is salvageable', () => {
    const { fake, repo } = setup({ [STORAGE_KEY]: corrupt });
    expect(repo.replaceUnreadable({ userHasOwnCopy: false })).toMatchObject({ kind: 'replaced', contacts: [], nextSeq: 0 });
    expect(new ContactRepository(fake).load()).toMatchObject({ kind: 'ok', contacts: [] });
  });
});

import { describe, it, expect } from 'vitest';
import { BACKUP_KEY, STORAGE_KEY } from '../../src/config';
import { Store } from '../../src/state/store';
import { ContactRepository } from '../../src/storage/repository';
import { parseStored, serializeEnvelope, type Contact } from '../../src/storage/schema';
import { FakeAdapter, quota, security } from './fakeAdapter';

/** Tests for code-review.md fixes: CR-01, CR-02, CR-03, CR-06, CR-08, CR-11 and decision 11. */

const c = (id: string, seq: number, name = 'N' + id): Contact => ({
  id,
  name,
  phone: '555-123-4567',
  createdSeq: seq,
  createdAt: '',
});
const valid = (...cs: Contact[]) => serializeEnvelope(cs, cs.length + 5);
const mixed = JSON.stringify({
  version: 1,
  nextSeq: 10,
  contacts: [c('a', 0), c('b', 1), c('a', 2), c('x', 1), c('d', 3)],
});

function makeStore(initial: Record<string, string> = {}, onErr?: (e: unknown) => void) {
  const fake = new FakeAdapter(initial);
  const store = new Store(new ContactRepository(fake), onErr);
  store.init();
  return { fake, store };
}

describe('CR-01 retry after a failed Replace', () => {
  it('repository: retry reuses its own backup', () => {
    const fake = new FakeAdapter({ [STORAGE_KEY]: mixed });
    const repo = new ContactRepository(fake);
    repo.load();
    fake.failOn('set', quota, STORAGE_KEY);
    expect(repo.replaceUnreadable({ userHasOwnCopy: false })).toMatchObject({ kind: 'writeFailed', backupKept: true });
    fake.clearFailures();
    expect(repo.replaceUnreadable({ userHasOwnCopy: false })).toMatchObject({ kind: 'replaced', backupKept: true });
    expect(fake.data.get(BACKUP_KEY)).toBe(mixed);
    expect(repo.confirmReplacement()).toEqual({ kind: 'ok' });
    expect(fake.data.has(BACKUP_KEY)).toBe(false);
  });
  it('repository: a different backup is still a leftover after an own failed attempt', () => {
    const fake = new FakeAdapter({ [STORAGE_KEY]: mixed });
    const repo = new ContactRepository(fake);
    repo.load();
    fake.failOn('set', quota, STORAGE_KEY);
    repo.replaceUnreadable({ userHasOwnCopy: false });
    fake.clearFailures();
    fake.data.set(BACKUP_KEY, 'someone else');
    expect(repo.replaceUnreadable({ userHasOwnCopy: false })).toEqual({ kind: 'leftoverBackupPending' });
    expect(fake.data.get(BACKUP_KEY)).toBe('someone else');
  });
  it('store: retry works and shows no false leftover', () => {
    const { store, fake } = makeStore({ [STORAGE_KEY]: mixed });
    fake.failOn('set', quota, STORAGE_KEY);
    expect(store.replaceUnreadable({ userHasOwnCopy: false })).toMatchObject({ kind: 'writeFailed', backupKept: true });
    fake.clearFailures();
    expect(store.replaceUnreadable({ userHasOwnCopy: false })).toMatchObject({ kind: 'replaced', backupKept: true });
    expect(store.getState()).toMatchObject({ saveStatus: 'saved', leftoverBackup: null });
    expect(store.confirmReplacement()).toEqual({ kind: 'ok' });
    expect(fake.data.has(BACKUP_KEY)).toBe(false);
  });
  it('store: a real leftover found by Replace is put into state so the UI can prompt', () => {
    const { store, fake } = makeStore({ [STORAGE_KEY]: '{bad' });
    fake.data.set(BACKUP_KEY, 'older');
    expect(store.replaceUnreadable({ userHasOwnCopy: true })).toEqual({ kind: 'leftoverBackupPending' });
    expect(store.getState().leftoverBackup).toBe('older');
  });
});

describe('CR-02 restore must not clobber changed data (decision 10)', () => {
  it('repository: needs confirmation when the value changed since load', () => {
    const good = valid(c('g', 0));
    const fake = new FakeAdapter({ [STORAGE_KEY]: valid(), [BACKUP_KEY]: good });
    const repo = new ContactRepository(fake);
    repo.load();
    const newer = valid(c('n', 0), c('m', 1));
    fake.data.set(STORAGE_KEY, newer);
    expect(repo.restoreLeftoverBackup()).toEqual({ kind: 'needsConfirmation', current: newer });
    expect(fake.data.get(STORAGE_KEY)).toBe(newer);
    expect(fake.data.get(BACKUP_KEY)).toBe(good);
    expect(fake.writes).toEqual([]);
    expect(repo.restoreLeftoverBackup({ confirmOverwrite: true })).toMatchObject({ kind: 'restored' });
    expect(fake.data.get(STORAGE_KEY)).toBe(good);
  });
  it('repository: never loaded counts as unknown, so an existing value needs confirmation; absent does not', () => {
    const good = valid(c('g', 0));
    const withValue = new FakeAdapter({ [STORAGE_KEY]: valid(c('x', 0)), [BACKUP_KEY]: good });
    expect(new ContactRepository(withValue).restoreLeftoverBackup()).toMatchObject({ kind: 'needsConfirmation' });
    const empty = new FakeAdapter({ [BACKUP_KEY]: good });
    expect(new ContactRepository(empty).restoreLeftoverBackup()).toMatchObject({ kind: 'restored' });
  });
  it('repository: unchanged since load still restores without confirmation (decision 6)', () => {
    const good = valid(c('g', 0));
    const fake = new FakeAdapter({ [STORAGE_KEY]: valid(), [BACKUP_KEY]: good });
    const repo = new ContactRepository(fake);
    repo.load();
    expect(repo.restoreLeftoverBackup()).toMatchObject({ kind: 'restored' });
  });
  it('store: needsConfirmation passes through; confirmed restore proceeds', () => {
    const good = valid(c('g', 0));
    const { store, fake } = makeStore({ [STORAGE_KEY]: valid(), [BACKUP_KEY]: good });
    const newer = valid(c('n', 0, 'Newer'));
    fake.data.set(STORAGE_KEY, newer);
    expect(store.restoreLeftoverBackup()).toEqual({ kind: 'needsConfirmation', current: newer });
    expect(fake.data.get(STORAGE_KEY)).toBe(newer);
    expect(store.restoreLeftoverBackup({ confirmOverwrite: true })).toMatchObject({ kind: 'restored' });
    expect(fake.data.get(STORAGE_KEY)).toBe(good);
  });
});

describe('CR-03 throwing subscribers', () => {
  it('a throwing listener does not stop persistence or misreport status', () => {
    const errors: unknown[] = [];
    const { store, fake } = makeStore({}, (e) => errors.push(e));
    store.subscribe(() => {
      throw new Error('render bug');
    });
    const seen: string[] = [];
    store.subscribe((st) => seen.push(st.saveStatus));
    expect(store.addContact({ name: 'A', phone: '5551234567' })).toMatchObject({ ok: true, saved: true });
    expect(JSON.parse(fake.data.get(STORAGE_KEY)!).contacts).toHaveLength(1);
    expect(store.getState().saveStatus).toBe('saved');
    expect(errors.length).toBeGreaterThan(0);
    expect(seen.length).toBeGreaterThan(0);
  });
  it('a failed save with a throwing listener is still reported as unsaved', () => {
    const { store, fake } = makeStore();
    store.subscribe(() => {
      throw new Error('render bug');
    });
    fake.failOn('set', quota);
    expect(store.addContact({ name: 'A', phone: '5551234567' })).toMatchObject({ ok: true, saved: false });
    expect(store.getState().saveStatus).toBe('unsaved');
  });
  it('edit and delete also persist when a listener throws', () => {
    const { store, fake } = makeStore();
    const r = store.addContact({ name: 'A', phone: '5551234567' });
    if (!r.ok || !('contact' in r)) throw new Error('add failed');
    store.subscribe(() => {
      throw new Error('render bug');
    });
    store.editContact(r.contact.id, { name: 'A2', phone: '5551234567' });
    expect(fake.data.get(STORAGE_KEY)).toContain('A2');
    store.deleteContact(r.contact.id);
    expect(JSON.parse(fake.data.get(STORAGE_KEY)!).contacts).toHaveLength(0);
  });
  it('a throwing error reporter does not break the store', () => {
    const { store } = makeStore({}, () => {
      throw new Error('reporter bug');
    });
    store.subscribe(() => {
      throw new Error('x');
    });
    expect(() => store.setQuery('q')).not.toThrow();
  });
});

describe('decision 11 edits blocked while stale', () => {
  it('add, edit, delete and startEdit are blocked until reload; search still works', () => {
    const { store, fake } = makeStore();
    const r = store.addContact({ name: 'Alice', phone: '5551234567' });
    if (!r.ok || !('contact' in r)) throw new Error('add failed');
    const id = r.contact.id;
    store.markStale();
    const before = fake.writes.length;
    expect(store.addContact({ name: 'Z', phone: '5551234567' })).toEqual({ ok: false, blocked: 'stale' });
    expect(store.editContact(id, { name: 'Z', phone: '5551234567' })).toEqual({ ok: false, blocked: 'stale' });
    expect(store.deleteContact(id)).toEqual({ ok: false, blocked: 'stale' });
    expect(store.startEdit(id)).toBe(false);
    expect(fake.writes.length).toBe(before);
    store.setQuery('ali');
    expect(store.visibleContacts()).toHaveLength(1);
    store.reload();
    expect(store.addContact({ name: 'Z', phone: '5551234567' })).toMatchObject({ ok: true });
  });
  it('stale detected by a refused save also blocks later edits', () => {
    const { store, fake } = makeStore();
    fake.data.set(STORAGE_KEY, valid(c('z', 0)));
    store.addContact({ name: 'A', phone: '5551234567' });
    expect(store.getState()).toMatchObject({ stale: true, saveStatus: 'unsaved' });
    expect(store.addContact({ name: 'B', phone: '5551234567' })).toEqual({ ok: false, blocked: 'stale' });
  });
});

describe('CR-06 unsafe integers, CR-08 save before load, CR-11 init with unreadable backup key', () => {
  it('unsafe createdSeq values are invalid', () => {
    for (const seq of [1e300, 2 ** 53, Number.MAX_SAFE_INTEGER]) {
      const raw = JSON.stringify({ version: 1, nextSeq: 1, contacts: [{ ...c('a', 0), createdSeq: seq }] });
      expect(parseStored(raw)).toMatchObject({ kind: 'unreadable', invalidCount: 1 });
    }
  });
  it('the largest allowed createdSeq leaves room for nextSeq; a huge nextSeq is recomputed', () => {
    const top = Number.MAX_SAFE_INTEGER - 1;
    const ok = JSON.stringify({
      version: 1,
      nextSeq: Number.MAX_SAFE_INTEGER,
      contacts: [{ ...c('a', 0), createdSeq: top }],
    });
    expect(parseStored(ok)).toMatchObject({ kind: 'ok', nextSeq: Number.MAX_SAFE_INTEGER });
    const huge = JSON.stringify({ version: 1, nextSeq: 1e300, contacts: [c('a', 0)] });
    expect(parseStored(huge)).toMatchObject({ kind: 'ok', nextSeq: 1, nextSeqRecomputed: true });
  });
  it('save before any load is blocked and writes nothing', () => {
    const fake = new FakeAdapter();
    const repo = new ContactRepository(fake);
    expect(repo.save([c('a', 0)], 1)).toEqual({ kind: 'blocked' });
    expect(fake.writes).toEqual([]);
  });
  it('init treats an unreadable backup key as no leftover and still loads contacts', () => {
    const fake = new FakeAdapter({ [STORAGE_KEY]: valid(c('a', 0)) });
    fake.failOn('get', security, BACKUP_KEY);
    const store = new Store(new ContactRepository(fake));
    expect(() => store.init()).not.toThrow();
    expect(store.getState()).toMatchObject({ leftoverBackup: null, saveStatus: 'saved' });
    expect(store.getState().contacts).toHaveLength(1);
  });
});

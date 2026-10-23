import { describe, it, expect } from 'vitest';
import { BACKUP_KEY, STORAGE_KEY } from '../../src/config';
import { Store } from '../../src/state/store';
import { ContactRepository } from '../../src/storage/repository';
import { serializeEnvelope, type Contact } from '../../src/storage/schema';
import { bannerModel } from '../../src/ui/bannerModel';
import { invalidSummary, replaceAsk } from '../../src/ui/messages';
import { recoveryView, recoveryViewKey } from '../../src/ui/recoveryModel';
import { FakeAdapter } from './fakeAdapter';

const c = (id: string, seq: number): Contact => ({ id, name: 'N' + id, phone: '555-123-4567', createdSeq: seq, createdAt: '' });
const mixed = JSON.stringify({ version: 1, nextSeq: 10, contacts: [c('a', 0), c('b', 1), c('a', 2), c('x', 1), c('d', 3)] });

function make(initial: Record<string, string> = {}) {
  const fake = new FakeAdapter(initial);
  const repo = new ContactRepository(fake);
  const store = new Store(repo);
  store.init();
  return { fake, repo, store };
}

describe('recoveryView (T-20)', () => {
  it('none for healthy data', () => {
    const { store } = make({ [STORAGE_KEY]: serializeEnvelope([c('a', 0)], 1) });
    expect(recoveryView(store.getState())).toBeNull();
  });
  it('unreadable view reports invalid count and the preview size (3 valid + 2 invalid)', () => {
    const { store } = make({ [STORAGE_KEY]: mixed });
    const v = recoveryView(store.getState());
    expect(v).toMatchObject({ kind: 'unreadable', invalidCount: 2, shown: 3, raw: mixed });
  });
  it('malformed JSON gives an unreadable view with nothing shown', () => {
    const { store } = make({ [STORAGE_KEY]: '{bad' });
    expect(recoveryView(store.getState())).toMatchObject({ kind: 'unreadable', invalidCount: 0, shown: 0 });
  });
  it('a leftover backup is handled first, even when the data is also unreadable (decision 4)', () => {
    const { store } = make({ [STORAGE_KEY]: '{bad', [BACKUP_KEY]: 'old' });
    expect(recoveryView(store.getState())).toMatchObject({ kind: 'leftover', backupRaw: 'old' });
  });
  it('after a successful replacement the confirm-result view applies until confirmed', () => {
    const { store, fake } = make({ [STORAGE_KEY]: mixed });
    store.replaceUnreadable({ userHasOwnCopy: false });
    expect(recoveryView(store.getState())).toMatchObject({ kind: 'confirm-result', shown: 3 });
    store.confirmReplacement();
    expect(recoveryView(store.getState())).toBeNull();
    expect(fake.data.has(BACKUP_KEY)).toBe(false);
  });
  it('replacement without a stored backup has no confirm-result view', () => {
    const { store, fake } = make({ [STORAGE_KEY]: mixed });
    fake.failOn('set', { ok: false, cause: 'quota', message: 'q' }, BACKUP_KEY);
    expect(store.replaceUnreadable({ userHasOwnCopy: true })).toMatchObject({ kind: 'replaced', backupKept: false });
    expect(recoveryView(store.getState())).toBeNull();
  });
  it('view keys change only when the view changes', () => {
    const a = make({ [STORAGE_KEY]: mixed }).store.getState();
    expect(recoveryViewKey(recoveryView(a))).toBe(recoveryViewKey(recoveryView({ ...a, query: 'x' })));
    expect(recoveryViewKey(null)).toBe('none');
  });
});

describe('recovery wording helpers', () => {
  it('invalid summary uses counts and handles singular and unreadable cases', () => {
    expect(invalidSummary(2, 3)).toBe('2 saved records are invalid and not shown. 3 readable contacts are shown below as a read-only preview.');
    expect(invalidSummary(1, 1)).toContain('1 saved record is invalid');
    expect(invalidSummary(1, 1)).toContain('1 readable contact is shown');
    expect(invalidSummary(0, 0)).toBe('The saved data could not be read, so no contacts are shown.');
  });
  it('replace question states the count and the backup', () => {
    expect(replaceAsk(3)).toContain('3 readable contacts');
    expect(replaceAsk(3)).toContain('temporary backup');
  });
});

describe('multi-tab detection (T-21)', () => {
  it('repository.checkStale reports fresh, stale and unknown', () => {
    const fake = new FakeAdapter({ [STORAGE_KEY]: serializeEnvelope([c('a', 0)], 1) });
    const repo = new ContactRepository(fake);
    expect(repo.checkStale()).toBe('unknown'); // not loaded
    repo.load();
    expect(repo.checkStale()).toBe('fresh');
    fake.data.set(STORAGE_KEY, serializeEnvelope([c('z', 0)], 1));
    expect(repo.checkStale()).toBe('stale');
    fake.failOn('get', { ok: false, cause: 'security', message: 's' });
    expect(repo.checkStale()).toBe('unknown');
  });
  it('own writes do not look stale', () => {
    const { store, fake } = make();
    store.addContact({ name: 'A', phone: '5551234567' });
    expect(store.checkStale()).toBe(false);
    expect(fake.writes.length).toBeGreaterThan(0);
  });
  it('store.checkStale flags another tab change without writing, and reload clears it', () => {
    const { store, fake } = make();
    store.addContact({ name: 'A', phone: '5551234567' });
    const writes = fake.writes.length;
    fake.data.set(STORAGE_KEY, serializeEnvelope([c('tabA', 0)], 1));
    expect(store.checkStale()).toBe(true);
    expect(store.getState().stale).toBe(true);
    expect(fake.writes.length).toBe(writes);
    store.reload();
    expect(store.getState().stale).toBe(false);
    expect(store.checkStale()).toBe(false);
  });
  it('stale banner offers Reload and no Retry; text depends on whether changes are unsaved', () => {
    const { store, fake } = make();
    store.markStale();
    const clean = bannerModel(store.getState())!;
    expect(clean).toMatchObject({ kind: 'stale', retryLabel: null, reloadLabel: 'Reload contacts' });
    expect(clean.message).not.toMatch(/^Not saved/);
    store.reload();
    fake.data.set(STORAGE_KEY, serializeEnvelope([c('z', 0)], 1));
    store.addContact({ name: 'B', phone: '5551234567' }); // refused as stale, change stays visible
    const unsaved = bannerModel(store.getState())!;
    expect(unsaved.kind).toBe('stale');
    expect(unsaved.message).toMatch(/^Not saved/);
    expect(unsaved.key).not.toBe(clean.key);
  });
});

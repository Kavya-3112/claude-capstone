import { describe, it, expect } from 'vitest';
import { BACKUP_KEY, STORAGE_KEY } from '../../src/config';
import { Store } from '../../src/state/store';
import { ContactRepository } from '../../src/storage/repository';
import { serializeEnvelope, type Contact } from '../../src/storage/schema';
import { FakeAdapter, quota, unavailable } from './fakeAdapter';

const c = (id: string, seq: number, name = 'N' + id, phone = '555-123-4567'): Contact => ({
  id,
  name,
  phone,
  createdSeq: seq,
  createdAt: '',
});
const mixed = JSON.stringify({
  version: 1,
  nextSeq: 10,
  contacts: [c('a', 0), c('b', 1), c('a', 2), c('x', 1), c('d', 3)],
});

function make(initial: Record<string, string> = {}) {
  const fake = new FakeAdapter(initial);
  const store = new Store(new ContactRepository(fake));
  store.init();
  return { fake, store };
}
const add = (s: Store, name: string, phone = '5551234567') => {
  const r = s.addContact({ name, phone });
  if (!r.ok || !('contact' in r)) throw new Error('add failed');
  return r;
};

describe('Store basics (T-11)', () => {
  it('starts empty and saved', () => {
    const { store } = make();
    expect(store.getState()).toMatchObject({ contacts: [], saveStatus: 'saved', memoryOnly: false });
  });
  it('adds, orders newest first and persists', () => {
    const { store, fake } = make();
    add(store, 'A');
    add(store, 'B');
    expect(store.visibleContacts().map((x) => x.name)).toEqual(['B', 'A']);
    expect(store.getState().saveStatus).toBe('saved');
    expect(fake.data.get(STORAGE_KEY)).toContain('"B"');
  });
  it('invalid add returns errors and changes nothing', () => {
    const { store, fake } = make();
    const r = store.addContact({ name: ' ', phone: 'abc' });
    expect(r).toMatchObject({ ok: false });
    expect('errors' in r && r.errors.name && r.errors.phone).toBeTruthy();
    expect(store.getState().contacts).toHaveLength(0);
    expect(fake.writes).toEqual([]);
  });
  it('edit applies same validators, keeps position, invalid edit leaves contact unchanged', () => {
    const { store } = make();
    const a = add(store, 'A').contact;
    add(store, 'B');
    expect(store.editContact(a.id, { name: '', phone: '5551234567' })).toMatchObject({ ok: false });
    expect(store.getState().contacts.find((x) => x.id === a.id)?.name).toBe('A');
    expect(store.editContact(a.id, { name: 'A2', phone: '7654321' })).toMatchObject({ ok: true, saved: true });
    expect(store.visibleContacts().map((x) => x.name)).toEqual(['B', 'A2']);
  });
  it('edit and delete address only the selected contact among identical phones', () => {
    const { store } = make();
    const a = add(store, 'A').contact;
    const b = add(store, 'B').contact;
    store.editContact(b.id, { name: 'B2', phone: b.phone });
    expect(store.getState().contacts.find((x) => x.id === a.id)?.name).toBe('A');
    store.deleteContact(a.id);
    expect(store.getState().contacts.map((x) => x.name)).toEqual(['B2']);
  });
  it('unknown ids are reported', () => {
    const { store } = make();
    expect(store.editContact('nope', { name: 'x', phone: '5551234567' })).toEqual({ ok: false, notFound: true });
    expect(store.deleteContact('nope')).toEqual({ ok: false, notFound: true });
    expect(store.startEdit('nope')).toBe(false);
  });
  it('delete then add never reuses a sequence position', () => {
    const { store } = make();
    add(store, 'A');
    const b = add(store, 'B').contact;
    store.deleteContact(b.id);
    const d = add(store, 'D').contact;
    expect(d.createdSeq).toBe(2);
  });
  it('edit target: start, cancel, cleared by delete', () => {
    const { store } = make();
    const a = add(store, 'A').contact;
    expect(store.startEdit(a.id)).toBe(true);
    expect(store.getState().editingId).toBe(a.id);
    store.cancelEdit();
    expect(store.getState().editingId).toBeNull();
    store.startEdit(a.id);
    store.deleteContact(a.id);
    expect(store.getState().editingId).toBeNull();
  });
  it('notifies subscribers and supports unsubscribe', () => {
    const { store } = make();
    let n = 0;
    const off = store.subscribe(() => n++);
    store.setQuery('x');
    off();
    store.setQuery('y');
    expect(n).toBe(1);
  });
});

describe('Search state (FR-55, decision 7)', () => {
  it('query is not cleared on add, filters results, and reports hiddenBySearch', () => {
    const { store } = make();
    add(store, 'Alice');
    store.setQuery('ali');
    const r = add(store, 'Bob');
    expect(r.hiddenBySearch).toBe(true);
    expect(store.getState().query).toBe('ali');
    expect(store.visibleContacts().map((x) => x.name)).toEqual(['Alice']);
    expect(add(store, 'Alina').hiddenBySearch).toBe(false);
  });
  it('edit and delete work on contacts reached through search', () => {
    const { store } = make();
    const a = add(store, 'Alice').contact;
    add(store, 'Bob');
    store.setQuery('ali');
    expect(store.editContact(a.id, { name: 'Alicia', phone: a.phone }).ok).toBe(true);
    expect(store.deleteContact(a.id).ok).toBe(true);
  });
  it('the query is never persisted: a fresh store starts with an empty query', () => {
    const { store, fake } = make();
    add(store, 'Alice');
    store.setQuery('ali');
    expect(fake.data.get(STORAGE_KEY)).not.toContain('ali"');
    const fresh = new Store(new ContactRepository(fake));
    fresh.init();
    expect(fresh.getState().query).toBe('');
    expect(fresh.visibleContacts()).toHaveLength(1);
  });
});

describe('Save failures (FR-45, FR-46, FR-53)', () => {
  it('a failed save keeps the change visible and shows unsaved without success', () => {
    const { store, fake } = make();
    fake.failOn('set', quota);
    const r = add(store, 'A');
    expect(r.saved).toBe(false);
    expect(store.getState()).toMatchObject({ saveStatus: 'unsaved', lastSaveFailure: { kind: 'writeFailed' } });
    expect(store.visibleContacts()).toHaveLength(1);
  });
  it('failures on edit and delete also set unsaved', () => {
    const { store, fake } = make();
    const a = add(store, 'A').contact;
    fake.failOn('set', quota);
    expect(store.editContact(a.id, { name: 'A2', phone: a.phone })).toMatchObject({ ok: true, saved: false });
    expect(store.getState().saveStatus).toBe('unsaved');
    expect(store.deleteContact(a.id)).toMatchObject({ ok: true, saved: false });
    expect(store.getState().saveStatus).toBe('unsaved');
  });
  it('unsaved persists across further failing actions, and a later success clears it and saves everything', () => {
    const { store, fake } = make();
    fake.failOn('set', quota);
    add(store, 'A');
    add(store, 'B');
    expect(store.getState().saveStatus).toBe('unsaved');
    fake.clearFailures();
    expect(store.retrySave()).toBe(true);
    expect(store.getState()).toMatchObject({ saveStatus: 'saved', lastSaveFailure: null });
    const fresh = new Store(new ContactRepository(fake));
    fresh.init();
    expect(fresh.getState().contacts).toHaveLength(2);
  });
  it('a later successful action also clears unsaved (persists whole collection)', () => {
    const { store, fake } = make();
    fake.failOn('set', quota);
    add(store, 'A');
    fake.clearFailures();
    add(store, 'B');
    expect(store.getState().saveStatus).toBe('saved');
    expect(JSON.parse(fake.data.get(STORAGE_KEY)!).contacts).toHaveLength(2);
  });
  it('retry while still failing stays unsaved', () => {
    const { store, fake } = make();
    fake.failOn('set', quota);
    add(store, 'A');
    expect(store.retrySave()).toBe(false);
    expect(store.getState().saveStatus).toBe('unsaved');
  });
  it('retry with nothing to save is a no-op success', () => {
    const { store, fake } = make();
    expect(store.retrySave()).toBe(true);
    expect(fake.writes).toEqual([]);
  });
});

describe('Recovery blocks mutations (Q-22)', () => {
  it('shows salvaged preview, blocks add/edit/delete/startEdit, allows search, writes nothing', () => {
    const { store, fake } = make({ [STORAGE_KEY]: mixed });
    const s = store.getState();
    expect(s.saveStatus).toBe('recovery-needed');
    expect(s.recovery).toMatchObject({ invalidCount: 2, raw: mixed });
    expect(s.contacts).toHaveLength(3);
    expect(store.addContact({ name: 'Z', phone: '5551234567' })).toEqual({ ok: false, blocked: 'recovery' });
    expect(store.editContact('a', { name: 'Z', phone: '5551234567' })).toEqual({ ok: false, blocked: 'recovery' });
    expect(store.deleteContact('a')).toEqual({ ok: false, blocked: 'recovery' });
    expect(store.startEdit('a')).toBe(false);
    store.setQuery('Nb');
    expect(store.visibleContacts().map((x) => x.id)).toEqual(['b']);
    expect(store.retrySave()).toBe(false);
    expect(fake.writes).toEqual([]);
    expect(fake.data.get(STORAGE_KEY)).toBe(mixed);
  });
  it('replacing unlocks the store and keeps the backup until confirmation', () => {
    const { store, fake } = make({ [STORAGE_KEY]: mixed });
    expect(store.replaceUnreadable({ userHasOwnCopy: false })).toMatchObject({ kind: 'replaced' });
    expect(store.getState()).toMatchObject({
      saveStatus: 'saved',
      recovery: null,
      replacementAwaitingConfirmation: true,
    });
    expect(fake.data.get(BACKUP_KEY)).toBe(mixed);
    expect(store.confirmReplacement()).toEqual({ kind: 'ok' });
    expect(fake.data.has(BACKUP_KEY)).toBe(false);
    expect(store.getState().replacementAwaitingConfirmation).toBe(false);
    expect(add(store, 'New').saved).toBe(true);
  });
  it('failed replacement leaves the store in recovery', () => {
    const { store, fake } = make({ [STORAGE_KEY]: mixed });
    fake.failOn('set', quota, STORAGE_KEY);
    expect(store.replaceUnreadable({ userHasOwnCopy: false })).toMatchObject({ kind: 'writeFailed' });
    expect(store.getState().saveStatus).toBe('recovery-needed');
  });
});

describe('Leftover backup first (decision 4) and restore (decision 6)', () => {
  const good = serializeEnvelope([c('g', 0)], 1);
  it('blocks mutations and replacement until the leftover is discarded', () => {
    const { store, fake } = make({ [STORAGE_KEY]: serializeEnvelope([], 0), [BACKUP_KEY]: 'old' });
    expect(store.getState().leftoverBackup).toBe('old');
    expect(store.addContact({ name: 'A', phone: '5551234567' })).toEqual({ ok: false, blocked: 'leftover-backup' });
    expect(fake.data.get(BACKUP_KEY)).toBe('old');
    expect(store.discardLeftoverBackup()).toEqual({ kind: 'ok' });
    expect(store.getState().leftoverBackup).toBeNull();
    expect(store.addContact({ name: 'A', phone: '5551234567' })).toMatchObject({ ok: true });
  });
  it('with new corruption, replacement is refused until the leftover is handled', () => {
    const { store, fake } = make({ [STORAGE_KEY]: '{bad', [BACKUP_KEY]: 'old' });
    expect(store.getState().saveStatus).toBe('recovery-needed');
    expect(store.replaceUnreadable({ userHasOwnCopy: true })).toEqual({ kind: 'leftoverBackupPending' });
    expect(fake.data.get(BACKUP_KEY)).toBe('old');
  });
  it('restore writes the backup back, removes it and reloads', () => {
    const { store, fake } = make({ [STORAGE_KEY]: serializeEnvelope([], 0), [BACKUP_KEY]: good });
    expect(store.restoreLeftoverBackup()).toEqual({ kind: 'restored', backupRemoved: true });
    expect(store.getState()).toMatchObject({ leftoverBackup: null, saveStatus: 'saved' });
    expect(store.getState().contacts.map((x) => x.id)).toEqual(['g']);
    expect(fake.data.has(BACKUP_KEY)).toBe(false);
  });
  it('restore with a failing removal keeps the leftover prompt available', () => {
    const { store, fake } = make({ [STORAGE_KEY]: serializeEnvelope([], 0), [BACKUP_KEY]: good });
    fake.failOn('remove', quota, BACKUP_KEY);
    expect(store.restoreLeftoverBackup()).toEqual({ kind: 'restored', backupRemoved: false });
    expect(store.getState().leftoverBackup).toBe(good);
  });
});

describe('Memory-only mode and warning (Q-21, decision 5)', () => {
  it('flags memory-only when storage is unavailable at load', () => {
    const fake = new FakeAdapter();
    fake.failOn('get', unavailable);
    const store = new Store(new ContactRepository(fake));
    store.init();
    expect(store.getState()).toMatchObject({ memoryOnly: true, warningRequired: true });
  });
  it('changes stay in memory and are unsaved until the warning is acknowledged, then retry saves', () => {
    const fake = new FakeAdapter();
    fake.failOn('get', unavailable);
    const store = new Store(new ContactRepository(fake));
    store.init();
    fake.failOn('set', unavailable);
    store.addContact({ name: 'A', phone: '5551234567' });
    expect(store.getState()).toMatchObject({ saveStatus: 'unsaved', memoryOnly: true });
    fake.clearFailures(); // storage came back
    expect(store.retrySave()).toBe(false);
    expect(store.getState().lastSaveFailure).toEqual({ kind: 'warningRequired' });
    store.acknowledgeUnavailableWarning();
    expect(store.retrySave()).toBe(true);
    expect(store.getState()).toMatchObject({ saveStatus: 'saved', memoryOnly: false, warningRequired: false });
    expect(fake.data.has(STORAGE_KEY)).toBe(true);
  });
  it('if data appeared meanwhile, retry is refused as stale and nothing is overwritten', () => {
    const fake = new FakeAdapter();
    fake.failOn('get', unavailable);
    const store = new Store(new ContactRepository(fake));
    store.init();
    store.addContact({ name: 'A', phone: '5551234567' });
    fake.clearFailures();
    const existing = serializeEnvelope([c('old', 0)], 1);
    fake.data.set(STORAGE_KEY, existing);
    store.acknowledgeUnavailableWarning();
    expect(store.retrySave()).toBe(false);
    expect(store.getState()).toMatchObject({ stale: true, saveStatus: 'unsaved' });
    expect(fake.data.get(STORAGE_KEY)).toBe(existing);
  });
});

describe('Stale tab (FR-57)', () => {
  it('a save is refused when another tab changed the data; change stays visible; reload discards it', () => {
    const { store, fake } = make();
    add(store, 'A');
    const other = serializeEnvelope([c('tabA', 0, 'FromTabA')], 1);
    fake.data.set(STORAGE_KEY, other);
    const r = add(store, 'Mine'); // detected by the pre-write check
    expect(r.saved).toBe(false);
    expect(store.getState()).toMatchObject({ stale: true, saveStatus: 'unsaved' });
    expect(fake.data.get(STORAGE_KEY)).toBe(other);
    expect(store.getState().contacts.map((x) => x.name)).toContain('Mine');
    store.reload();
    expect(store.getState()).toMatchObject({ stale: false, saveStatus: 'saved' });
    expect(store.getState().contacts.map((x) => x.name)).toEqual(['FromTabA']);
  });
  it('a stale refusal is detected even without a storage event', () => {
    const { store, fake } = make();
    fake.data.set(STORAGE_KEY, serializeEnvelope([c('z', 0)], 1));
    add(store, 'A');
    expect(store.getState()).toMatchObject({ stale: true, saveStatus: 'unsaved' });
  });
});

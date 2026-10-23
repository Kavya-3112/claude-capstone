import { describe, it, expect } from 'vitest';
import { STORAGE_KEY } from '../../src/config';
import { Store, type AppState } from '../../src/state/store';
import { ContactRepository } from '../../src/storage/repository';
import { bannerModel } from '../../src/ui/bannerModel';
import { FakeAdapter, quota, security, unavailable } from './fakeAdapter';

function fresh(setup: (f: FakeAdapter) => void = () => {}) {
  const fake = new FakeAdapter();
  setup(fake);
  const store = new Store(new ContactRepository(fake));
  store.init();
  return { fake, store };
}
const model = (s: Store) => bannerModel(s.getState());
const add = (s: Store) => s.addContact({ name: 'A', phone: '5551234567' });

describe('bannerModel (T-19)', () => {
  it('no banner when saved', () => {
    const { store } = fresh();
    expect(model(store)).toBeNull();
    add(store);
    expect(model(store)).toBeNull();
  });
  it('unsaved banner after a failed save, with Retry, no success text, mentioning earlier changes and reload', () => {
    const { store, fake } = fresh();
    fake.failOn('set', quota);
    add(store);
    const m = model(store)!;
    expect(m.kind).toBe('unsaved');
    expect(m.retryLabel).toBe('Retry saving');
    expect(m.message).toMatch(/earlier unsaved/);
    expect(m.message).toMatch(/reload/i);
    expect(m.message).toMatch(/storage is full/i);
    expect(m.message).not.toMatch(/saved\.?$/i);
  });
  it('cause text differs for security errors and is absent for unknown causes', () => {
    const a = fresh();
    a.fake.failOn('set', security);
    add(a.store);
    expect(model(a.store)!.message).toMatch(/blocked access/);
    const b = fresh();
    b.fake.failOn('set', { ok: false, cause: 'unknown', message: 'x' });
    add(b.store);
    expect(model(b.store)!.message).not.toMatch(/full|blocked access/);
  });
  it('banner persists across further failing actions and clears after a successful save', () => {
    const { store, fake } = fresh();
    fake.failOn('set', quota);
    add(store);
    add(store);
    expect(model(store)!.kind).toBe('unsaved');
    expect(store.retrySave()).toBe(false);
    expect(model(store)!.kind).toBe('unsaved');
    fake.clearFailures();
    expect(store.retrySave()).toBe(true);
    expect(model(store)).toBeNull();
  });
  it('failures on edit and delete also give the unsaved banner', () => {
    const { store, fake } = fresh();
    const r = add(store);
    if (!r.ok || !('contact' in r)) throw new Error('add failed');
    fake.failOn('set', quota);
    store.editContact(r.contact.id, { name: 'B', phone: '5551234567' });
    expect(model(store)!.kind).toBe('unsaved');
    fake.clearFailures();
    store.retrySave();
    fake.failOn('set', quota);
    store.deleteContact(r.contact.id);
    expect(model(store)!.kind).toBe('unsaved');
  });
  it('memory-only banner is keyed off memoryOnly and offers a storage re-test', () => {
    const { store } = fresh((f) => f.failOn('get', unavailable));
    const m = model(store)!;
    expect(m.kind).toBe('memory-only');
    expect(m.retryLabel).toBe('Test storage again');
    expect(m.message).toMatch(/lost when you close or reload/);
  });
  it('memory-only banner stays after a change and clears only after a successful write', () => {
    const { store, fake } = fresh((f) => f.failOn('get', unavailable));
    fake.failOn('set', unavailable);
    add(store);
    expect(model(store)!.kind).toBe('memory-only');
    fake.clearFailures();
    store.acknowledgeUnavailableWarning();
    expect(store.retrySave()).toBe(true);
    expect(model(store)).toBeNull();
    expect(fake.data.has(STORAGE_KEY)).toBe(true);
  });
  it('stale takes priority and has no Retry (decision 11)', () => {
    const { store } = fresh();
    store.markStale();
    const m = model(store)!;
    expect(m.kind).toBe('stale');
    expect(m.retryLabel).toBeNull();
  });
  it('no banner during recovery or leftover backup (T-20 owns those)', () => {
    const rec = fresh((f) => f.data.set(STORAGE_KEY, '{bad'));
    expect(model(rec.store)).toBeNull();
    const left = fresh((f) => f.data.set('contacts.v1.backup', 'old'));
    expect(model(left.store)).toBeNull();
  });
  it('keys change only when the banner content changes', () => {
    const { store, fake } = fresh();
    fake.failOn('set', quota);
    add(store);
    const k1 = model(store)!.key;
    add(store);
    expect(model(store)!.key).toBe(k1);
    fake.clearFailures();
    fake.failOn('set', security);
    add(store);
    expect(model(store)!.key).not.toBe(k1);
  });
  it('accepts a bare AppState (pure function)', () => {
    const s = fresh().store.getState() as AppState;
    expect(bannerModel({ ...s, saveStatus: 'unsaved' })!.kind).toBe('unsaved');
  });
});

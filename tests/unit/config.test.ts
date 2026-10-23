import { describe, it, expect } from 'vitest';
import { BACKUP_KEY, STORAGE_KEY } from '../../src/config';
import type { Contact, StoredEnvelope } from '../../src/storage/schema';

describe('config and types (T-01)', () => {
  it('defines storage keys in one place', () => {
    expect(STORAGE_KEY).toBe('contacts.v1');
    expect(BACKUP_KEY).toBe('contacts.v1.backup');
  });
  it('types compile (checked by tsc)', () => {
    const c: Contact = { id: 'a', name: 'A', phone: '5551234567', createdSeq: 0, createdAt: '' };
    const e: StoredEnvelope = { version: 1, nextSeq: 1, contacts: [c] };
    expect(e.contacts).toHaveLength(1);
  });
});

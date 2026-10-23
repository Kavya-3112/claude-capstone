import { describe, it, expect } from 'vitest';
import { generateId } from '../../src/domain/id';
import { createContact, sortForDisplay, updateContact } from '../../src/domain/ordering';
import type { Contact } from '../../src/storage/schema';

const now = new Date('2026-01-01T00:00:00Z');

function addAll(names: string[]) {
  let contacts: Contact[] = [];
  let seq = 0;
  for (const n of names) {
    const r = createContact({ name: n, phone: '5551234567' }, contacts, seq, now);
    contacts = [...contacts, r.contact];
    seq = r.nextSeq;
  }
  return { contacts, seq };
}

describe('ordering (T-04)', () => {
  it('same-instant adds are ordered deterministically, newest first', () => {
    const { contacts } = addAll(['A', 'B', 'C']);
    expect(sortForDisplay(contacts).map((c) => c.name)).toEqual(['C', 'B', 'A']);
  });
  it('editing the oldest does not move it', () => {
    const { contacts } = addAll(['A', 'B', 'C']);
    const edited = updateContact(contacts, contacts[0]!.id, { name: 'A2', phone: '7654321' });
    expect(sortForDisplay(edited).map((c) => c.name)).toEqual(['C', 'B', 'A2']);
    expect(edited[0]!.createdSeq).toBe(contacts[0]!.createdSeq);
    expect(edited[0]!.id).toBe(contacts[0]!.id);
  });
  it('delete newest then add never reuses a position', () => {
    const { contacts, seq } = addAll(['A', 'B', 'C']);
    const withoutC = contacts.filter((c) => c.name !== 'C');
    const r = createContact({ name: 'D', phone: '5551234567' }, withoutC, seq, now);
    expect(r.contact.createdSeq).toBe(3);
    expect(r.nextSeq).toBe(4);
    expect(sortForDisplay([...withoutC, r.contact]).map((c) => c.name)).toEqual(['D', 'B', 'A']);
  });
  it('ids are unique and independent of phone (same phone, different ids)', () => {
    const { contacts } = addAll(['A', 'B', 'C']);
    expect(new Set(contacts.map((c) => c.id)).size).toBe(3);
    expect(contacts.every((c) => c.phone === '5551234567')).toBe(true);
  });
  it('edit only touches the selected contact among identical phones', () => {
    const { contacts } = addAll(['A', 'B']);
    const edited = updateContact(contacts, contacts[1]!.id, { name: 'B2', phone: '5551234567' });
    expect(edited[0]).toEqual(contacts[0]);
    expect(edited[1]!.name).toBe('B2');
  });
  it('sortForDisplay does not mutate input', () => {
    const { contacts } = addAll(['A', 'B']);
    const copy = [...contacts];
    sortForDisplay(contacts);
    expect(contacts).toEqual(copy);
  });
});

describe('generateId (DR-13)', () => {
  it('uses native randomUUID by default', () => {
    expect(generateId(new Set())).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('fallback generator produces UUID v4 shaped ids', () => {
    const id = generateId(new Set(), { randomUUID: null });
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('fallback retries when it collides with an existing id', () => {
    const first = generateId(new Set(), { randomUUID: null, random: () => 0 });
    const values = [...Array(31).fill(0), 0.5]; // first attempt repeats `first`, then differs
    let i = 0;
    const random = () => (i < values.length ? values[i++]! : 0.5);
    const id = generateId(new Set([first]), { randomUUID: null, random });
    expect(id).not.toBe(first);
  });
  it('native collisions are retried', () => {
    const ids = ['x', 'x', 'y'];
    expect(generateId(new Set(['x']), { randomUUID: () => ids.shift()! })).toBe('y');
  });
  it('throws if a unique id can never be found', () => {
    expect(() => generateId(new Set(['same']), { randomUUID: () => 'same' })).toThrow();
  });
});

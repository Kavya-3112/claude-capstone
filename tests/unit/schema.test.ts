import { describe, it, expect } from 'vitest';
import { parseStored, serializeEnvelope, type Contact } from '../../src/storage/schema';

const rec = (id: string, seq: number, over: Record<string, unknown> = {}) => ({
  id,
  name: 'N' + id,
  phone: '555-123-4567',
  createdSeq: seq,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});
const env = (contacts: unknown[], nextSeq: unknown = 10, version: unknown = 1) =>
  JSON.stringify({ version, nextSeq, contacts });

describe('parseStored (T-07)', () => {
  it('accepts a valid envelope and round-trips serializeEnvelope', () => {
    const raw = serializeEnvelope([rec('a', 0), rec('b', 1)] as Contact[], 2);
    const r = parseStored(raw);
    expect(r).toMatchObject({ kind: 'ok', nextSeq: 2, nextSeqRecomputed: false });
    if (r.kind === 'ok') expect(r.contacts).toHaveLength(2);
  });
  it('accepts an empty list', () => {
    expect(parseStored(env([], 0))).toMatchObject({ kind: 'ok', contacts: [], nextSeq: 0 });
  });
  it('malformed JSON is unreadable', () => {
    expect(parseStored('{nope')).toMatchObject({ kind: 'unreadable', salvaged: [] });
  });
  it('wrong shapes are unreadable', () => {
    const shapes = ['null', '[]', '"x"', '5', env([], 1, 2), JSON.stringify({ version: 1, contacts: 'x' })];
    for (const raw of shapes) {
      expect(parseStored(raw)).toMatchObject({ kind: 'unreadable', salvaged: [] });
    }
  });
  it('3 valid + 2 invalid (duplicate id, duplicate createdSeq) gives 3 contacts and count 2', () => {
    const r = parseStored(
      env([
        rec('a', 0),
        rec('b', 1),
        rec('a', 2), // duplicate id: later one is invalid
        rec('c', 1), // duplicate createdSeq: later one is invalid
        rec('d', 3),
      ]),
    );
    expect(r.kind).toBe('unreadable');
    if (r.kind === 'unreadable') {
      expect(r.salvaged.map((c) => c.id)).toEqual(['a', 'b', 'd']);
      expect(r.invalidCount).toBe(2);
      expect(r.nextSeq).toBe(10);
    }
  });
  it('mixed invalid records of every kind are counted and not used', () => {
    const r = parseStored(
      env([
        rec('ok', 0),
        'str',
        null,
        [],
        rec('', 1),
        rec('x', 2, { name: '   ' }),
        rec('y', 3, { phone: 'abc' }),
        rec('z', -1),
        rec('w', 1.5),
        rec('v', 4, { id: 7 }),
      ]),
    );
    expect(r).toMatchObject({ kind: 'unreadable', invalidCount: 9 });
    if (r.kind === 'unreadable') expect(r.salvaged.map((c) => c.id)).toEqual(['ok']);
  });
  it('a record invalid for another reason does not claim its id or seq', () => {
    const r = parseStored(env([rec('a', 0, { name: '' }), rec('a', 0)]));
    if (r.kind !== 'unreadable') throw new Error('expected unreadable');
    expect(r.salvaged.map((c) => c.id)).toEqual(['a']);
    expect(r.invalidCount).toBe(1);
  });
  it('name 100 valid, 101 invalid; phone 20 valid, 21 invalid', () => {
    expect(parseStored(env([rec('a', 0, { name: 'n'.repeat(100) })])).kind).toBe('ok');
    expect(parseStored(env([rec('a', 0, { name: 'n'.repeat(101) })]))).toMatchObject({ invalidCount: 1 });
    expect(parseStored(env([rec('a', 0, { phone: '+1 (234) 567-890 123' })])).kind).toBe('ok');
    expect(parseStored(env([rec('a', 0, { phone: '1 2 3 4 5 6 7 8 9 0 1' })]))).toMatchObject({
      invalidCount: 1,
    });
  });
  it('untrimmed stored name or phone is invalid (nothing silently rewritten)', () => {
    expect(parseStored(env([rec('a', 0, { name: ' A ' })]))).toMatchObject({ invalidCount: 1 });
    expect(parseStored(env([rec('a', 0, { phone: ' 5551234567' })]))).toMatchObject({ invalidCount: 1 });
  });
  it('stale, missing or non-integer nextSeq with all-valid records is recomputed without recovery', () => {
    for (const next of [1, 0, undefined, 'x', 2.5, -3]) {
      const raw = JSON.stringify({ version: 1, nextSeq: next, contacts: [rec('a', 0), rec('b', 5)] });
      expect(parseStored(raw)).toMatchObject({ kind: 'ok', nextSeq: 6, nextSeqRecomputed: true });
    }
    expect(parseStored(JSON.stringify({ version: 1, contacts: [] }))).toMatchObject({ kind: 'ok', nextSeq: 0, nextSeqRecomputed: true });
  });
  it('a missing createdAt is invalid, not silently rewritten', () => {
    expect(parseStored(env([rec('a', 0, { createdAt: undefined })]))).toMatchObject({ invalidCount: 1 });
  });
});

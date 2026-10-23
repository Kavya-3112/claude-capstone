import { describe, it, expect } from 'vitest';
import { filter } from '../../src/domain/search';
import type { Contact } from '../../src/storage/schema';

const mk = (id: string, name: string, phone: string, seq: number): Contact => ({
  id,
  name,
  phone,
  createdSeq: seq,
  createdAt: '',
});
const alice = mk('1', 'Alice', '+1 555-123-4567', 0);
const bob = mk('2', 'Bob', '999-888-7777', 1);
const all = [alice, bob];

describe('filter (T-05)', () => {
  it('name search is case-insensitive substring', () => {
    expect(filter(all, 'ali')).toEqual([alice]);
    expect(filter(all, 'ALI')).toEqual([alice]);
    expect(filter(all, 'ice')).toEqual([alice]);
  });
  it('phone search ignores formatting and leading +', () => {
    expect(filter(all, '555123')).toEqual([alice]);
    expect(filter(all, '(555) 123')).toEqual([alice]);
    expect(filter(all, '+555')).toEqual([alice]);
    expect(filter(all, '555-123-4567')).toEqual([alice]);
    expect(filter(all, '4567')).toEqual([alice]);
  });
  it('digit-less query matches no phones (decision 2)', () => {
    expect(filter(all, '-')).toEqual([]);
    expect(filter(all, '()')).toEqual([]);
    expect(filter(all, '+')).toEqual([]);
    const dashed = mk('3', 'Dash-man', '555-123-4567', 2);
    expect(filter([dashed], '-')).toEqual([dashed]); // matches via name only
  });
  it('query mixing digits and letters does not match phones', () => {
    expect(filter(all, '555abc')).toEqual([]);
  });
  it('empty or whitespace query returns all', () => {
    expect(filter(all, '')).toEqual(all);
    expect(filter(all, '   ')).toEqual(all);
  });
  it('no match returns empty array', () => {
    expect(filter(all, 'zzz')).toEqual([]);
  });
  it('non-ASCII names', () => {
    const c = mk('4', 'Élodie Ünal', '1234567', 3);
    expect(filter([c], 'éLO')).toEqual([c]);
    expect(filter([c], 'ÜNAL')).toEqual([c]);
  });
  it('identical-phone contacts are each returned (FR-38)', () => {
    const a = mk('5', 'A', '555-123-4567', 4);
    const b = mk('6', 'B', '555-123-4567', 5);
    expect(filter([a, b], '5551234567')).toEqual([a, b]);
  });
  it('returns a copy for an empty query', () => {
    expect(filter(all, '')).not.toBe(all);
  });
});

import { describe, it, expect } from 'vitest';
import { validateContactInput, validateName } from '../../src/domain/name';

describe('validateName (T-03)', () => {
  it('trims', () => {
    expect(validateName('  Ann  ')).toEqual({ ok: true, value: 'Ann' });
  });
  it('rejects empty and whitespace-only', () => {
    expect(validateName('   ')).toMatchObject({ ok: false });
    expect(validateName('')).toMatchObject({ ok: false });
  });
  it('accepts markup-like text', () => {
    expect(validateName('<b>x</b>')).toEqual({ ok: true, value: '<b>x</b>' });
  });
  it('100 accepted, 101 rejected, never truncated', () => {
    expect(validateName('a'.repeat(100)).ok).toBe(true);
    expect(validateName('a'.repeat(101))).toMatchObject({ ok: false });
  });
  it('limits count code points (decision 1)', () => {
    expect(validateName('\u{1F600}'.repeat(100)).ok).toBe(true);
    expect(validateName('\u{1F600}'.repeat(101)).ok).toBe(false);
  });
  it('length is measured after trimming', () => {
    expect(validateName(' ' + 'a'.repeat(100) + ' ').ok).toBe(true);
  });
});

describe('validateContactInput (FR-49, shared by add and edit)', () => {
  it('returns per-field errors', () => {
    const r = validateContactInput({ name: ' ', phone: '12' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.name).toBeTruthy();
      expect(r.errors.phone).toBeTruthy();
    }
  });
  it('returns trimmed values', () => {
    expect(validateContactInput({ name: ' Ann ', phone: ' 555-123-4567 ' })).toEqual({
      ok: true,
      value: { name: 'Ann', phone: '555-123-4567' },
    });
  });
  it('only the failing field has an error', () => {
    const r = validateContactInput({ name: 'Ann', phone: 'abc' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.name).toBeUndefined();
      expect(r.errors.phone).toBeTruthy();
    }
  });
});

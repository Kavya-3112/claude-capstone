import { describe, it, expect } from 'vitest';
import { normalizePhone, validatePhone } from '../../src/domain/phone';

const ok = (s: string) => validatePhone(s).ok;

describe('validatePhone (T-02)', () => {
  it('digit boundaries 6/7/15/16', () => {
    expect(ok('123456')).toBe(false);
    expect(ok('1234567')).toBe(true);
    expect(ok('123456789012345')).toBe(true);
    expect(ok('1234567890123456')).toBe(false);
  });
  it('accepts permitted formatting', () => {
    expect(ok('+1 (555) 123-4567')).toBe(true);
    expect(ok('555-123-4567')).toBe(true);
    expect(ok('+1234567')).toBe(true);
  });
  it('rejects letters and extensions', () => {
    expect(ok('555-CALL-NOW')).toBe(false);
    expect(ok('5551234567 ext 12')).toBe(false);
    expect(ok('5551234567x12')).toBe(false);
  });
  it('rejects empty and whitespace-only', () => {
    expect(validatePhone('')).toMatchObject({ ok: false });
    expect(validatePhone('   ')).toMatchObject({ ok: false });
  });
  it('trims and returns the trimmed entered text', () => {
    expect(validatePhone('  555-123-4567  ')).toEqual({ ok: true, value: '555-123-4567' });
  });
  it('20 characters accepted, 21 rejected with a length message (never truncated)', () => {
    const valid20 = '+1 (234) 567-890 123';
    expect(valid20.length).toBe(20);
    expect(validatePhone(valid20)).toEqual({ ok: true, value: valid20 });
    const twenty1 = '1 2 3 4 5 6 7 8 9 0 1';
    expect(twenty1.length).toBe(21);
    const r = validatePhone(twenty1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/at most 20/);
  });
  it('length is measured after trimming', () => {
    expect(ok(' +1 (234) 567-890 123 ')).toBe(true);
  });
  it('rejects + anywhere except the start (decision 3)', () => {
    expect(ok('555+1234567')).toBe(false);
    expect(ok('+1+234567')).toBe(false);
    expect(ok('1234567+')).toBe(false);
    expect(ok(' +1234567')).toBe(true);
  });
  it('counts code points, not UTF-16 units (decision 1)', () => {
    const emoji = '\u{1F600}';
    const over = validatePhone(emoji.repeat(21));
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toMatch(/at most 20/);
    // 20 code points (40 UTF-16 units) passes the length rule; rejected for other reasons.
    const at = validatePhone(emoji.repeat(20));
    expect(at.ok).toBe(false);
    if (!at.ok) expect(at.error).not.toMatch(/at most 20/);
  });
  it('rejects other characters', () => {
    expect(ok('555.123.4567')).toBe(false);
    expect(ok('555/1234567')).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('strips formatting and +', () => {
    expect(normalizePhone('+1 (555) 123-4567')).toBe('15551234567');
  });
});

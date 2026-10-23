import { PHONE_MAX_DIGITS, PHONE_MAX_LENGTH, PHONE_MIN_DIGITS } from '../config';
import type { FieldResult } from '../storage/schema';
import { codePointLength } from './length';

/** Digits only: strips spaces, hyphens, parentheses and '+'. Pure derivation; no validation. */
export function normalizePhone(input: string): string {
  return input.replace(/[\s\-()+]/g, '');
}

/**
 * FR-02..FR-06, FR-47, FR-48. Decisions: length counted in code points
 * (decision 1); '+' allowed only as the first character (decision 3).
 * Over-length input is rejected, never truncated.
 */
export function validatePhone(raw: string): FieldResult<string> {
  const phone = raw.trim();
  if (phone === '') return { ok: false, error: 'Enter a phone number.' };
  if (codePointLength(phone) > PHONE_MAX_LENGTH) {
    return { ok: false, error: `Phone number must be at most ${PHONE_MAX_LENGTH} characters.` };
  }
  if (/\p{L}/u.test(phone)) {
    return { ok: false, error: 'Phone number cannot contain letters or extensions.' };
  }
  if (!/^\+?[0-9 \-()]*$/.test(phone)) {
    return {
      ok: false,
      error: 'Phone number may contain only digits, spaces, hyphens, parentheses and a leading +.',
    };
  }
  const digits = normalizePhone(phone);
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) {
    return {
      ok: false,
      error: `Phone number must have ${PHONE_MIN_DIGITS} to ${PHONE_MAX_DIGITS} digits.`,
    };
  }
  return { ok: true, value: phone };
}

import { NAME_MAX_LENGTH } from '../config';
import type { Contact, FieldResult, ValidationResult } from '../storage/schema';
import { codePointLength } from './length';
import { validatePhone } from './phone';

/**
 * FR-02, FR-47, FR-48. Trim; non-empty; at most 100 code points (decision 1);
 * no character restrictions. Over-length input is rejected, never truncated.
 */
export function validateName(raw: string): FieldResult<string> {
  const name = raw.trim();
  if (name === '') return { ok: false, error: 'Enter a name.' };
  if (codePointLength(name) > NAME_MAX_LENGTH) {
    return { ok: false, error: `Name must be at most ${NAME_MAX_LENGTH} characters.` };
  }
  return { ok: true, value: name };
}

export type ContactInput = Pick<Contact, 'name' | 'phone'>;

/** Shared by add and edit (FR-49). Returns per-field errors. */
export function validateContactInput(input: ContactInput): ValidationResult<ContactInput> {
  const name = validateName(input.name);
  const phone = validatePhone(input.phone);
  if (name.ok && phone.ok) return { ok: true, value: { name: name.value, phone: phone.value } };
  const errors: { name?: string; phone?: string } = {};
  if (!name.ok) errors.name = name.error;
  if (!phone.ok) errors.phone = phone.error;
  return { ok: false, errors };
}

import type { Contact } from '../storage/schema';
import { generateId } from './id';

/**
 * Creates a contact with the next sequence number (FR-08, FR-50). Returns the
 * new contact and the advanced nextSeq. nextSeq only ever increases.
 */
export function createContact(
  input: { name: string; phone: string },
  contacts: readonly Contact[],
  nextSeq: number,
  now: Date = new Date(),
  idFn: (existing: ReadonlySet<string>) => string = generateId,
): { contact: Contact; nextSeq: number } {
  const ids = new Set(contacts.map((c) => c.id));
  const contact: Contact = {
    id: idFn(ids),
    name: input.name,
    phone: input.phone,
    createdSeq: nextSeq,
    createdAt: now.toISOString(),
  };
  return { contact, nextSeq: nextSeq + 1 };
}

/** Edits by id; id, createdSeq and createdAt are preserved (FR-21, FR-37). */
export function updateContact(
  contacts: readonly Contact[],
  id: string,
  input: { name: string; phone: string },
): Contact[] {
  return contacts.map((c) => (c.id === id ? { ...c, name: input.name, phone: input.phone } : c));
}

/** Newest first by createdSeq descending (FR-11). Does not mutate. */
export function sortForDisplay(contacts: readonly Contact[]): Contact[] {
  return [...contacts].sort((a, b) => b.createdSeq - a.createdSeq);
}

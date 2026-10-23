import type { Contact } from '../storage/schema';
import { normalizePhone } from './phone';

/**
 * FR-28..FR-34, FR-38, FR-54. Decisions:
 * - Name: case-insensitive substring using toLowerCase (locale-independent, so
 *   results do not vary with the user's locale, e.g. Turkish dotted/dotless i;
 *   DR-12). The query is trimmed.
 * - Phone: substring on digits after stripping spaces, hyphens, parentheses and
 *   '+' from query and stored value. A query that has no digits, or that still
 *   contains other characters after stripping, matches no phones (decision 2).
 * - Empty (or whitespace-only) query returns all contacts.
 */
export function filter(contacts: readonly Contact[], query: string): Contact[] {
  const q = query.trim();
  if (q === '') return [...contacts];
  const nameQ = q.toLowerCase();
  const phoneQ = normalizePhone(q);
  const phoneSearchable = /^[0-9]+$/.test(phoneQ);
  return contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(nameQ) ||
      (phoneSearchable && normalizePhone(c.phone).includes(phoneQ)),
  );
}

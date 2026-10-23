/**
 * Forward compatibility (CR-07): this is storage format version 1. Records are
 * rebuilt from the five known fields, so fields added by a newer app version
 * would be dropped on the next save. A newer envelope version is rejected as
 * unreadable (never silently rewritten), so the dropping applies only to extra
 * fields inside a version 1 envelope. Changing the format needs a new version.
 */
/** Data model (architecture section 4) plus stored-data validation and salvage (T-07). */
import { validateName } from '../domain/name';
import { validatePhone } from '../domain/phone';

export interface Contact {
  /** UUID, immutable, never derived from phone (FR-36, FR-39). */
  readonly id: string;
  /** Trimmed, 1..100 code points. */
  name: string;
  /** As entered after trimming, at most 20 code points; digits are derived. */
  phone: string;
  /** Monotonic creation counter, immutable (FR-50). */
  readonly createdSeq: number;
  /** ISO timestamp, informational. */
  readonly createdAt: string;
}

export interface StoredEnvelope {
  version: 1;
  nextSeq: number;
  contacts: Contact[];
}

export type FieldErrors = { name?: string; phone?: string };

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors };

export type ParseResult =
  | { kind: 'ok'; contacts: Contact[]; nextSeq: number; nextSeqRecomputed: boolean }
  | {
      kind: 'unreadable';
      /** Valid records kept for a read-only preview (FR-51a). */
      salvaged: Contact[];
      /** Records rejected, including collisions. 0 when the whole value is unparseable. */
      invalidCount: number;
      nextSeq: number;
      reason: string;
    };

/**
 * Safe integers only (CR-06): beyond 2^53 `n + 1 === n`, so a new contact could
 * collide with an existing createdSeq. The upper bound leaves room for nextSeq = max + 1.
 */
function isNonNegInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v < Number.MAX_SAFE_INTEGER;
}

/** Record-level rules (FR-52): string id, valid trimmed name and phone, non-negative integer createdSeq. */
function toContact(rec: unknown): Contact | null {
  if (typeof rec !== 'object' || rec === null || Array.isArray(rec)) return null;
  const r = rec as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id === '') return null;
  if (typeof r.name !== 'string' || typeof r.phone !== 'string') return null;
  const name = validateName(r.name);
  const phone = validatePhone(r.phone);
  // Stored values must already be in trimmed form; nothing is silently rewritten.
  if (!name.ok || name.value !== r.name || !phone.ok || phone.value !== r.phone) return null;
  if (!isNonNegInt(r.createdSeq)) return null;
  // createdAt is informational (architecture section 4) but this app always writes it. A missing or
  // non-string value is treated as invalid rather than silently rewritten to '' on the next save
  // (review item 3). Effect: such a record is counted as invalid and left out of the salvaged preview.
  if (typeof r.createdAt !== 'string') return null;
  return { id: r.id, name: r.name, phone: r.phone, createdSeq: r.createdSeq, createdAt: r.createdAt };
}

function unparseable(reason: string): ParseResult {
  return { kind: 'unreadable', salvaged: [], invalidCount: 0, nextSeq: 0, reason };
}

/**
 * Validates a raw stored string (FR-42, FR-52; DR-04, DR-16). Pure: the raw
 * value is never modified. Collision rule: the first record in stored order
 * keeps an id or createdSeq; later colliding records count as invalid.
 * If every record is valid but nextSeq is missing, not an integer or not
 * greater than the maximum createdSeq, it is recomputed in memory as
 * max(createdSeq)+1 (0 when empty) with no recovery prompt.
 */
export function parseStored(raw: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return unparseable('Stored data is not valid JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return unparseable('Stored data has the wrong shape.');
  }
  const env = parsed as Record<string, unknown>;
  if (env.version !== 1) return unparseable('Stored data has an unsupported version.');
  if (!Array.isArray(env.contacts)) return unparseable('Stored contacts are not a list.');

  const seenIds = new Set<string>();
  const seenSeqs = new Set<number>();
  const valid: Contact[] = [];
  let invalid = 0;
  for (const rec of env.contacts as unknown[]) {
    const c = toContact(rec);
    if (!c || seenIds.has(c.id) || seenSeqs.has(c.createdSeq)) {
      invalid++;
      continue;
    }
    seenIds.add(c.id);
    seenSeqs.add(c.createdSeq);
    valid.push(c);
  }

  const maxSeq = valid.reduce((m, c) => Math.max(m, c.createdSeq), -1);
  const storedNext = env.nextSeq;
  const nextOk = isNonNegInt(storedNext) && storedNext > maxSeq;
  const nextSeq = nextOk ? storedNext : maxSeq + 1;

  if (invalid > 0) {
    return {
      kind: 'unreadable',
      salvaged: valid,
      invalidCount: invalid,
      nextSeq,
      reason: invalid + ' stored record(s) are invalid.',
    };
  }
  return { kind: 'ok', contacts: valid, nextSeq, nextSeqRecomputed: !nextOk };
}

export function serializeEnvelope(contacts: readonly Contact[], nextSeq: number): string {
  const env: StoredEnvelope = { version: 1, nextSeq, contacts: [...contacts] };
  return JSON.stringify(env);
}

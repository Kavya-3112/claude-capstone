/** Id generation (FR-36, FR-39; DR-13). Phone is never used as an id. */

/** Ids are not secrets, so the Math.random fallback (used only when crypto.randomUUID is missing) is acceptable (CR-11). */
function fallbackId(random: () => number): string {
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(random() * 4)).toString(16)}${hex(3)}-${hex(12)}`;
}

export interface IdOptions {
  /** Override for tests; when omitted, crypto.randomUUID is used if present. */
  randomUUID?: (() => string) | null;
  random?: () => number;
}

/** Returns an id not present in `existing`. Retries on collision, then throws. */
export function generateId(existing: ReadonlySet<string>, opts: IdOptions = {}): string {
  const native =
    opts.randomUUID !== undefined
      ? opts.randomUUID
      : typeof globalThis.crypto?.randomUUID === 'function'
        ? () => globalThis.crypto.randomUUID()
        : null;
  const random = opts.random ?? Math.random;
  for (let attempt = 0; attempt < 100; attempt++) {
    const id = native ? native() : fallbackId(random);
    if (!existing.has(id)) return id;
  }
  throw new Error('Could not generate a unique contact id.');
}

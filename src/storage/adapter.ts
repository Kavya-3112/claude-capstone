/**
 * Thin wrapper over localStorage (T-06; FR-40, FR-45, FR-46). Never throws:
 * every failure is returned as a typed result so callers and tests can inject
 * failures (architecture section 2).
 */

export type StorageFailureCause = 'unavailable' | 'quota' | 'security' | 'unknown';

export interface StorageFailure {
  ok: false;
  cause: StorageFailureCause;
  message: string;
}

export type AdapterResult<T> = { ok: true; value: T } | StorageFailure;

export interface StorageAdapter {
  get(key: string): AdapterResult<string | null>;
  set(key: string, value: string): AdapterResult<void>;
  remove(key: string): AdapterResult<void>;
}

/** Maps a thrown value to a failure cause. */
export function classifyError(err: unknown): StorageFailure {
  const e = err as { name?: unknown; code?: unknown; message?: unknown } | null;
  const name = typeof e?.name === 'string' ? e.name : '';
  const code = typeof e?.code === 'number' ? e.code : undefined;
  const message = typeof e?.message === 'string' ? e.message : String(err);
  // 22 is the legacy DOMException code; 1014 is Firefox's NS_ERROR_DOM_QUOTA_REACHED.
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014) {
    return { ok: false, cause: 'quota', message };
  }
  if (name === 'SecurityError' || code === 18) {
    return { ok: false, cause: 'security', message };
  }
  return { ok: false, cause: 'unknown', message };
}

/** Subset of the Web Storage API used here. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * `getStorage` is called on every operation, inside the try block, because
 * merely reading `window.localStorage` can throw SecurityError.
 */
export function createLocalStorageAdapter(
  getStorage: () => StorageLike | null | undefined = () => globalThis.localStorage,
): StorageAdapter {
  function run<T>(op: (s: StorageLike) => T): AdapterResult<T> {
    try {
      const s = getStorage();
      if (!s) return { ok: false, cause: 'unavailable', message: 'localStorage is not available.' };
      return { ok: true, value: op(s) };
    } catch (err) {
      return classifyError(err);
    }
  }
  return {
    get: (key) => run((s) => s.getItem(key)),
    set: (key, value) => run((s) => s.setItem(key, value)),
    remove: (key) => run((s) => s.removeItem(key)),
  };
}

import type { AdapterResult, StorageAdapter, StorageFailure } from '../../src/storage/adapter';

export type Op = 'get' | 'set' | 'remove';

/** In-memory StorageAdapter with injectable per-operation, per-key failures. */
export class FakeAdapter implements StorageAdapter {
  data = new Map<string, string>();
  /** Calls to set/remove, in order, for asserting that keys were not touched. */
  writes: Array<{ op: 'set' | 'remove'; key: string }> = [];
  private failures: Array<{ op: Op; key: string | '*'; failure: StorageFailure }> = [];

  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) this.data.set(k, v);
  }

  failOn(op: Op, failure: StorageFailure, key: string | '*' = '*'): void {
    this.failures.push({ op, key, failure });
  }

  clearFailures(): void {
    this.failures = [];
  }

  private failureFor(op: Op, key: string): StorageFailure | undefined {
    return this.failures.find((f) => f.op === op && (f.key === '*' || f.key === key))?.failure;
  }

  get(key: string): AdapterResult<string | null> {
    return this.failureFor('get', key) ?? { ok: true, value: this.data.get(key) ?? null };
  }

  set(key: string, value: string): AdapterResult<void> {
    this.writes.push({ op: 'set', key });
    const f = this.failureFor('set', key);
    if (f) return f;
    this.data.set(key, value);
    return { ok: true, value: undefined };
  }

  remove(key: string): AdapterResult<void> {
    this.writes.push({ op: 'remove', key });
    const f = this.failureFor('remove', key);
    if (f) return f;
    this.data.delete(key);
    return { ok: true, value: undefined };
  }

  writesTo(key: string) {
    return this.writes.filter((w) => w.key === key);
  }
}

export const quota: StorageFailure = { ok: false, cause: 'quota', message: 'quota' };
export const security: StorageFailure = { ok: false, cause: 'security', message: 'denied' };
export const unavailable: StorageFailure = { ok: false, cause: 'unavailable', message: 'none' };

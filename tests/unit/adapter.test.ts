import { describe, it, expect } from 'vitest';
import { classifyError, createLocalStorageAdapter, type StorageLike } from '../../src/storage/adapter';

function err(name: string, code?: number) {
  const e = new Error(name) as Error & { code?: number };
  e.name = name;
  if (code !== undefined) e.code = code;
  return e;
}

function throwing(e: unknown, which: 'get' | 'set' | 'remove'): StorageLike {
  const ok: StorageLike = { getItem: () => 'v', setItem: () => {}, removeItem: () => {} };
  const t = () => {
    throw e;
  };
  return {
    ...ok,
    getItem: which === 'get' ? t : ok.getItem,
    setItem: which === 'set' ? t : ok.setItem,
    removeItem: which === 'remove' ? t : ok.removeItem,
  };
}

describe('StorageAdapter (T-06)', () => {
  it('passes through successful operations', () => {
    const m = new Map<string, string>();
    const a = createLocalStorageAdapter(() => ({
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => void m.set(k, v),
      removeItem: (k) => void m.delete(k),
    }));
    expect(a.get('k')).toEqual({ ok: true, value: null });
    expect(a.set('k', 'v')).toEqual({ ok: true, value: undefined });
    expect(a.get('k')).toEqual({ ok: true, value: 'v' });
    expect(a.remove('k')).toEqual({ ok: true, value: undefined });
    expect(a.get('k')).toEqual({ ok: true, value: null });
  });

  it('get throwing is returned, not thrown', () => {
    const a = createLocalStorageAdapter(() => throwing(err('Boom'), 'get'));
    expect(a.get('k')).toMatchObject({ ok: false, cause: 'unknown' });
  });

  it('set throwing quota (by name and by legacy code) is classified as quota', () => {
    const byName = createLocalStorageAdapter(() => throwing(err('QuotaExceededError'), 'set'));
    expect(byName.set('k', 'v')).toMatchObject({ ok: false, cause: 'quota' });
    const byCode = createLocalStorageAdapter(() => throwing(err('Error', 22), 'set'));
    expect(byCode.set('k', 'v')).toMatchObject({ ok: false, cause: 'quota' });
  });

  it('remove throwing is returned', () => {
    const a = createLocalStorageAdapter(() => throwing(err('Boom'), 'remove'));
    expect(a.remove('k')).toMatchObject({ ok: false });
  });

  it('access denied when reading the storage object is classified as security', () => {
    const a = createLocalStorageAdapter(() => {
      throw err('SecurityError');
    });
    expect(a.get('k')).toMatchObject({ ok: false, cause: 'security' });
    expect(a.set('k', 'v')).toMatchObject({ ok: false, cause: 'security' });
    expect(a.remove('k')).toMatchObject({ ok: false, cause: 'security' });
  });

  it('missing storage is unavailable', () => {
    const a = createLocalStorageAdapter(() => null);
    expect(a.get('k')).toMatchObject({ ok: false, cause: 'unavailable' });
  });

  it('classifyError handles non-Error values', () => {
    expect(classifyError('x')).toMatchObject({ ok: false, cause: 'unknown', message: 'x' });
    expect(classifyError(null)).toMatchObject({ ok: false, cause: 'unknown' });
  });
});

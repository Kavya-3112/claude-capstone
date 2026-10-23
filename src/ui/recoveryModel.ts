/**
 * Pure choice of which recovery view applies (T-20). No DOM, so it is
 * unit-testable. Decision 4: a leftover backup is handled first, before any
 * new corruption.
 */
import type { AppState } from '../state/store';

export type RecoveryView =
  | { kind: 'leftover'; backupRaw: string }
  | { kind: 'unreadable'; raw: string; invalidCount: number; shown: number }
  | { kind: 'confirm-result'; shown: number };

export function recoveryView(state: AppState): RecoveryView | null {
  if (state.leftoverBackup !== null) return { kind: 'leftover', backupRaw: state.leftoverBackup };
  if (state.saveStatus === 'recovery-needed' && state.recovery) {
    return {
      kind: 'unreadable',
      raw: state.recovery.raw,
      invalidCount: state.recovery.invalidCount,
      shown: state.contacts.length,
    };
  }
  if (state.replacementAwaitingConfirmation) return { kind: 'confirm-result', shown: state.contacts.length };
  return null;
}

/** Small non-cryptographic hash (FNV-1a) so keys change whenever the raw value changes. */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16) + ':' + s.length;
}

/** Stable identity of the view, so the DOM is rebuilt only when it really changes. */
export function recoveryViewKey(v: RecoveryView | null): string {
  if (!v) return 'none';
  switch (v.kind) {
    case 'leftover':
      return `leftover:${hashString(v.backupRaw)}`;
    case 'unreadable':
      return `unreadable:${v.invalidCount}:${v.shown}:${hashString(v.raw)}`;
    case 'confirm-result':
      return `confirm-result:${v.shown}`;
  }
}

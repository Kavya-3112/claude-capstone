/**
 * Pure mapping from store state to the persistent status banner (T-19).
 * No DOM here, so it is unit-testable. Priority: stale > memory-only > unsaved.
 * Recovery and leftover-backup views belong to recovery.ts (T-20), not here.
 * No banner ever contains success text (FR-46).
 */
import type { AppState } from '../state/store';
import { MSG } from './messages';

export type BannerKind = 'stale' | 'memory-only' | 'unsaved';

export interface BannerModel {
  kind: BannerKind;
  message: string;
  /** Label of the Retry / storage re-test button, or null. */
  retryLabel: string | null;
  /** Label of the Reload button (stale tab, T-21), or null. */
  reloadLabel: string | null;
  /** Identity used to decide whether the banner needs rebuilding or re-announcing. */
  key: string;
}

export function bannerModel(state: AppState): BannerModel | null {
  if (state.saveStatus === 'recovery-needed' || state.leftoverBackup !== null) return null; // T-20

  if (state.stale) {
    // Retry cannot succeed while stale (decision 11); the way out is Reload (T-21).
    const unsaved = state.saveStatus === 'unsaved';
    return {
      kind: 'stale',
      message: unsaved ? MSG.staleUnsavedBanner : MSG.staleBanner,
      retryLabel: null,
      reloadLabel: MSG.reloadContacts,
      key: unsaved ? 'stale:unsaved' : 'stale',
    };
  }
  if (state.memoryOnly) {
    return { kind: 'memory-only', message: MSG.memoryOnlyBanner, retryLabel: MSG.retestStorage, reloadLabel: null, key: 'memory-only' };
  }
  if (state.saveStatus === 'unsaved') {
    const f = state.lastSaveFailure;
    const cause =
      f?.kind === 'writeFailed' ? (f.cause === 'quota' ? MSG.causeQuota : f.cause === 'security' ? MSG.causeSecurity : '') : '';
    return {
      kind: 'unsaved',
      message: cause ? `${MSG.unsavedBanner} ${cause}` : MSG.unsavedBanner,
      retryLabel: MSG.retry,
      reloadLabel: null,
      key: `unsaved:${cause}`,
    };
  }
  return null;
}

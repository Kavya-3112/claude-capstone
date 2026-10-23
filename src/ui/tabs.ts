/**
 * Multi-tab detection (T-21; FR-57; DR-02). Listens to the `storage` event for
 * the contacts key and re-checks when the window regains focus or becomes
 * visible, because a missed event must not leave a stale tab unaware. Detection
 * only flags the store as stale; saves are refused by the repository's
 * pre-write check and edits are blocked by the store (decision 11).
 * There is no cross-tab locking; near-simultaneous writes remain the accepted
 * residual risk (DR-02, CR-05).
 */
import { BACKUP_KEY, STORAGE_KEY } from '../config';
import type { Store } from '../state/store';

export function watchOtherTabs(store: Store, win: Window = window): () => void {
  const onStorage = (e: StorageEvent) => {
    // key === null means storage was cleared.
    if (e.key === STORAGE_KEY || e.key === null) store.checkStale();
    // Another tab started or finished a replacement: refresh the leftover backup prompt.
    if (e.key === BACKUP_KEY || e.key === null) store.refreshLeftoverBackup();
  };
  const recheck = () => {
    store.checkStale();
    store.refreshLeftoverBackup();
  };
  const onFocus = () => recheck();
  const onVisible = () => {
    if (win.document.visibilityState === 'visible') recheck();
  };
  win.addEventListener('storage', onStorage);
  win.addEventListener('focus', onFocus);
  win.document.addEventListener('visibilitychange', onVisible);
  return () => {
    win.removeEventListener('storage', onStorage);
    win.removeEventListener('focus', onFocus);
    win.document.removeEventListener('visibilitychange', onVisible);
  };
}

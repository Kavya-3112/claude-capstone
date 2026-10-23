/**
 * ContactRepository (T-08, T-09, T-10). Never throws; every outcome is a typed
 * result. Never writes to the contacts key while in the unreadable state,
 * except through the explicit replaceUnreadable sequence.
 *
 * Recorded decisions (impl-plan line 5):
 * - Decision 4 (DR-01): a leftover backup key is handled first (restore or
 *   discard); replacement is refused while one exists, so it is never
 *   overwritten or deleted without an explicit choice.
 * - Decision 5 (DR-02): if storage was unavailable at load, the staleness
 *   baseline is "absent" and the first successful write needs an explicit
 *   acknowledgement (the user is warned first).
 */
import { BACKUP_KEY, STORAGE_KEY } from '../config';
import type { StorageAdapter, StorageFailure } from './adapter';
import { parseStored, serializeEnvelope, type Contact } from './schema';

export type LoadResult =
  | { kind: 'ok'; contacts: Contact[]; nextSeq: number; nextSeqRecomputed: boolean }
  | { kind: 'empty' }
  | {
      kind: 'unreadable';
      raw: string;
      salvaged: Contact[];
      invalidCount: number;
      nextSeq: number;
      reason: string;
    }
  | { kind: 'unavailable'; cause: StorageFailure['cause'] };

export type SaveResult =
  | { kind: 'ok' }
  | { kind: 'writeFailed'; cause: StorageFailure['cause']; message: string }
  /** Stored raw value differs from the last one this tab loaded or wrote (FR-57). Nothing was written. */
  | { kind: 'stale' }
  /** Repository is in the unreadable state; saving is blocked (FR-43). */
  | { kind: 'blocked' }
  /** Storage was unavailable at load; call acknowledgeUnavailableWarning() after warning the user (decision 5). */
  | { kind: 'warningRequired' };

export type LeftoverBackup =
  | { kind: 'none' }
  | { kind: 'present'; raw: string }
  | { kind: 'unavailable'; cause: StorageFailure['cause'] };

export type ReplaceResult =
  | { kind: 'replaced'; contacts: Contact[]; nextSeq: number; backupKept: boolean }
  | { kind: 'notInRecovery' }
  | { kind: 'leftoverBackupPending' }
  | { kind: 'stale' }
  | { kind: 'backupFailed'; cause: StorageFailure['cause']; message: string }
  | { kind: 'writeFailed'; cause: StorageFailure['cause']; message: string; backupKept: boolean };

export type RemoveBackupResult = { kind: 'ok' } | { kind: 'failed'; cause: StorageFailure['cause']; message: string };

export type RestoreResult =
  | { kind: 'restored'; backupRemoved: boolean }
  /** The contacts value changed since load (or was never loaded); restore needs `confirmOverwrite` (decision 10). */
  | { kind: 'needsConfirmation'; current: string | null }
  | { kind: 'noBackup' }
  | { kind: 'failed'; cause: StorageFailure['cause']; message: string };

type State =
  | { kind: 'unloaded' }
  | { kind: 'normal' }
  | { kind: 'unavailable' }
  | { kind: 'unreadable'; raw: string; salvaged: Contact[]; nextSeq: number };

export class ContactRepository {
  private state: State = { kind: 'unloaded' };
  /** Raw string last loaded or written by this tab. null means the key was absent. */
  private baseline: string | null = null;
  private warningPending = false;
  private backupAwaitingConfirmation = false;
  /**
   * Raw value of the backup this repository wrote itself during a replacement
   * that has not been confirmed yet. Lets a retry reuse its own backup instead
   * of mistaking it for a leftover (CR-01).
   */
  private ownBackupRaw: string | null = null;

  constructor(private readonly adapter: StorageAdapter) {}

  load(): LoadResult {
    const got = this.adapter.get(STORAGE_KEY);
    if (!got.ok) {
      this.state = { kind: 'unavailable' };
      this.baseline = null; // decision 5
      this.warningPending = true;
      return { kind: 'unavailable', cause: got.cause };
    }
    this.warningPending = false;
    this.baseline = got.value;
    if (got.value === null) {
      this.state = { kind: 'normal' };
      return { kind: 'empty' };
    }
    const parsed = parseStored(got.value);
    if (parsed.kind === 'ok') {
      this.state = { kind: 'normal' };
      return parsed;
    }
    this.state = { kind: 'unreadable', raw: got.value, salvaged: parsed.salvaged, nextSeq: parsed.nextSeq };
    return {
      kind: 'unreadable',
      raw: got.value,
      salvaged: parsed.salvaged,
      invalidCount: parsed.invalidCount,
      nextSeq: parsed.nextSeq,
      reason: parsed.reason,
    };
  }

  /** True when the first successful write still needs the user to be warned (decision 5). */
  get needsUnavailableWarning(): boolean {
    return this.warningPending;
  }

  acknowledgeUnavailableWarning(): void {
    this.warningPending = false;
  }

  /**
   * Whole-collection rewrite (architecture section 6). Success is reported only after set returns.
   *
   * Known limit (CR-05): the staleness check is a get followed by a set, and
   * localStorage has no compare-and-set or locking, so another tab can write
   * between the two calls. The check narrows the window but cannot close it.
   * This is the accepted two-tab residual risk (DR-02); the `storage` event
   * handling (T-21) is the second layer.
   */
  save(contacts: readonly Contact[], nextSeq: number): SaveResult {
    // Never save before a load (CR-08) and never while in the unreadable state (FR-43).
    if (this.state.kind === 'unreadable' || this.state.kind === 'unloaded') return { kind: 'blocked' };
    const current = this.adapter.get(STORAGE_KEY);
    if (!current.ok) {
      return { kind: 'writeFailed', cause: current.cause, message: current.message };
    }
    // T-09: refuse when another tab (or anything else) changed the raw value.
    if (current.value !== this.baseline) return { kind: 'stale' };
    if (this.warningPending) return { kind: 'warningRequired' };
    const raw = serializeEnvelope(contacts, nextSeq);
    const wrote = this.adapter.set(STORAGE_KEY, raw);
    if (!wrote.ok) return { kind: 'writeFailed', cause: wrote.cause, message: wrote.message };
    this.baseline = raw;
    this.state = { kind: 'normal' };
    return { kind: 'ok' };
  }

  /**
   * Read-only check used on window focus and storage events (T-21, FR-57):
   * has the raw value changed since this tab last loaded or wrote it?
   * `unknown` when it cannot be read or nothing was loaded yet.
   */
  checkStale(): 'fresh' | 'stale' | 'unknown' {
    if (this.state.kind === 'unloaded') return 'unknown';
    const current = this.adapter.get(STORAGE_KEY);
    if (!current.ok) return 'unknown';
    return current.value === this.baseline ? 'fresh' : 'stale';
  }

  /** Looks for a backup key left by an earlier replacement (decision 4: handled before new corruption). */
  checkLeftoverBackup(): LeftoverBackup {
    const got = this.adapter.get(BACKUP_KEY);
    if (!got.ok) return { kind: 'unavailable', cause: got.cause };
    return got.value === null ? { kind: 'none' } : { kind: 'present', raw: got.value };
  }

  /** Like checkLeftoverBackup, but a backup this repository wrote itself during a replacement is not reported. */
  foreignLeftoverBackup(): LeftoverBackup {
    const r = this.checkLeftoverBackup();
    if (r.kind === 'present' && this.ownBackupRaw !== null && r.raw === this.ownBackupRaw) return { kind: 'none' };
    return r;
  }

  /** Explicit user choice: discard a leftover (or confirmed) backup. Removal failure is non-fatal. */
  discardBackup(): RemoveBackupResult {
    const r = this.adapter.remove(BACKUP_KEY);
    if (!r.ok) return { kind: 'failed', cause: r.cause, message: r.message };
    this.backupAwaitingConfirmation = false;
    this.ownBackupRaw = null;
    return { kind: 'ok' };
  }

  /**
   * Explicit user choice: write the leftover backup's raw value back to the
   * contacts key, then remove the backup (removal failure is non-fatal and
   * reported). The caller should call load() afterwards.
   *
   * Decision 10 (CR-02): if the contacts value changed since load (or nothing
   * was loaded), nothing is written unless `confirmOverwrite` is true, and the
   * current value is returned so the UI can show what would be replaced.
   * Restoring over data that is unchanged since load stays allowed: that is
   * what restore is for (decision 6).
   */
  restoreLeftoverBackup(opts: { confirmOverwrite?: boolean } = {}): RestoreResult {
    const backup = this.adapter.get(BACKUP_KEY);
    if (!backup.ok) return { kind: 'failed', cause: backup.cause, message: backup.message };
    if (backup.value === null) return { kind: 'noBackup' };
    const current = this.adapter.get(STORAGE_KEY);
    if (!current.ok) return { kind: 'failed', cause: current.cause, message: current.message };
    const changed =
      this.state.kind === 'unloaded' ? current.value !== null : current.value !== this.baseline;
    if (changed && current.value !== backup.value && !opts.confirmOverwrite) {
      return { kind: 'needsConfirmation', current: current.value };
    }
    const wrote = this.adapter.set(STORAGE_KEY, backup.value);
    if (!wrote.ok) return { kind: 'failed', cause: wrote.cause, message: wrote.message };
    this.baseline = backup.value;
    this.state = { kind: 'unloaded' };
    const removed = this.adapter.remove(BACKUP_KEY);
    return { kind: 'restored', backupRemoved: removed.ok };
  }

  /**
   * Backup-then-replace (architecture section 6, steps 3-4), called after the
   * user has chosen Replace and confirmed (steps 1-2 are UI).
   * `userHasOwnCopy` is true only if the user explicitly confirmed they have
   * copied or downloaded the raw original; it matters only when the backup
   * write fails (step 3). Step 5 is confirmReplacement().
   */
  replaceUnreadable(opts: { userHasOwnCopy: boolean }): ReplaceResult {
    if (this.state.kind !== 'unreadable') return { kind: 'notInRecovery' };
    const { raw, salvaged, nextSeq } = this.state;

    // A backup this repository wrote for this same raw value (an earlier failed
    // attempt of this replacement) is reused, not treated as a leftover (CR-01).
    const leftover = this.checkLeftoverBackup();
    const isOwnBackup =
      leftover.kind === 'present' &&
      this.ownBackupRaw !== null &&
      leftover.raw === this.ownBackupRaw &&
      leftover.raw === raw;
    if (leftover.kind === 'present' && !isOwnBackup) return { kind: 'leftoverBackupPending' };

    // Do not clobber data that changed since load.
    const current = this.adapter.get(STORAGE_KEY);
    if (!current.ok) return { kind: 'backupFailed', cause: current.cause, message: current.message };
    if (current.value !== this.baseline) return { kind: 'stale' };

    // Step 3: temporary backup of the raw original.
    let backupKept = false;
    if (leftover.kind === 'present') {
      backupKept = true; // our own earlier backup of this same raw value is still in place
    } else {
      const backup = this.adapter.set(BACKUP_KEY, raw);
      if (backup.ok) {
        backupKept = true;
        this.ownBackupRaw = raw;
      } else if (!opts.userHasOwnCopy) {
        return { kind: 'backupFailed', cause: backup.cause, message: backup.message };
      }
    }

    // Step 4: write the new envelope; on failure the previous value stays in place.
    const newRaw = serializeEnvelope(salvaged, nextSeq);
    const wrote = this.adapter.set(STORAGE_KEY, newRaw);
    if (!wrote.ok) {
      return { kind: 'writeFailed', cause: wrote.cause, message: wrote.message, backupKept };
    }
    this.baseline = newRaw;
    this.state = { kind: 'normal' };
    this.backupAwaitingConfirmation = backupKept;
    return { kind: 'replaced', contacts: salvaged, nextSeq, backupKept };
  }

  /** Step 5-6: after the user confirms the replaced result, remove the backup. Failure is non-fatal. */
  confirmReplacement(): RemoveBackupResult {
    if (!this.backupAwaitingConfirmation) return { kind: 'ok' };
    return this.discardBackup();
  }
}

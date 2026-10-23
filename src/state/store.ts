/**
 * App state store (T-11). Single source of truth for rendering. A change is
 * applied in memory first and then persisted (architecture section 6).
 *
 * Recorded decisions (impl-plan lines 5 and 7):
 * - 4: a leftover backup key is handled first; mutations are blocked until the
 *   user restores or discards it.
 * - 5: if storage was unavailable at load, the first successful write needs
 *   the user to be warned (acknowledgeUnavailableWarning).
 * - 6: restoring a leftover backup writes it back, removes it, then reloads.
 * - 7: search stays usable (read-only) during recovery.
 * - 10: restoring a leftover backup over changed data needs explicit confirmation.
 * - 11: add, edit and delete are blocked while the tab is stale, until reload().
 */
import { filter } from '../domain/search';
import { createContact, sortForDisplay, updateContact } from '../domain/ordering';
import { validateContactInput } from '../domain/name';
import type { Contact, FieldErrors } from '../storage/schema';
import type {
  ContactRepository,
  LoadResult,
  ReplaceResult,
  RestoreResult,
  SaveResult,
} from '../storage/repository';

export type SaveStatus = 'saved' | 'unsaved' | 'recovery-needed';

export interface RecoveryInfo {
  raw: string;
  invalidCount: number;
  reason: string;
}

export interface AppState {
  /** Working collection. In recovery this is the read-only salvaged preview. */
  contacts: readonly Contact[];
  nextSeq: number;
  query: string;
  editingId: string | null;
  saveStatus: SaveStatus;
  /** Why the last persist did not succeed; null when saved. Never contains success text. */
  lastSaveFailure: SaveFailure | null;
  /** Another tab changed the data (FR-57); saves are refused until reload(). */
  stale: boolean;
  /** Storage was unavailable at load and no write has succeeded since (Q-21). */
  memoryOnly: boolean;
  /** The user must acknowledge the unavailable-storage warning before the first write (decision 5). */
  warningRequired: boolean;
  recovery: RecoveryInfo | null;
  /** Raw value of a leftover backup key awaiting restore or discard (decision 4). */
  leftoverBackup: string | null;
  /** A replacement succeeded and its result awaits user confirmation (Q-23). */
  replacementAwaitingConfirmation: boolean;
}

export type SaveFailure =
  | { kind: 'writeFailed'; cause: string; message: string }
  | { kind: 'stale' }
  | { kind: 'warningRequired' };

export type MutationBlock = 'recovery' | 'leftover-backup' | 'stale';

export type AddResult =
  | { ok: true; contact: Contact; saved: boolean; hiddenBySearch: boolean }
  | { ok: false; errors: FieldErrors }
  | { ok: false; blocked: MutationBlock };

export type EditResult =
  | { ok: true; saved: boolean }
  | { ok: false; errors: FieldErrors }
  | { ok: false; blocked: MutationBlock }
  | { ok: false; notFound: true };

export type DeleteResult =
  | { ok: true; saved: boolean }
  | { ok: false; blocked: MutationBlock }
  | { ok: false; notFound: true };

type Listener = (state: AppState) => void;

export class Store {
  private state: AppState = {
    contacts: [],
    nextSeq: 0,
    query: '',
    editingId: null,
    saveStatus: 'saved',
    lastSaveFailure: null,
    stale: false,
    memoryOnly: false,
    warningRequired: false,
    recovery: null,
    leftoverBackup: null,
    replacementAwaitingConfirmation: false,
  };
  private listeners = new Set<Listener>();

  /**
   * `onListenerError` receives exceptions thrown by subscribers. A faulty
   * listener must never stop a change from being persisted (CR-03).
   */
  constructor(
    private readonly repo: ContactRepository,
    private readonly onListenerError: (err: unknown) => void = () => {},
  ) {}

  getState(): AppState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of [...this.listeners]) {
      try {
        l(this.state);
      } catch (err) {
        try {
          this.onListenerError(err);
        } catch {
          // The error reporter itself failed; nothing more can be done safely.
        }
      }
    }
  }

  /** Contacts to render: filtered by the in-memory query, newest first. Works during recovery (decision 7). */
  visibleContacts(): Contact[] {
    return sortForDisplay(filter(this.state.contacts, this.state.query));
  }

  /** The first blocking condition, or null when mutations are allowed. UI disables controls from this. */
  mutationBlock(): MutationBlock | null {
    return this.blocked();
  }

  private blocked(): MutationBlock | null {
    if (this.state.saveStatus === 'recovery-needed') return 'recovery';
    if (this.state.leftoverBackup !== null) return 'leftover-backup';
    if (this.state.stale) return 'stale'; // until the user reloads (decision 11)
    return null;
  }

  // ---- Loading -------------------------------------------------------

  /** Initial load. Checks the leftover backup first (decision 4), then loads the contacts. */
  init(): LoadResult {
    // If the backup key itself cannot be read, it is treated as "no leftover":
    // the contacts load below reports storage problems on its own (CR-11).
    // The leftover is computed before the load is applied so the UI sees one
    // consistent state in a single notification (review item 7).
    return this.applyLoad(this.repo.load(), this.readLeftover());
  }

  private readLeftover(): string | null {
    const leftover = this.repo.checkLeftoverBackup();
    return leftover.kind === 'present' ? leftover.raw : null;
  }

  /**
   * Re-reads storage and replaces the in-memory data (the "Reload" and
   * "Reload and discard" action, T-21). Pending in-memory changes are
   * discarded, so the UI must ask first (DR-15).
   */
  reload(): LoadResult {
    return this.applyLoad(this.repo.load(), this.readLeftover());
  }

  /**
   * Another tab may have created or removed the backup key (T-21). Backups this
   * repository wrote itself are not leftovers (CR-01), so they are ignored here.
   */
  refreshLeftoverBackup(): void {
    const foreign = this.repo.foreignLeftoverBackup();
    if (foreign.kind === 'unavailable') return; // keep what we know
    const raw = foreign.kind === 'present' ? foreign.raw : null;
    if (raw !== this.state.leftoverBackup) this.set({ leftoverBackup: raw });
  }

  private applyLoad(r: LoadResult, leftoverBackup: string | null): LoadResult {
    const common = {
      leftoverBackup,
      editingId: null,
      stale: false,
      lastSaveFailure: null,
      recovery: null,
      memoryOnly: false,
      warningRequired: false,
      replacementAwaitingConfirmation: false,
    };
    switch (r.kind) {
      case 'ok':
        this.set({ ...common, contacts: r.contacts, nextSeq: r.nextSeq, saveStatus: 'saved' });
        break;
      case 'empty':
        this.set({ ...common, contacts: [], nextSeq: 0, saveStatus: 'saved' });
        break;
      case 'unreadable':
        this.set({
          ...common,
          contacts: r.salvaged,
          nextSeq: r.nextSeq,
          saveStatus: 'recovery-needed',
          recovery: { raw: r.raw, invalidCount: r.invalidCount, reason: r.reason },
        });
        break;
      case 'unavailable':
        this.set({
          ...common,
          contacts: [],
          nextSeq: 0,
          saveStatus: 'saved',
          memoryOnly: true,
          warningRequired: true,
        });
        break;
    }
    return r;
  }

  // ---- Search and edit target (never persisted) ------------------------

  setQuery(query: string): void {
    this.set({ query });
  }

  startEdit(id: string): boolean {
    if (this.blocked() || !this.state.contacts.some((c) => c.id === id)) return false;
    this.set({ editingId: id });
    return true;
  }

  cancelEdit(): void {
    if (this.state.editingId !== null) this.set({ editingId: null });
  }

  // ---- Mutations -------------------------------------------------------

  addContact(input: { name: string; phone: string }): AddResult {
    const block = this.blocked();
    if (block) return { ok: false, blocked: block };
    const v = validateContactInput(input);
    if (!v.ok) return { ok: false, errors: v.errors };
    const { contact, nextSeq } = createContact(v.value, this.state.contacts, this.state.nextSeq);
    this.set({ contacts: [...this.state.contacts, contact], nextSeq }); // query deliberately untouched (FR-55)
    const saved = this.persist();
    const hiddenBySearch = !filter([contact], this.state.query).length;
    return { ok: true, contact, saved, hiddenBySearch };
  }

  editContact(id: string, input: { name: string; phone: string }): EditResult {
    const block = this.blocked();
    if (block) return { ok: false, blocked: block };
    if (!this.state.contacts.some((c) => c.id === id)) return { ok: false, notFound: true };
    const v = validateContactInput(input); // same validators as add (FR-49)
    if (!v.ok) return { ok: false, errors: v.errors };
    this.set({ contacts: updateContact(this.state.contacts, id, v.value), editingId: null });
    return { ok: true, saved: this.persist() };
  }

  deleteContact(id: string): DeleteResult {
    const block = this.blocked();
    if (block) return { ok: false, blocked: block };
    if (!this.state.contacts.some((c) => c.id === id)) return { ok: false, notFound: true };
    this.set({
      contacts: this.state.contacts.filter((c) => c.id !== id),
      editingId: this.state.editingId === id ? null : this.state.editingId,
    });
    return { ok: true, saved: this.persist() };
  }

  // ---- Persistence -----------------------------------------------------

  /** Persists the whole current collection, including earlier unsaved changes (FR-53). Returns true on success. */
  private persist(): boolean {
    return this.applySave(this.repo.save(this.state.contacts, this.state.nextSeq));
  }

  private applySave(r: SaveResult): boolean {
    switch (r.kind) {
      case 'ok':
        this.set({
          saveStatus: 'saved',
          lastSaveFailure: null,
          stale: false,
          memoryOnly: false,
          warningRequired: false,
        });
        return true;
      case 'writeFailed':
        this.set({
          saveStatus: 'unsaved',
          lastSaveFailure: { kind: 'writeFailed', cause: r.cause, message: r.message },
        });
        return false;
      case 'stale':
        this.set({ saveStatus: 'unsaved', stale: true, lastSaveFailure: { kind: 'stale' } });
        return false;
      case 'warningRequired':
        this.set({
          saveStatus: 'unsaved',
          warningRequired: true,
          lastSaveFailure: { kind: 'warningRequired' },
        });
        return false;
      case 'blocked':
        // Unreachable while the store's own block checks hold; stay in recovery.
        this.set({ saveStatus: 'recovery-needed' });
        return false;
    }
  }

  /**
   * Retry (FR-53). Also the storage re-test in memory-only mode (Q-21): a write
   * attempt that finds data present is refused as stale (decision 5).
   */
  retrySave(): boolean {
    if (this.blocked()) return false;
    if (this.state.saveStatus === 'saved' && !this.state.memoryOnly) return true; // nothing to retry
    return this.persist();
  }

  /** Called after the UI has warned the user that storage was unavailable (decision 5). */
  acknowledgeUnavailableWarning(): void {
    this.repo.acknowledgeUnavailableWarning();
    this.set({ warningRequired: false });
  }

  /** Compares storage with what this tab last loaded or wrote and flags a change (T-21). Returns true if stale. */
  checkStale(): boolean {
    if (this.state.stale) return true;
    if (this.repo.checkStale() === 'stale') {
      this.markStale();
      return true;
    }
    return false;
  }

  /** Another tab changed the data (storage event or focus check, T-21). */
  markStale(): void {
    if (!this.state.stale) this.set({ stale: true });
  }

  // ---- Recovery (T-20 supplies the UI) ----------------------------------

  /** Replace unreadable data with the salvaged records (backup-then-replace, T-10). */
  replaceUnreadable(opts: { userHasOwnCopy: boolean }): ReplaceResult {
    if (this.state.leftoverBackup !== null) return { kind: 'leftoverBackupPending' };
    const r = this.repo.replaceUnreadable(opts);
    if (r.kind === 'leftoverBackupPending') {
      // Surface the prompt so the UI can show it (CR-01).
      const left = this.repo.checkLeftoverBackup();
      if (left.kind === 'present') this.set({ leftoverBackup: left.raw });
    }
    if (r.kind === 'replaced') {
      this.set({
        contacts: r.contacts,
        nextSeq: r.nextSeq,
        saveStatus: 'saved',
        recovery: null,
        lastSaveFailure: null,
        replacementAwaitingConfirmation: r.backupKept,
      });
    }
    return r;
  }

  /** The user confirmed the replaced result; remove the backup. Failure is non-fatal and can be retried. */
  confirmReplacement(): ReturnType<ContactRepository['confirmReplacement']> {
    const r = this.repo.confirmReplacement();
    if (r.kind === 'ok') this.set({ replacementAwaitingConfirmation: false });
    return r;
  }

  /** Leftover backup choice (decision 4). Restore follows decision 6 and then reloads. */
  restoreLeftoverBackup(opts: { confirmOverwrite?: boolean } = {}): RestoreResult {
    const r = this.repo.restoreLeftoverBackup(opts); // may answer needsConfirmation (decision 10)
    // reload() reads the backup key again, so a backup that could not be removed
    // stays offered for discarding without a second state update.
    if (r.kind === 'restored') this.reload();
    return r;
  }

  discardLeftoverBackup(): ReturnType<ContactRepository['discardBackup']> {
    const r = this.repo.discardBackup();
    if (r.kind === 'ok') this.set({ leftoverBackup: null });
    return r;
  }
}

/**
 * Recovery UI (T-20; FR-43, FR-44, FR-51, FR-52; Q-22, decisions 4, 6, 10, 15..17).
 *
 * Views, chosen by recoveryModel.ts:
 * - leftover backup (handled first): Restore, Discard, copy/download of the backup.
 * - unreadable data: invalid count, copy/download of the raw original, Replace
 *   (explicit confirmation; "I have my own copy" only if the backup write fails,
 *   architecture section 6 step 3), Leave unchanged.
 * - replaced: the user confirms the result, which removes the temporary backup.
 * Text goes in through textContent only. The raw value is never rendered into
 * the page; it is only handed to the clipboard or to a download.
 * Focus after a step change goes to the panel heading.
 */
import type { Announcer } from './announcer';
import { el } from './dom';
import { MSG, invalidSummary, replaceAsk, replacedBody } from './messages';
import { recoveryView, recoveryViewKey, type RecoveryView } from './recoveryModel';
import type { Store } from '../state/store';

type Step =
  | { kind: 'idle' }
  | { kind: 'restore-confirm' }
  | { kind: 'discard-confirm' }
  | { kind: 'replace-confirm' }
  | { kind: 'backup-failed'; cause: string }
  | { kind: 'write-failed'; cause: string }
  | { kind: 'stale' }
  | { kind: 'left' }
  | { kind: 'remove-failed' };

export interface RecoveryDeps {
  region: HTMLElement;
  store: Store;
  announcer: Announcer;
  /** Where focus goes once the recovery panel is gone. */
  focusAfterDone: () => void;
}

const causeText = (cause: string) =>
  cause === 'quota' ? MSG.causeQuota : cause === 'security' ? MSG.causeSecurity : '';

/** Hands text to the browser as a file download. Uses a Blob URL, which the page CSP does not restrict. */
export function downloadText(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function mountRecovery(deps: RecoveryDeps): { render(): void } {
  const { region, store, announcer } = deps;
  let step: Step = { kind: 'idle' };
  let renderedKey = 'none';
  let renderedStep = '';

  /**
   * After a transition that may remove the panel (Restore, Discard, Reload):
   * focus the heading if a recovery view remains, otherwise move focus to the
   * page so it is not lost with the removed buttons (review item 4).
   */
  const settle = () => {
    step = { kind: 'idle' };
    draw(true, true);
    if (!recoveryView(store.getState())) deps.focusAfterDone();
  };

  const go = (next: Step, focusHeading = true) => {
    step = next;
    draw(true, focusHeading);
  };

  async function copyRaw(raw: string) {
    try {
      await navigator.clipboard.writeText(raw);
      announcer.announce(MSG.copied);
    } catch {
      announcer.alert(MSG.copyFailed);
    }
  }

  function dataButtons(raw: string, copyLabel: string, downloadLabel: string, filename: string) {
    const copy = el('button', { class: 'btn btn-secondary', text: copyLabel, attrs: { type: 'button', 'data-action': 'copy-raw' } });
    const down = el('button', { class: 'btn btn-secondary', text: downloadLabel, attrs: { type: 'button', 'data-action': 'download-raw' } });
    copy.addEventListener('click', () => void copyRaw(raw));
    down.addEventListener('click', () => {
      downloadText(raw, filename);
      announcer.announce(MSG.downloaded);
    });
    return [copy, down];
  }

  const button = (label: string, action: string, onClick: () => void, secondary = false, danger = false) => {
    const b = el('button', {
      class: danger ? 'btn btn-danger' : secondary ? 'btn btn-secondary' : 'btn',
      text: label,
      attrs: { type: 'button', 'data-action': action },
    });
    b.addEventListener('click', onClick);
    return b;
  };

  // ---- leftover backup -------------------------------------------------
  function leftoverPanel(v: Extract<RecoveryView, { kind: 'leftover' }>): Node[] {
    const out: Node[] = [el('p', { text: MSG.leftoverBody })];
    if (step.kind === 'restore-confirm') {
      out.push(
        el('p', { text: MSG.restoreChanged, attrs: { 'data-role': 'confirm-text' } }),
        el('div', { class: 'btn-row' }, [
          button(MSG.keepCurrent, 'restore-cancel', () => go({ kind: 'idle' }), true),
          button(MSG.restoreAnyway, 'restore-anyway', () => doRestore(true)),
        ]),
      );
    } else if (step.kind === 'discard-confirm') {
      out.push(
        el('p', { text: MSG.discardAsk, attrs: { 'data-role': 'confirm-text' } }),
        el('div', { class: 'btn-row' }, [
          button(MSG.keepBackup, 'discard-cancel', () => go({ kind: 'idle' }), true),
          button(MSG.discardYes, 'discard-yes', doDiscard, false, true),
        ]),
      );
    } else {
      out.push(
        el('div', { class: 'btn-row' }, [
          button(MSG.restoreBackup, 'restore', () => doRestore(false)),
          button(MSG.discardBackup, 'discard', () => go({ kind: 'discard-confirm' }), true),
        ]),
        el('div', { class: 'btn-row' }, dataButtons(v.backupRaw, MSG.copyBackup, MSG.downloadBackup, 'contacts-backup.json')),
      );
    }
    return out;
  }

  function doRestore(confirmOverwrite: boolean) {
    const r = store.restoreLeftoverBackup({ confirmOverwrite });
    if (r.kind === 'needsConfirmation') return go({ kind: 'restore-confirm' });
    if (r.kind === 'restored') {
      announcer.announce(r.backupRemoved ? MSG.backupRestored : MSG.backupRestoredNotRemoved);
      settle();
      return;
    }
    if (r.kind === 'noBackup') {
      store.reload();
      settle();
      return;
    }
    announcer.alert(MSG.restoreFailed);
    go({ kind: 'idle' });
  }

  function doDiscard() {
    const r = store.discardLeftoverBackup();
    if (r.kind === 'ok') {
      announcer.announce(MSG.backupDiscarded);
      settle();
    } else {
      announcer.alert(MSG.discardFailed);
      go({ kind: 'idle' });
    }
  }

  // ---- unreadable data -----------------------------------------------
  function replace(userHasOwnCopy: boolean) {
    const r = store.replaceUnreadable({ userHasOwnCopy });
    switch (r.kind) {
      case 'replaced':
        step = { kind: 'idle' };
        announcer.announce(r.backupKept ? MSG.replacedAnnounce : MSG.replacedNoBackup);
        draw(true, true);
        if (!r.backupKept) deps.focusAfterDone();
        return;
      case 'backupFailed':
        return go({ kind: 'backup-failed', cause: r.cause });
      case 'writeFailed':
        return go({ kind: 'write-failed', cause: r.cause });
      case 'stale':
        return go({ kind: 'stale' });
      case 'leftoverBackupPending':
      case 'notInRecovery':
        step = { kind: 'idle' };
        draw(true, true); // the store state decides which view applies now
        return;
    }
  }

  function unreadablePanel(v: Extract<RecoveryView, { kind: 'unreadable' }>): Node[] {
    const out: Node[] = [
      el('p', { text: invalidSummary(v.invalidCount, v.shown), attrs: { 'data-role': 'summary' } }),
      el('p', { text: MSG.recoveryUnchanged }),
    ];
    const main = () => [
      el('div', { class: 'btn-row' }, dataButtons(v.raw, MSG.copyOriginal, MSG.downloadOriginal, 'contacts-original.json')),
      el('div', { class: 'btn-row' }, [
        button(MSG.replaceSaved, 'replace', () => go({ kind: 'replace-confirm' })),
        button(MSG.leaveUnchanged, 'leave', () => {
          announcer.announce(MSG.recoveryLeft);
          go({ kind: 'left' });
        }, true),
      ]),
    ];
    switch (step.kind) {
      case 'replace-confirm':
        out.push(
          el('p', { text: replaceAsk(v.shown), attrs: { 'data-role': 'confirm-text' } }),
          el('div', { class: 'btn-row' }, [
            button(MSG.replaceCancel, 'replace-cancel', () => go({ kind: 'idle' }), true),
            button(MSG.replaceConfirmButton, 'replace-confirm', () => replace(false)),
          ]),
        );
        break;
      case 'backup-failed': {
        const cause = causeText(step.cause);
        const check = el('input', { attrs: { type: 'checkbox', id: 'own-copy' } });
        const go2 = button(MSG.replaceWithoutBackup, 'replace-no-backup', () => replace(true));
        go2.disabled = true;
        check.addEventListener('change', () => (go2.disabled = !check.checked));
        out.push(
          el('p', { text: cause ? `${MSG.backupFailed} ${cause}` : MSG.backupFailed, attrs: { 'data-role': 'confirm-text' } }),
          el('div', { class: 'field field-check' }, [check, el('label', { text: MSG.ownCopyCheck, attrs: { for: 'own-copy' } })]),
          el('div', { class: 'btn-row' }, [button(MSG.replaceCancel, 'replace-cancel', () => go({ kind: 'idle' }), true), go2]),
        );
        break;
      }
      case 'write-failed': {
        const cause = causeText(step.cause);
        out.push(
          el('p', { text: cause ? `${MSG.replaceWriteFailed} ${cause}` : MSG.replaceWriteFailed, attrs: { 'data-role': 'confirm-text' } }),
          el('div', { class: 'btn-row' }, [
            button(MSG.replaceCancel, 'replace-cancel', () => go({ kind: 'idle' }), true),
            button(MSG.tryAgain, 'replace-retry', () => replace(false)),
          ]),
        );
        break;
      }
      case 'stale':
        out.push(
          el('p', { text: MSG.replaceStale, attrs: { 'data-role': 'confirm-text' } }),
          el('div', { class: 'btn-row' }, [
            button(MSG.reloadData, 'reload-data', () => {
              store.reload();
              announcer.announce(MSG.contactsReloaded);
              settle();
            }),
          ]),
        );
        break;
      case 'left':
        out.push(el('p', { text: MSG.recoveryLeft, attrs: { 'data-role': 'confirm-text' } }), ...main());
        break;
      default:
        out.push(...main());
    }
    return out;
  }

  // ---- confirm the replaced result ---------------------------------------
  function confirmPanel(v: Extract<RecoveryView, { kind: 'confirm-result' }>): Node[] {
    const out: Node[] = [el('p', { text: replacedBody(v.shown) })];
    if (step.kind === 'remove-failed') out.push(el('p', { text: MSG.backupRemoveFailed, attrs: { 'data-role': 'confirm-text' } }));
    out.push(
      el('div', { class: 'btn-row' }, [
        button(step.kind === 'remove-failed' ? MSG.retryRemoveBackup : MSG.confirmResult, 'confirm-result', () => {
          const r = store.confirmReplacement();
          if (r.kind === 'ok') {
            announcer.announce(MSG.resultConfirmed);
            step = { kind: 'idle' };
            draw(true, false);
            deps.focusAfterDone();
          } else {
            announcer.alert(MSG.backupRemoveFailed);
            go({ kind: 'remove-failed' });
          }
        }),
      ]),
    );
    return out;
  }

  // ---- rendering -------------------------------------------------------
  const headingFor = (v: RecoveryView) =>
    v.kind === 'leftover' ? MSG.leftoverHeading : v.kind === 'unreadable' ? MSG.recoveryHeading : MSG.replacedHeading;

  function draw(force: boolean, focusHeading: boolean) {
    const v = recoveryView(store.getState());
    const key = recoveryViewKey(v);
    if (!force && key === renderedKey && step.kind === (renderedStep as Step['kind'])) return;
    const hadFocusInside = region.contains(document.activeElement);
    const focusedAction = hadFocusInside ? document.activeElement?.getAttribute('data-action') : null;
    const previousKey = renderedKey;
    renderedKey = key;
    renderedStep = step.kind;
    region.replaceChildren();
    if (!v) {
      region.hidden = true;
      step = { kind: 'idle' };
      return;
    }
    const body =
      v.kind === 'leftover' ? leftoverPanel(v) : v.kind === 'unreadable' ? unreadablePanel(v) : confirmPanel(v);
    region.append(
      el('div', { class: 'recovery', attrs: { 'data-recovery': v.kind } }, [
        el('h2', { text: headingFor(v), attrs: { id: 'recovery-heading', tabindex: '-1' } }),
        ...body,
      ]),
    );
    region.hidden = false;
    if (focusHeading) region.querySelector<HTMLElement>('#recovery-heading')?.focus();
    else if (focusedAction) region.querySelector<HTMLElement>(`[data-action="${focusedAction}"]`)?.focus();
    // Announce a newly appearing view once (nothing else announces it).
    if (previousKey.split(':')[0] !== key.split(':')[0]) {
      announcer.alert(`${headingFor(v)}. ${v.kind === 'unreadable' ? invalidSummary(v.invalidCount, v.shown) : v.kind === 'leftover' ? MSG.leftoverBody : ''}`.trim());
    }
  }

  store.subscribe(() => {
    // Any change to the view or the underlying raw data (the key includes it) resets a
    // half-finished or "left unchanged" step (review item 5).
    const v = recoveryView(store.getState());
    if (recoveryViewKey(v) !== renderedKey && step.kind !== 'idle') step = { kind: 'idle' };
    draw(false, false);
  });
  draw(true, false);
  return { render: () => draw(false, false) };
}

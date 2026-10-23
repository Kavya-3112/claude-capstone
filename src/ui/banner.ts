/**
 * Persistent save-status banner (T-19; FR-45, FR-46, FR-53; Q-21; DR-14).
 * Rendered from the store through bannerModel(). The banner text is static
 * (not a live region); appearance is announced once through the announcer
 * (CR-10 strategy). T-21 adds a Reload button to the stale banner. The "unsaved" banner is not announced here because the
 * action that failed already raised the alert; stale and memory-only
 * banners are announced because nothing else announces them.
 */
import type { Announcer } from './announcer';
import { showChoiceDialog } from './confirmDialog';
import { bannerModel, type BannerModel } from './bannerModel';
import { el } from './dom';
import { MSG } from './messages';
import type { Store } from '../state/store';

export interface BannerDeps {
  region: HTMLElement;
  store: Store;
  announcer: Announcer;
  /** Where focus goes when the Retry button disappears after a successful save. */
  focusAfterSuccess: () => void;
  /** True when form input or an open edit holds text that a reload would discard (T-21, DR-15). */
  hasPendingInput: () => boolean;
  /** Clears form input and any open edit after the user chose "Reload and discard". */
  discardPendingInput: () => void;
}

export function mountBanner(deps: BannerDeps): { render(): void } {
  const { region, store, announcer } = deps;
  let current: BannerModel | null = null;

  function retry() {
    const before = store.getState();
    if (before.memoryOnly) store.acknowledgeUnavailableWarning(); // the banner is the warning (decision 5)
    const ok = store.retrySave();
    const after = store.getState();
    if (ok) {
      announcer.announce(MSG.allSaved);
      deps.focusAfterSuccess();
    } else if (after.stale) {
      // The stale banner announces itself on render.
    } else {
      announcer.alert(before.memoryOnly ? MSG.storageStillUnavailable : MSG.stillNotSaved);
    }
  }

  function doReload() {
    store.reload();
    deps.discardPendingInput();
    announcer.announce(MSG.contactsReloaded);
    deps.focusAfterSuccess();
  }

  /** Reload with the DR-15 prompt: nothing pending is discarded without an explicit choice. */
  function reload() {
    const pending = store.getState().saveStatus === 'unsaved' || deps.hasPendingInput();
    if (!pending) return doReload();
    showChoiceDialog({
      title: MSG.reloadPromptTitle,
      body: MSG.reloadPromptBody,
      safeLabel: MSG.keepEditing,
      actionLabel: MSG.reloadDiscard,
      danger: true,
      onSafe: () => region.querySelector<HTMLElement>('[data-action="reload"]')?.focus(),
      onAction: doReload,
    });
  }

  function render() {
    const next = bannerModel(store.getState());
    if ((next?.key ?? null) === (current?.key ?? null)) return; // unchanged: keep the DOM and focus
    const hadRetryFocus = region.contains(document.activeElement) && document.activeElement?.getAttribute('data-action') === 'retry';
    const previous = current;
    current = next;
    region.replaceChildren();
    if (!next) {
      region.hidden = true;
      return;
    }
    const children: Node[] = [el('p', { text: next.message })];
    if (next.retryLabel) {
      const btn = el('button', { class: 'btn', text: next.retryLabel, attrs: { type: 'button', 'data-action': 'retry' } });
      btn.addEventListener('click', retry);
      children.push(el('div', { class: 'btn-row' }, [btn]));
    }
    if (next.reloadLabel) {
      const btn = el('button', { class: 'btn', text: next.reloadLabel, attrs: { type: 'button', 'data-action': 'reload' } });
      btn.addEventListener('click', reload);
      children.push(el('div', { class: 'btn-row' }, [btn]));
    }
    region.append(el('div', { class: next.kind === 'unsaved' ? 'banner banner-error' : 'banner', attrs: { 'data-banner': next.kind } }, children));
    region.hidden = false;
    if (hadRetryFocus && next.retryLabel) region.querySelector<HTMLElement>('[data-action="retry"]')?.focus();
    if (next.kind !== 'unsaved' && previous?.kind !== next.kind) announcer.alert(next.message);
    else if (next.kind === 'stale' && previous?.key !== next.key) announcer.alert(next.message);
  }

  store.subscribe(render);
  render();
  return { render };
}

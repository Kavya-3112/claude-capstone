/**
 * Search input (T-18; FR-28..FR-34, FR-54, FR-55; DR-17). One input filters by
 * name and phone through the store. The query lives in memory only, is never
 * cleared by adding a contact, and stays usable during recovery because it
 * cannot change data (decision 7). The no-match message is rendered by the
 * list (list.ts); this module owns the input, result announcements and the
 * "hidden by the current search" notice.
 */
import type { Announcer } from './announcer';
import { el } from './dom';
import { MSG, resultsCount } from './messages';
import type { Store } from '../state/store';

export interface SearchDeps {
  section: HTMLElement;
  notice: HTMLElement;
  store: Store;
  announcer: Announcer;
  /** Delay before announcing the result count, so typing is not narrated per keystroke. */
  announceDelayMs?: number;
}

export function mountSearch(deps: SearchDeps): {
  showHiddenNotice(saved: boolean): void;
  clearNotice(): void;
} {
  const { section, notice, store, announcer } = deps;
  const delay = deps.announceDelayMs ?? 400;

  const input = el('input', {
    attrs: { type: 'search', id: 'search-input', name: 'search', autocomplete: 'off', 'aria-describedby': 'search-hint' },
  });
  const clearBtn = el('button', {
    class: 'btn btn-secondary',
    text: MSG.searchClear,
    attrs: { type: 'button', id: 'search-clear' },
  });
  clearBtn.hidden = true;

  section.append(
    el('div', { class: 'field' }, [
      el('label', { text: MSG.searchLabel, attrs: { for: 'search-input' } }),
      el('p', { class: 'hint', text: MSG.searchHint, attrs: { id: 'search-hint' } }),
      input,
    ]),
    el('div', { class: 'btn-row' }, [clearBtn]),
  );

  function clearNotice() {
    notice.textContent = '';
    notice.hidden = true;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  function announceResults() {
    const state = store.getState();
    if (state.query.trim() === '') return;
    const n = store.visibleContacts().length;
    announcer.announce(n === 0 ? MSG.noMatchAnnounce : resultsCount(n));
  }

  function onQuery(query: string) {
    store.setQuery(query);
    clearNotice(); // the notice described the previous query
    clearBtn.hidden = query === '';
    clearTimeout(timer);
    timer = setTimeout(announceResults, delay);
  }

  input.addEventListener('input', () => onQuery(input.value));
  clearBtn.addEventListener('click', () => {
    input.value = '';
    onQuery('');
    clearTimeout(timer);
    announcer.announce(MSG.searchCleared);
    input.focus();
  });

  return {
    showHiddenNotice(saved: boolean) {
      const text = saved ? MSG.hiddenBySearchSaved : MSG.hiddenBySearchUnsaved;
      notice.textContent = text; // visible
      notice.hidden = false;
      announcer.announce(text); // and announced (DR-17)
    },
    clearNotice,
  };
}

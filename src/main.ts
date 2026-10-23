/**
 * Entry point: wires the store, announcer, list and add form (T-14, T-15).
 * Recovery (T-20) and multi-tab handling (T-21) are wired here too.
 */
import { Store } from './state/store';
import { ContactRepository } from './storage/repository';
import { createLocalStorageAdapter } from './storage/adapter';
import { applyFocus, createAnnouncer, focusPlan } from './ui/announcer';
import { createContactForm } from './ui/form';
import { mountBanner } from './ui/banner';
import { mountList, resolveFocus } from './ui/list';
import { mountRecovery } from './ui/recovery';
import { watchOtherTabs } from './ui/tabs';
import { mountSearch } from './ui/search';
import { MSG, blockedReasonText, fixErrors } from './ui/messages';

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id} in index.html`);
  return node as T;
}

function start() {
  const announcer = createAnnouncer(byId('live-polite'), byId('live-assertive'));
  const store = new Store(new ContactRepository(createLocalStorageAdapter()), (err) => {
    // A broken subscriber must not stop saving (CR-03); surface it for developers.
    console.error('UI listener failed', err);
  });

  const list = mountList({ region: byId('contact-list-region'), store, announcer });
  const focusHeading = () => byId('list-heading').focus();
  mountRecovery({ region: byId('recovery-region'), store, announcer, focusAfterDone: focusHeading });
  mountBanner({
    region: byId('banner-region'),
    store,
    announcer,
    focusAfterSuccess: focusHeading,
    hasPendingInput: () => {
      const v = addForm.getValues();
      return v.name.trim() !== '' || v.phone.trim() !== '' || list.hasPendingEdit();
    },
    discardPendingInput: () => addForm.reset(),
  });
  const search = mountSearch({ section: byId('search-section'), notice: byId('search-notice'), store, announcer });

  const addForm = createContactForm({
    idPrefix: 'add',
    submitLabel: MSG.addSubmit,
    onSubmit: (values) => {
      const r = store.addContact(values);
      if (r.ok) {
        addForm.reset();
        search.clearNotice();
        if (!r.saved) announcer.alert(MSG.notSaved); // never claim success (FR-46)
        if (r.hiddenBySearch) search.showHiddenNotice(r.saved); // visible and announced (DR-17)
        else if (r.saved) announcer.announce(MSG.contactAdded);
        applyFocus(focusPlan('add-success'), (p) => resolveFocus(p));
      } else if ('errors' in r) {
        addForm.setErrors(r.errors);
        announcer.alert(fixErrors(Object.values(r.errors).filter((m): m is string => !!m)));
        applyFocus(focusPlan('add-invalid', { errors: r.errors }), (p) => resolveFocus(p));
      } else {
        announcer.alert(MSG.blocked);
      }
    },
  });
  byId('add-section').append(addForm.element);

  // Disable the Add control (with a visible reason) while mutations are
  // blocked, and clear it as soon as the block condition lifts (CR-12).
  const updateAddBlock = () => {
    const block = store.mutationBlock();
    addForm.setBlocked(block ? blockedReasonText(block) : null);
  };
  store.subscribe(updateAddBlock);
  updateAddBlock();

  store.init();
  watchOtherTabs(store);
}

start();

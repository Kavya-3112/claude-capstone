/**
 * Contact list, empty state, inline edit and delete orchestration
 * (T-14, T-16, T-17). Rendering uses createElement and textContent only.
 *
 * Re-rendering rebuilds the list region, so an in-progress edit is kept in a
 * draft (values, errors) and the focused control is restored by a data key.
 * Focus after each action follows focusPlan() in announcer.ts.
 */
import type { Announcer, FocusPlan } from './announcer';
import { applyFocus, focusPlan } from './announcer';
import { confirmDelete } from './confirmDialog';
import { el } from './dom';
import { createContactForm, type ContactFormHandle } from './form';
import { MSG, blockedReasonText, deleteAria, editAria, fixErrors } from './messages';
import type { MutationBlock, Store } from '../state/store';
import type { Contact, FieldErrors } from '../storage/schema';

export interface ListDeps {
  region: HTMLElement;
  store: Store;
  announcer: Announcer;
}

interface Draft {
  id: string;
  name: string;
  phone: string;
  errors: FieldErrors;
}

/** Maps a focus plan to a real element, or null if it no longer exists. */
export function resolveFocus(plan: FocusPlan, root: ParentNode = document): HTMLElement | null {
  const q = (sel: string, from: ParentNode | null = root) => from?.querySelector<HTMLElement>(sel) ?? null;
  const row = plan.contactId ? q(`li[data-id="${CSS.escape(plan.contactId)}"]`) : null;
  switch (plan.target) {
    case 'add-name-field':
      return q('#add-name');
    case 'add-phone-field':
      return q('#add-phone');
    case 'edit-name-field':
      return q('#edit-name', row);
    case 'edit-phone-field':
      return q('#edit-phone', row);
    case 'edit-trigger':
      return q('[data-action="edit"]', row);
    case 'delete-trigger':
      return q('[data-action="delete"]', row);
    case 'list-heading':
      return q('#list-heading');
    case 'delete-dialog-cancel':
      return q('[data-action="dialog-cancel"]');
  }
}

export function mountList(deps: ListDeps): { render(): void; hasPendingEdit(): boolean } {
  const { region, store, announcer } = deps;
  let draft: Draft | null = null;
  let lastContacts: unknown = null;
  let lastEditing: string | null | undefined = undefined;
  let lastQuery: string | null = null;
  let lastBlock: MutationBlock | null | undefined = undefined;
  let editForm: ContactFormHandle | null = null;

  const focusPlanTo = (plan: FocusPlan) => {
    // If the specific target is gone (for example a row after a failed re-render), fall back to the heading.
    if (!applyFocus(plan, (p) => resolveFocus(p))) applyFocus({ target: 'list-heading' }, (p) => resolveFocus(p));
  };

  function reportNotSaved() {
    announcer.alert(MSG.notSaved);
  }

  function reportBlocked() {
    announcer.alert(MSG.blocked);
  }

  function submitEdit(id: string, values: { name: string; phone: string }) {
    const r = store.editContact(id, values);
    if (r.ok) {
      draft = null;
      if (r.saved) announcer.announce(MSG.contactUpdated);
      else reportNotSaved();
      focusPlanTo(focusPlan('edit-success', { contactId: id }));
      return;
    }
    if ('errors' in r) {
      draft = { id, name: values.name, phone: values.phone, errors: r.errors };
      editForm?.setErrors(r.errors);
      announcer.alert(fixErrors(Object.values(r.errors).filter((m): m is string => !!m)));
      focusPlanTo(focusPlan('edit-invalid', { contactId: id, errors: r.errors }));
      return;
    }
    if ('notFound' in r) announcer.alert(MSG.notFound);
    else reportBlocked();
  }

  function cancelEdit(id: string) {
    draft = null;
    store.cancelEdit();
    focusPlanTo(focusPlan('edit-cancel', { contactId: id }));
  }

  function startDelete(contact: Contact) {
    confirmDelete({
      contact,
      onCancel: () => focusPlanTo(focusPlan('delete-cancel', { contactId: contact.id })),
      onConfirm: () => {
        const r = store.deleteContact(contact.id);
        if (r.ok) {
          if (r.saved) announcer.announce(MSG.contactDeleted);
          else reportNotSaved();
          focusPlanTo(focusPlan('delete-confirmed'));
        } else if ('notFound' in r) {
          announcer.alert(MSG.notFound);
          focusPlanTo(focusPlan('delete-confirmed'));
        } else {
          reportBlocked();
          focusPlanTo(focusPlan('delete-cancel', { contactId: contact.id }));
        }
      },
    });
  }

  function buildItem(contact: Contact, editing: boolean, block: MutationBlock | null): HTMLLIElement {
    const li = el('li', { class: 'contact-item', attrs: { 'data-id': contact.id } });
    if (editing) {
      const d = draft && draft.id === contact.id ? draft : { id: contact.id, name: contact.name, phone: contact.phone, errors: {} };
      draft = d;
      editForm = createContactForm({
        idPrefix: 'edit',
        submitLabel: MSG.editSubmit,
        initial: { name: d.name, phone: d.phone },
        errors: d.errors,
        onSubmit: (v) => submitEdit(contact.id, v),
        onCancel: () => cancelEdit(contact.id),
        onInput: (v) => {
          if (draft) {
            draft.name = v.name;
            draft.phone = v.phone;
          }
        },
      });
      editForm.element.setAttribute('aria-label', MSG.editFormLabel);
      editForm.element.classList.add('edit-form');
      // Normally unreachable (starting an edit is itself blocked), but a tab can
      // go stale while an edit it already has open stays visible (decision 11, 16).
      editForm.setBlocked(block ? blockedReasonText(block) : null);
      li.classList.add('contact-item-editing');
      li.append(editForm.element);
      return li;
    }
    const editBtn = el('button', {
      class: 'btn btn-secondary',
      text: MSG.edit,
      attrs: { type: 'button', 'data-action': 'edit', 'data-focus-key': `edit:${contact.id}`, 'aria-label': editAria(contact.name) },
    });
    const delBtn = el('button', {
      class: 'btn btn-secondary',
      text: MSG.del,
      attrs: { type: 'button', 'data-action': 'delete', 'data-focus-key': `delete:${contact.id}`, 'aria-label': deleteAria(contact.name) },
    });
    editBtn.disabled = block !== null;
    delBtn.disabled = block !== null;
    editBtn.addEventListener('click', () => {
      if (store.startEdit(contact.id)) {
        // startEdit notified listeners, so the form is already rendered.
        focusPlanTo(focusPlan('edit-open', { contactId: contact.id }));
      } else {
        reportBlocked();
      }
    });
    delBtn.addEventListener('click', () => startDelete(contact));
    li.append(
      el('div', { class: 'contact-details' }, [
        el('div', { class: 'contact-name', text: contact.name }),
        el('div', { class: 'contact-phone', text: contact.phone }),
      ]),
      el('div', { class: 'btn-row' }, [editBtn, delBtn]),
    );
    return li;
  }

  function render() {
    const state = store.getState();
    const block = store.mutationBlock();
    if (
      state.contacts === lastContacts &&
      state.editingId === lastEditing &&
      state.query === lastQuery &&
      block === lastBlock
    )
      return;
    lastContacts = state.contacts;
    lastEditing = state.editingId;
    lastQuery = state.query;
    lastBlock = block;

    // Remember focus so a re-render does not drop it.
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active && region.contains(active) ? active.getAttribute('data-focus-key') ?? (active.id || null) : null;
    const caretStart = active instanceof HTMLInputElement ? active.selectionStart : null;
    const caretEnd = active instanceof HTMLInputElement ? active.selectionEnd : null;

    if (state.editingId === null) draft = null;
    editForm = null;
    region.replaceChildren();

    let visible = store.visibleContacts();
    // An open edit stays on screen even if a later search would hide that contact,
    // so typed input is not lost (ambiguity reported for T-18).
    if (state.editingId !== null && !visible.some((c) => c.id === state.editingId)) {
      const pinned = state.contacts.find((c) => c.id === state.editingId);
      if (pinned) visible = [...visible, pinned].sort((a, b) => b.createdSeq - a.createdSeq);
    }
    // Visible reason for the Edit/Delete controls below (CR-12); search is
    // deliberately exempt (decision 7) and is not inside this region.
    if (block) {
      region.append(el('p', { class: 'notice', text: blockedReasonText(block), attrs: { 'data-role': 'list-blocked-reason' } }));
    }

    if (state.contacts.length === 0) {
      region.append(el('p', { class: 'empty-state', text: MSG.emptyState }));
    } else if (visible.length === 0) {
      region.append(el('p', { class: 'no-match', text: MSG.noMatch }));
    } else {
      const ul = el('ul', { class: 'contact-list' });
      for (const c of visible) ul.append(buildItem(c, c.id === state.editingId, block));
      region.append(ul);
    }

    if (focusKey) {
      const target = region.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(focusKey)}"]`) ?? region.querySelector<HTMLElement>(`#${CSS.escape(focusKey)}`);
      if (target) {
        target.focus();
        if (target instanceof HTMLInputElement && caretStart !== null && caretEnd !== null) {
          target.setSelectionRange(caretStart, caretEnd);
        }
      }
    }
  }

  store.subscribe(render);
  render();
  /** True when an open edit holds text that differs from the saved contact (a reload would discard it). */
  function hasPendingEdit(): boolean {
    if (!draft) return false;
    const saved = store.getState().contacts.find((c) => c.id === draft?.id);
    return !!saved && (saved.name !== draft.name || saved.phone !== draft.phone);
  }

  return { render, hasPendingEdit };
}

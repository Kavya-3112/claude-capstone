/**
 * Modal choice dialogs (T-17 delete confirmation, T-21 reload prompt). Uses a
 * native modal <dialog>: the browser makes the rest of the page inert and
 * closes on Escape (treated as the safe choice). The safe choice is first and
 * has default focus (FR-25). Text is inserted with textContent only.
 */
import type { Contact } from '../storage/schema';
import { el } from './dom';
import { MSG, dialogBody } from './messages';

export interface ChoiceDialogOptions {
  title: string;
  body: string;
  /** The safe choice; it has default focus and is what Escape means. */
  safeLabel: string;
  actionLabel: string;
  danger?: boolean;
  onAction: () => void;
  /** Safe button, Escape, or any other close without the action. */
  onSafe: () => void;
}

export function showChoiceDialog(opts: ChoiceDialogOptions): HTMLDialogElement {
  const safeBtn = el('button', {
    class: 'btn btn-secondary',
    text: opts.safeLabel,
    attrs: { type: 'button', 'data-action': 'dialog-cancel' },
  });
  const actionBtn = el('button', {
    class: opts.danger ? 'btn btn-danger' : 'btn',
    text: opts.actionLabel,
    attrs: { type: 'button', 'data-action': 'dialog-confirm' },
  });
  const dialog = el(
    'dialog',
    { class: 'confirm-dialog', attrs: { 'aria-labelledby': 'confirm-title', 'aria-describedby': 'confirm-body' } },
    [
      el('h2', { text: opts.title, attrs: { id: 'confirm-title' } }),
      el('p', { text: opts.body, attrs: { id: 'confirm-body' } }),
      el('div', { class: 'btn-row' }, [safeBtn, actionBtn]),
    ],
  );

  // Native modal dialogs make the page inert, but Tab can still leave to browser
  // chrome; wrap focus between the two buttons so the dialog is a real trap.
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === safeBtn) {
      e.preventDefault();
      actionBtn.focus();
    } else if (!e.shiftKey && document.activeElement === actionBtn) {
      e.preventDefault();
      safeBtn.focus();
    }
  });

  safeBtn.addEventListener('click', () => dialog.close('cancel'));
  actionBtn.addEventListener('click', () => dialog.close('confirm'));
  dialog.addEventListener('close', () => {
    const confirmed = dialog.returnValue === 'confirm';
    dialog.remove();
    if (confirmed) opts.onAction();
    else opts.onSafe();
  });

  document.body.append(dialog);
  dialog.showModal();
  safeBtn.focus();
  return dialog;
}

export interface ConfirmDeleteOptions {
  contact: Contact;
  onConfirm: () => void;
  /** Cancel button, Escape, or any other close without confirming. */
  onCancel: () => void;
}

export function confirmDelete(opts: ConfirmDeleteOptions): HTMLDialogElement {
  return showChoiceDialog({
    title: MSG.dialogTitle,
    body: dialogBody(opts.contact.name, opts.contact.phone),
    safeLabel: MSG.cancel,
    actionLabel: MSG.dialogConfirm,
    danger: true,
    onAction: opts.onConfirm,
    onSafe: opts.onCancel,
  });
}

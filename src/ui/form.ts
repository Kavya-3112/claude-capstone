/**
 * Contact form used for both add (T-15) and edit (T-16). Same fields and the
 * same validators (FR-49); the caller supplies the submit handler.
 * Labels, aria-describedby and aria-invalid give accessible errors (NFR-03).
 * No HTML `maxlength`: over-length input must be rejected with a message, not
 * silently truncated (FR-48). No duplicate-phone warning (FR-56).
 */
import type { FieldErrors } from '../storage/schema';
import { el } from './dom';
import { MSG } from './messages';

export interface ContactValues {
  name: string;
  phone: string;
}

export interface ContactFormOptions {
  idPrefix: 'add' | 'edit';
  submitLabel: string;
  initial?: ContactValues;
  errors?: FieldErrors;
  /** Present for edit: renders a Cancel button and handles Escape. */
  onCancel?: () => void;
  onSubmit: (values: ContactValues) => void;
  /** Called on every keystroke (lets the list keep an edit draft across re-renders). */
  onInput?: (values: ContactValues) => void;
}

export interface ContactFormHandle {
  element: HTMLFormElement;
  getValues(): ContactValues;
  reset(): void;
  setErrors(errors: FieldErrors): void;
  focusField(field: 'name' | 'phone'): void;
  /**
   * Disables the submit button and shows a visible reason next to it when
   * `reason` is non-null (CR-12); re-enables and hides the reason when null.
   * Cancel (if present) stays enabled so an open edit can still be cancelled.
   */
  setBlocked(reason: string | null): void;
}

export function createContactForm(opts: ContactFormOptions): ContactFormHandle {
  const p = opts.idPrefix;
  const nameInput = el('input', {
    attrs: { type: 'text', id: `${p}-name`, name: 'name', autocomplete: 'name' },
  });
  const phoneInput = el('input', {
    attrs: {
      type: 'tel',
      id: `${p}-phone`,
      name: 'phone',
      autocomplete: 'tel',
      'aria-describedby': `${p}-phone-hint`,
    },
  });
  const nameError = el('p', { class: 'field-error', attrs: { id: `${p}-name-error` } });
  const phoneError = el('p', { class: 'field-error', attrs: { id: `${p}-phone-error` } });
  nameError.hidden = true;
  phoneError.hidden = true;

  const form = el('form', { attrs: { novalidate: '' } }, [
    el('div', { class: 'field' }, [
      el('label', { text: MSG.nameLabel, attrs: { for: `${p}-name` } }),
      nameInput,
      nameError,
    ]),
    el('div', { class: 'field' }, [
      el('label', { text: MSG.phoneLabel, attrs: { for: `${p}-phone` } }),
      el('p', { class: 'hint', text: MSG.phoneHint, attrs: { id: `${p}-phone-hint` } }),
      phoneInput,
      phoneError,
    ]),
  ]);
  const submitBtn = el('button', { class: 'btn', text: opts.submitLabel, attrs: { type: 'submit' } });
  const buttons = el('div', { class: 'btn-row' }, [
    submitBtn,
    opts.onCancel
      ? el('button', { class: 'btn btn-secondary', text: MSG.cancel, attrs: { type: 'button', 'data-action': 'cancel' } })
      : null,
  ]);
  const blockedReason = el('p', { class: 'notice', attrs: { 'data-role': 'blocked-reason' } });
  blockedReason.hidden = true;
  form.append(blockedReason, buttons);

  const getValues = (): ContactValues => ({ name: nameInput.value, phone: phoneInput.value });

  function setField(
    input: HTMLInputElement,
    errEl: HTMLElement,
    message: string | undefined,
    extraDescribedBy: string | null,
  ) {
    const ids = [extraDescribedBy, message ? errEl.id : null].filter(Boolean).join(' ');
    if (ids) input.setAttribute('aria-describedby', ids);
    else input.removeAttribute('aria-describedby');
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      errEl.textContent = message;
      errEl.hidden = false;
    } else {
      input.removeAttribute('aria-invalid');
      errEl.textContent = '';
      errEl.hidden = true;
    }
  }

  function setErrors(errors: FieldErrors) {
    setField(nameInput, nameError, errors.name, null);
    setField(phoneInput, phoneError, errors.phone, `${p}-phone-hint`);
  }

  if (opts.initial) {
    nameInput.value = opts.initial.name;
    phoneInput.value = opts.initial.phone;
  }
  setErrors(opts.errors ?? {});

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    opts.onSubmit(getValues());
  });
  for (const input of [nameInput, phoneInput]) {
    input.addEventListener('input', () => opts.onInput?.(getValues()));
  }
  const cancel = opts.onCancel;
  if (cancel) {
    form.querySelector('[data-action="cancel"]')!.addEventListener('click', () => cancel());
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });
  }

  return {
    element: form,
    getValues,
    reset() {
      nameInput.value = '';
      phoneInput.value = '';
      setErrors({});
    },
    setErrors,
    focusField(field) {
      (field === 'name' ? nameInput : phoneInput).focus();
    },
    setBlocked(reason) {
      submitBtn.disabled = reason !== null;
      if (reason !== null) {
        blockedReason.textContent = reason;
        blockedReason.hidden = false;
      } else {
        blockedReason.textContent = '';
        blockedReason.hidden = true;
      }
    },
  };
}

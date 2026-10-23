/**
 * Live-region announcer and focus rules (T-12; NFR-02..NFR-05).
 *
 * The two regions (`aria-live="polite"` for updates, `role="alert"`
 * for errors, which implies assertive; CR-09) live in index.html so they exist before
 * their content changes, which assistive technologies need to announce
 * reliably. This module only writes text into them. Message wording is chosen
 * by the feature tasks (T-14 onward); nothing here fixes wording.
 */
import type { FieldErrors } from '../storage/schema';

/** The part of an element the announcer needs. */
export interface LiveRegion {
  textContent: string | null;
}

export type Scheduler = (fn: () => void, ms: number) => unknown;

export interface Announcer {
  /** Non-urgent update (polite). */
  announce(message: string): void;
  /** Error or urgent message (assertive). */
  alert(message: string): void;
  clear(): void;
}

/**
 * Setting identical text twice is not re-announced by most screen readers, so
 * the region is emptied first and the text set on a short delay.
 */
export function createAnnouncer(
  polite: LiveRegion,
  assertive: LiveRegion,
  schedule: Scheduler = (fn, ms) => setTimeout(fn, ms),
  delayMs = 50,
): Announcer {
  const timers = new Map<LiveRegion, number>();
  let generation = 0;
  const write = (region: LiveRegion, message: string) => {
    const mine = ++generation;
    timers.set(region, mine);
    region.textContent = '';
    if (message === '') return;
    schedule(() => {
      // Ignore if a newer message or clear() replaced this one.
      if (timers.get(region) === mine) region.textContent = message;
    }, delayMs);
  };
  return {
    announce: (m) => write(polite, m),
    alert: (m) => write(assertive, m),
    clear: () => {
      write(polite, '');
      write(assertive, '');
    },
  };
}

// ---- Focus rules --------------------------------------------------------

/** Logical focus destinations. The UI maps each to a real element. */
export type FocusTarget =
  | 'add-name-field'
  | 'add-phone-field'
  | 'edit-name-field'
  | 'edit-phone-field'
  | 'edit-trigger'
  | 'delete-trigger'
  | 'delete-dialog-cancel'
  | 'list-heading';

export type FocusAction =
  | 'add-success'
  | 'add-invalid'
  | 'edit-open'
  | 'edit-invalid'
  | 'edit-success'
  | 'edit-cancel'
  | 'delete-open'
  | 'delete-cancel'
  | 'delete-confirmed';

export interface FocusPlan {
  target: FocusTarget;
  /** Set when the target belongs to a specific contact row. */
  contactId?: string;
}

/**
 * Where focus goes after each action. Rules:
 * - Invalid input: the first invalid field (name before phone).
 * - Add success: back to the name field, ready for the next entry.
 * - Opening edit: the edit form's name field.
 * - Edit success or cancel: the edit trigger of that contact (architecture section 6).
 * - Opening delete: the dialog's Cancel button (safe default, FR-25).
 * - Cancelling delete: the delete trigger that opened the dialog.
 * - Confirmed delete: the list heading, because the trigger no longer exists.
 */
export function focusPlan(
  action: FocusAction,
  ctx: { errors?: FieldErrors; contactId?: string } = {},
): FocusPlan {
  const inForm = (prefix: 'add' | 'edit'): FocusTarget => {
    const phoneOnly = ctx.errors?.phone !== undefined && ctx.errors.name === undefined;
    return phoneOnly ? (`${prefix}-phone-field` as FocusTarget) : (`${prefix}-name-field` as FocusTarget);
  };
  switch (action) {
    case 'add-success':
      return { target: 'add-name-field' };
    case 'add-invalid':
      return { target: inForm('add') };
    case 'edit-open':
      return { target: 'edit-name-field', contactId: ctx.contactId };
    case 'edit-invalid':
      return { target: inForm('edit'), contactId: ctx.contactId };
    case 'edit-success':
    case 'edit-cancel':
      return { target: 'edit-trigger', contactId: ctx.contactId };
    case 'delete-open':
      return { target: 'delete-dialog-cancel', contactId: ctx.contactId };
    case 'delete-cancel':
      return { target: 'delete-trigger', contactId: ctx.contactId };
    case 'delete-confirmed':
      return { target: 'list-heading' };
  }
}

export interface Focusable {
  focus(): void;
}

/** Focuses an element if it exists. Returns whether focus was moved. Never throws. */
export function focusElement(el: Focusable | null | undefined): boolean {
  if (!el) return false;
  try {
    el.focus();
    return true;
  } catch {
    return false;
  }
}

/** Resolves a plan through a lookup supplied by the UI and focuses it. */
export function applyFocus(
  plan: FocusPlan,
  resolve: (plan: FocusPlan) => Focusable | null | undefined,
): boolean {
  return focusElement(resolve(plan));
}

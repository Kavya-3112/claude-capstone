import { describe, it, expect } from 'vitest';
import { applyFocus, createAnnouncer, focusElement, focusPlan } from '../../src/ui/announcer';

function setup() {
  const polite = { textContent: '' as string | null };
  const assertive = { textContent: '' as string | null };
  const queue: Array<() => void> = [];
  const a = createAnnouncer(polite, assertive, (fn) => queue.push(fn));
  const flush = () => queue.splice(0).forEach((f) => f());
  return { polite, assertive, a, flush };
}

describe('announcer (T-12)', () => {
  it('announce writes to the polite region only, after the region was emptied', () => {
    const { polite, assertive, a, flush } = setup();
    polite.textContent = 'old';
    a.announce('Updated');
    expect(polite.textContent).toBe('');
    flush();
    expect(polite.textContent).toBe('Updated');
    expect(assertive.textContent).toBe('');
  });
  it('alert writes to the assertive region only', () => {
    const { polite, assertive, a, flush } = setup();
    a.alert('Error');
    flush();
    expect(assertive.textContent).toBe('Error');
    expect(polite.textContent).toBe('');
  });
  it('repeating the same message re-triggers the announcement', () => {
    const { polite, a, flush } = setup();
    a.announce('Same');
    flush();
    a.announce('Same');
    expect(polite.textContent).toBe(''); // emptied again so the repeat is announced
    flush();
    expect(polite.textContent).toBe('Same');
  });
  it('a newer message supersedes a pending older one', () => {
    const { polite, a, flush } = setup();
    a.announce('First');
    a.announce('Second');
    flush();
    expect(polite.textContent).toBe('Second');
  });
  it('clear empties both regions and cancels pending text', () => {
    const { polite, assertive, a, flush } = setup();
    a.announce('x');
    a.alert('y');
    a.clear();
    flush();
    expect(polite.textContent).toBe('');
    expect(assertive.textContent).toBe('');
  });
  it('works with the default scheduler', async () => {
    const polite = { textContent: '' as string | null };
    const a = createAnnouncer(polite, { textContent: '' }, undefined, 1);
    a.announce('Hi');
    await new Promise((r) => setTimeout(r, 20));
    expect(polite.textContent).toBe('Hi');
  });
});

describe('focus rules (T-12; NFR-02, NFR-04)', () => {
  it('add: success returns to the name field; invalid focuses the first invalid field', () => {
    expect(focusPlan('add-success')).toEqual({ target: 'add-name-field' });
    expect(focusPlan('add-invalid', { errors: { name: 'x', phone: 'y' } }).target).toBe('add-name-field');
    expect(focusPlan('add-invalid', { errors: { name: 'x' } }).target).toBe('add-name-field');
    expect(focusPlan('add-invalid', { errors: { phone: 'y' } }).target).toBe('add-phone-field');
  });
  it('edit: open, invalid, success and cancel', () => {
    expect(focusPlan('edit-open', { contactId: 'c1' })).toEqual({ target: 'edit-name-field', contactId: 'c1' });
    expect(focusPlan('edit-invalid', { contactId: 'c1', errors: { phone: 'y' } })).toEqual({
      target: 'edit-phone-field',
      contactId: 'c1',
    });
    expect(focusPlan('edit-success', { contactId: 'c1' })).toEqual({ target: 'edit-trigger', contactId: 'c1' });
    expect(focusPlan('edit-cancel', { contactId: 'c1' })).toEqual({ target: 'edit-trigger', contactId: 'c1' });
  });
  it('delete: dialog defaults to Cancel; cancel returns to the trigger; confirm goes to the list heading', () => {
    expect(focusPlan('delete-open', { contactId: 'c1' }).target).toBe('delete-dialog-cancel');
    expect(focusPlan('delete-cancel', { contactId: 'c1' })).toEqual({ target: 'delete-trigger', contactId: 'c1' });
    expect(focusPlan('delete-confirmed', { contactId: 'c1' })).toEqual({ target: 'list-heading' });
  });
  it('focusElement focuses when present and never throws', () => {
    let focused = 0;
    expect(focusElement({ focus: () => focused++ })).toBe(true);
    expect(focused).toBe(1);
    expect(focusElement(null)).toBe(false);
    expect(focusElement(undefined)).toBe(false);
    expect(
      focusElement({
        focus: () => {
          throw new Error('detached');
        },
      }),
    ).toBe(false);
  });
  it('applyFocus resolves the plan through the supplied lookup', () => {
    let got = '';
    const ok = applyFocus(focusPlan('edit-cancel', { contactId: 'c9' }), (p) => ({
      focus: () => {
        got = p.target + ':' + p.contactId;
      },
    }));
    expect(ok).toBe(true);
    expect(got).toBe('edit-trigger:c9');
    expect(applyFocus(focusPlan('add-success'), () => null)).toBe(false);
  });
});

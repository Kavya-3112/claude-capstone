import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const KEY = 'contacts.v1';

async function add(page: Page, name: string, phone = '5551234567') {
  await page.locator('#add-name').fill(name);
  await page.locator('#add-phone').fill(phone);
  await page.getByRole('button', { name: 'Add contact' }).click();
}
const names = (page: Page) => page.locator('.contact-name').allTextContents();
const banner = (page: Page) => page.locator('#banner-region');
const storedNames = (page: Page) =>
  page.evaluate((k) => (JSON.parse(localStorage.getItem(k) ?? '{"contacts":[]}').contacts as Array<{ name: string }>).map((c) => c.name), KEY);

async function twoTabs(context: BrowserContext) {
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto('/');
  await b.goto('/');
  return { a, b };
}

test.describe('T-21 two tabs', () => {
  test('tab B warns when tab A changes data; B cannot overwrite; A\'s change survives; Reload shows it', async ({ context }) => {
    const { a, b } = await twoTabs(context);
    await add(a, 'FromA');
    await expect(banner(b)).toBeVisible(); // storage event
    await expect(banner(b)).toContainText('Another tab changed your contacts.');
    await expect(banner(b).getByRole('button', { name: 'Reload contacts' })).toBeVisible();
    await expect(banner(b).getByRole('button', { name: 'Retry saving' })).toHaveCount(0);
    await expect(b.locator('#live-assertive')).toContainText('Another tab changed your contacts');

    // Add is disabled while stale (decision 11), with a visible reason near the control (CR-12).
    const addBtnB = b.getByRole('button', { name: 'Add contact' });
    await expect(addBtnB).toBeDisabled();
    await expect(b.locator('#add-section [data-role="blocked-reason"]')).toHaveText(
      'Add, edit and delete are turned off until you reload the contacts (see the message above).',
    );
    await b.locator('#add-name').fill('FromB');
    await b.locator('#add-phone').fill('5551234567');
    expect(await storedNames(a)).toEqual(['FromA']);

    // the pending add text counts as pending input, so clear it first
    await b.locator('#add-name').fill('');
    await b.locator('#add-phone').fill('');
    await banner(b).getByRole('button', { name: 'Reload contacts' }).click(); // nothing pending: no prompt
    await expect(b.getByRole('dialog')).toHaveCount(0);
    await expect(banner(b)).toBeHidden();
    expect(await names(b)).toEqual(['FromA']);
    await expect(b.locator('#live-polite')).toHaveText('Contacts reloaded.');
    await add(b, 'FromB');
    expect(await storedNames(a)).toEqual(['FromA', 'FromB']);
  });

  test('a save attempt without any event is refused as stale and shows the unsaved variant', async ({ page }) => {
    await page.goto('/');
    await add(page, 'Alice');
    // Change storage from inside this tab: no storage event reaches the writer.
    await page.evaluate((k) => {
      localStorage.setItem(k, JSON.stringify({ version: 1, nextSeq: 1, contacts: [{ id: 'z', name: 'Sneaky', phone: '5550001111', createdSeq: 0, createdAt: '' }] }));
    }, KEY);
    await expect(banner(page)).toBeHidden();
    await add(page, 'Mine'); // the pre-write check catches it
    await expect(banner(page)).toContainText('Not saved. Another tab changed your contacts.');
    expect(await storedNames(page)).toEqual(['Sneaky']);
    expect(await names(page)).toContain('Mine'); // the change stays visible
  });

  test('window focus re-check catches a change the storage event did not report', async ({ page }) => {
    await page.goto('/');
    await add(page, 'Alice');
    await page.evaluate((k) => {
      localStorage.setItem(k, JSON.stringify({ version: 1, nextSeq: 1, contacts: [{ id: 'z', name: 'Other', phone: '5550001111', createdSeq: 0, createdAt: '' }] }));
    }, KEY);
    await expect(banner(page)).toBeHidden(); // writer tab gets no storage event
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(banner(page)).toContainText('Another tab changed your contacts.');
  });

  test('clearing storage in another tab also warns', async ({ context }) => {
    const { a, b } = await twoTabs(context);
    await add(a, 'FromA');
    await expect(banner(b)).toBeVisible();
    await b.getByRole('button', { name: 'Reload contacts' }).click();
    await a.evaluate(() => localStorage.clear());
    await expect(banner(b)).toBeVisible();
  });

  test('Reload with a pending edit asks first; Keep editing keeps the typed text', async ({ context }) => {
    const { a, b } = await twoTabs(context);
    await add(b, 'Bob');
    await b.getByRole('button', { name: 'Edit Bob' }).click();
    await b.locator('#edit-name').fill('Typed in B');
    await a.reload();
    await add(a, 'FromA');
    await expect(banner(b)).toBeVisible();
    await banner(b).getByRole('button', { name: 'Reload contacts' }).click();
    const dialog = b.getByRole('dialog', { name: 'Reload and lose your changes?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(banner(b).getByRole('button', { name: 'Reload contacts' })).toBeFocused();
    await expect(b.locator('#edit-name')).toHaveValue('Typed in B');
    // Saving the pending edit is still refused while stale: Save is disabled
    // with a visible reason inside the open edit form (decision 11; CR-12).
    const saveBtn = b.getByRole('button', { name: 'Save changes' });
    await expect(saveBtn).toBeDisabled();
    await expect(b.locator('.edit-form [data-role="blocked-reason"]')).toHaveText(
      'Add, edit and delete are turned off until you reload the contacts (see the message above).',
    );
  });

  test('Reload and discard loads the newer data and drops the pending input', async ({ context }) => {
    const { a, b } = await twoTabs(context);
    await add(a, 'FromA');
    await expect(banner(b)).toBeVisible();
    await b.locator('#add-name').fill('Half typed');
    await banner(b).getByRole('button', { name: 'Reload contacts' }).click();
    const dialog = b.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Reload and discard' }).click();
    await expect(banner(b)).toBeHidden();
    expect(await names(b)).toEqual(['FromA']);
    await expect(b.locator('#add-name')).toHaveValue('');
    expect(await storedNames(a)).toEqual(['FromA']);
  });

  test('Escape in the prompt means Keep editing; nothing is discarded', async ({ context }) => {
    const { a, b } = await twoTabs(context);
    await add(a, 'FromA');
    await expect(banner(b)).toBeVisible();
    await b.locator('#add-phone').fill('555');
    await banner(b).getByRole('button', { name: 'Reload contacts' }).click();
    await b.keyboard.press('Escape');
    await expect(b.getByRole('dialog')).toHaveCount(0);
    await expect(b.locator('#add-phone')).toHaveValue('555');
    await expect(banner(b)).toBeVisible();
  });

  test('unsaved changes also trigger the prompt, so they are never discarded silently', async ({ context }) => {
    const { a, b } = await twoTabs(context);
    await b.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('full', 'QuotaExceededError');
      };
    });
    await add(b, 'Unsaved');
    await add(a, 'FromA');
    await expect(banner(b)).toContainText('Another tab changed your contacts.');
    await banner(b).getByRole('button', { name: 'Reload contacts' }).click();
    await expect(b.getByRole('dialog', { name: 'Reload and lose your changes?' })).toBeVisible();
  });

  for (const [label, width] of [
    ['320 px', 320],
    ['desktop', 1280],
  ] as const) {
    test(`axe: stale banner and reload prompt at ${label}`, async ({ context }) => {
      const { a, b } = await twoTabs(context);
      await b.setViewportSize({ width, height: 800 });
      await add(a, 'FromA');
      await expect(banner(b)).toBeVisible();
      const run = () =>
        new AxeBuilder({ page: b }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect((await run()).violations).toEqual([]);
      expect(await b.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      await b.locator('#add-name').fill('pending');
      await banner(b).getByRole('button', { name: 'Reload contacts' }).click();
      await expect(b.getByRole('dialog')).toBeVisible();
      expect((await run()).violations).toEqual([]);
    });
  }
});

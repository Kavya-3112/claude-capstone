import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const KEY = 'contacts.v1';

async function add(page: Page, name: string, phone = '5551234567') {
  await page.locator('#add-name').fill(name);
  await page.locator('#add-phone').fill(phone);
  await page.getByRole('button', { name: 'Add contact' }).click();
}
const names = (page: Page) => page.locator('.contact-name').allTextContents();
const row = (page: Page, name: string) => page.locator('li.contact-item', { hasText: name });
const banner = (page: Page) => page.locator('#banner-region');

/** Makes writes fail (quota or security) until restoreWrites() is called. */
async function breakWrites(page: Page, kind: 'QuotaExceededError' | 'SecurityError' = 'QuotaExceededError') {
  await page.evaluate((name) => {
    const w = window as unknown as { __origSet?: typeof Storage.prototype.setItem };
    w.__origSet ??= Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('injected', name);
    };
  }, kind);
}
async function restoreWrites(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __origSet?: typeof Storage.prototype.setItem };
    if (w.__origSet) Storage.prototype.setItem = w.__origSet;
  });
}
const storedNames = (page: Page) =>
  page.evaluate((k) => (JSON.parse(localStorage.getItem(k) ?? '{"contacts":[]}').contacts as Array<{ name: string }>).map((c) => c.name), KEY);

test.describe('T-19 save-status banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('no banner when everything saves, and the region stays hidden', async ({ page }) => {
    await add(page, 'Alice');
    await expect(banner(page)).toBeHidden();
  });

  test('a failed add shows the banner with Retry, keeps the contact, and shows no success text', async ({ page }) => {
    await breakWrites(page);
    await add(page, 'Alice');
    expect(await names(page)).toEqual(['Alice']);
    await expect(banner(page)).toBeVisible();
    await expect(banner(page)).toContainText('Not saved.');
    await expect(banner(page)).toContainText('earlier unsaved');
    await expect(banner(page)).toContainText('reload');
    await expect(banner(page)).toContainText('Browser storage is full.');
    await expect(banner(page).getByRole('button', { name: 'Retry saving' })).toBeVisible();
    await expect(page.locator('#live-polite')).not.toHaveText(/added|saved|updated|deleted/i);
    await expect(page.locator('#live-assertive')).toContainText('Not saved');
  });

  test('edit and delete failures also show the banner and no success', async ({ page }) => {
    await add(page, 'Alice');
    await add(page, 'Bob');
    await breakWrites(page);
    await row(page, 'Bob').getByRole('button', { name: 'Edit Bob' }).click();
    await page.locator('#edit-name').fill('Bobby');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(banner(page)).toBeVisible();
    await expect(page.locator('#live-polite')).not.toHaveText('Contact updated.');

    await row(page, 'Alice').getByRole('button', { name: 'Delete Alice' }).click();
    await page.getByRole('button', { name: 'Delete contact' }).click();
    await expect(banner(page)).toBeVisible();
    await expect(page.locator('#live-polite')).not.toHaveText('Contact deleted.');
    expect(await names(page)).toEqual(['Bobby']);
  });

  test('the banner persists across further actions; Retry while failing keeps it and says so', async ({ page }) => {
    await breakWrites(page);
    await add(page, 'Alice');
    await add(page, 'Bob');
    await expect(banner(page)).toBeVisible();
    const retry = banner(page).getByRole('button', { name: 'Retry saving' });
    await retry.click();
    await expect(banner(page)).toBeVisible();
    await expect(page.locator('#live-assertive')).toHaveText('Still not saved.');
    await expect(retry).toBeFocused();
  });

  test('after storage recovers, Retry saves everything (including earlier changes) and clears the banner', async ({ page }) => {
    await breakWrites(page);
    await add(page, 'Alice');
    await add(page, 'Bob');
    await restoreWrites(page);
    await banner(page).getByRole('button', { name: 'Retry saving' }).click();
    await expect(banner(page)).toBeHidden();
    await expect(page.locator('#live-polite')).toHaveText('All changes are saved.');
    await expect(page.locator('#list-heading')).toBeFocused();
    expect(await storedNames(page)).toEqual(['Alice', 'Bob']);
    await page.reload();
    expect(await names(page)).toEqual(['Bob', 'Alice']);
  });

  test('a later successful action also clears the banner', async ({ page }) => {
    await breakWrites(page);
    await add(page, 'Alice');
    await restoreWrites(page);
    await add(page, 'Bob');
    await expect(banner(page)).toBeHidden();
    expect(await storedNames(page)).toEqual(['Alice', 'Bob']);
  });

  test('a reload loses unsaved changes, as the banner says', async ({ page }) => {
    await breakWrites(page);
    await add(page, 'Alice');
    await page.reload();
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(banner(page)).toBeHidden();
  });

  test('a security error shows its own cause text', async ({ page }) => {
    await breakWrites(page, 'SecurityError');
    await add(page, 'Alice');
    await expect(banner(page)).toContainText('The browser blocked access to storage.');
  });

  for (const [label, width] of [
    ['320 px', 320],
    ['desktop', 1280],
  ] as const) {
    test(`axe: unsaved banner at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await breakWrites(page);
      await add(page, 'Alice');
      await expect(banner(page)).toBeVisible();
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(r.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    });
  }
});

test.describe('T-19 memory-only mode (storage unavailable at load)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __broken: boolean };
      const real = window.localStorage;
      w.__broken = true;
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          if (w.__broken) throw new DOMException('denied', 'SecurityError');
          return real;
        },
      });
    });
    await page.goto('/');
  });
  const fix = (page: Page) => page.evaluate(() => ((window as unknown as { __broken: boolean }).__broken = false));

  test('shows the memory-only banner at load and announces it', async ({ page }) => {
    await expect(banner(page)).toBeVisible();
    await expect(banner(page)).toContainText('Contacts cannot be stored in this browser right now.');
    await expect(banner(page)).toContainText('lost when you close or reload');
    await expect(banner(page).getByRole('button', { name: 'Test storage again' })).toBeVisible();
    await expect(page.locator('#live-assertive')).toContainText('cannot be stored');
  });

  test('contacts can be added in memory, the banner stays, and no success is announced', async ({ page }) => {
    await add(page, 'Alice');
    expect(await names(page)).toEqual(['Alice']);
    await expect(banner(page)).toContainText('Contacts cannot be stored');
    await expect(page.locator('#live-polite')).not.toHaveText('Contact added.');
  });

  test('storage re-test fails while still unavailable, then succeeds and saves once it is back', async ({ page }) => {
    await add(page, 'Alice');
    const btn = banner(page).getByRole('button', { name: 'Test storage again' });
    await btn.click();
    await expect(page.locator('#live-assertive')).toHaveText('Storage is still not available.');
    await expect(banner(page)).toBeVisible();
    await fix(page);
    await btn.click();
    await expect(banner(page)).toBeHidden();
    await expect(page.locator('#live-polite')).toHaveText('All changes are saved.');
    expect(await storedNames(page)).toEqual(['Alice']);
  });

  test('if stored data appeared meanwhile, nothing is overwritten and the stale banner shows', async ({ page }) => {
    await add(page, 'Alice');
    await fix(page);
    const existing = JSON.stringify({
      version: 1,
      nextSeq: 1,
      contacts: [{ id: 'x', name: 'Existing', phone: '5550001111', createdSeq: 0, createdAt: '' }],
    });
    await page.evaluate(([k, v]) => localStorage.setItem(k as string, v as string), [KEY, existing]);
    await banner(page).getByRole('button', { name: 'Test storage again' }).click();
    await expect(banner(page)).toContainText('Another tab changed your contacts');
    await expect(banner(page).getByRole('button', { name: 'Retry saving' })).toHaveCount(0);
    await expect(banner(page).getByRole('button', { name: 'Reload contacts' })).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe(existing);
  });

  test('axe: memory-only banner at 320 px and desktop', async ({ page }) => {
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(r.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    }
  });
});

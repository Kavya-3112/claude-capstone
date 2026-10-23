import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const KEY = 'contacts.v1';

async function add(page: Page, name: string, phone: string) {
  await page.locator('#add-name').fill(name);
  await page.locator('#add-phone').fill(phone);
  await page.getByRole('button', { name: 'Add contact' }).click();
}
const names = (page: Page) => page.locator('.contact-name').allTextContents();
const search = (page: Page, q: string) => page.locator('#search-input').fill(q);
const row = (page: Page, name: string) => page.locator('li.contact-item', { hasText: name });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await add(page, 'Alice', '+1 555-123-4567');
  await add(page, 'ALI Baba', '999-888-7777');
  await add(page, 'Bob', '555-000-1111');
});

test.describe('T-18 search', () => {
  test('there is exactly one search input with a label and hint', async ({ page }) => {
    await expect(page.locator('input[type="search"]')).toHaveCount(1);
    await expect(page.getByLabel('Search contacts')).toBeVisible();
    await expect(page.locator('#search-input')).toHaveAttribute('aria-describedby', 'search-hint');
  });

  test('name search is case-insensitive substring and updates as you type', async ({ page }) => {
    await search(page, 'ali');
    expect(await names(page)).toEqual(['ALI Baba', 'Alice']);
    await search(page, 'ALI');
    expect(await names(page)).toEqual(['ALI Baba', 'Alice']);
    await search(page, 'alic');
    expect(await names(page)).toEqual(['Alice']);
    await expect(page.locator('#live-polite')).toHaveText('1 contact found.');
  });

  test('phone search ignores formatting and a leading +', async ({ page }) => {
    await search(page, '+555'); // leading + ignored: matches both contacts with 555 in the number
    expect(await names(page)).toEqual(['Bob', 'Alice']);
    for (const q of ['555123', '(555) 123', '+555123', '555-123-4567', '4567']) {
      await search(page, q);
      expect(await names(page), q).toEqual(['Alice']);
    }
  });

  test('a query with no digits matches no phones', async ({ page }) => {
    await search(page, '-');
    await expect(page.locator('.no-match')).toBeVisible();
    await search(page, '()');
    await expect(page.locator('.no-match')).toBeVisible();
  });

  test('no-match message is shown and announced; clearing restores the full list', async ({ page }) => {
    await search(page, 'zzz');
    await expect(page.locator('.no-match')).toHaveText(
      'No contacts match your search. Clear the search to see all contacts.',
    );
    await expect(page.locator('li.contact-item')).toHaveCount(0);
    await expect(page.locator('#live-polite')).toHaveText('No contacts match your search.');
    await page.getByRole('button', { name: 'Clear search' }).click();
    expect(await names(page)).toEqual(['Bob', 'ALI Baba', 'Alice']);
    await expect(page.locator('#search-input')).toHaveValue('');
    await expect(page.locator('#search-input')).toBeFocused();
    await expect(page.locator('#live-polite')).toHaveText('Search cleared. All contacts are shown.');
    await expect(page.getByRole('button', { name: 'Clear search' })).toBeHidden();
  });

  test('emptying the input by hand also restores the list', async ({ page }) => {
    await search(page, 'bob');
    expect(await names(page)).toEqual(['Bob']);
    await search(page, '');
    expect(await names(page)).toEqual(['Bob', 'ALI Baba', 'Alice']);
  });

  test('the empty state (no contacts at all) is not replaced by the no-match message', async ({ page }) => {
    for (const n of ['Bob', 'ALI Baba', 'Alice']) {
      await row(page, n).getByRole('button', { name: `Delete ${n}` }).click();
      await page.getByRole('button', { name: 'Delete contact' }).click();
    }
    await search(page, 'x');
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.no-match')).toHaveCount(0);
  });

  test('edit and delete work from filtered results', async ({ page }) => {
    await search(page, 'bob');
    await row(page, 'Bob').getByRole('button', { name: 'Edit Bob' }).click();
    await page.locator('#edit-name').fill('Bobby');
    await page.getByRole('button', { name: 'Save changes' }).click();
    expect(await names(page)).toEqual(['Bobby']);
    await expect(page.locator('#search-input')).toHaveValue('bob');
    await row(page, 'Bobby').getByRole('button', { name: 'Delete Bobby' }).click();
    await page.getByRole('button', { name: 'Delete contact' }).click();
    await expect(page.locator('.no-match')).toBeVisible();
    await page.getByRole('button', { name: 'Clear search' }).click();
    expect(await names(page)).toEqual(['ALI Baba', 'Alice']);
  });

  test('an open edit stays visible if the search would hide it', async ({ page }) => {
    await search(page, 'bob');
    await row(page, 'Bob').getByRole('button', { name: 'Edit Bob' }).click();
    await page.locator('#edit-name').fill('Draft text');
    await search(page, 'alice');
    await expect(page.locator('#edit-name')).toHaveValue('Draft text');
  });

  test('adding a non-matching contact keeps the query and shows a visible, announced notice', async ({ page }) => {
    await search(page, 'ali');
    await add(page, 'Zed', '5552223333');
    await expect(page.locator('#search-input')).toHaveValue('ali');
    expect(await names(page)).toEqual(['ALI Baba', 'Alice']);
    await expect(page.locator('#search-notice')).toBeVisible();
    await expect(page.locator('#search-notice')).toHaveText('Contact saved, but it is hidden by the current search.');
    await expect(page.locator('#live-polite')).toHaveText('Contact saved, but it is hidden by the current search.');
    await expect(page.locator('#add-name')).toBeFocused();
    // the notice goes away when the query changes
    await search(page, '');
    await expect(page.locator('#search-notice')).toBeHidden();
    expect(await names(page)).toContain('Zed');
  });

  test('adding a matching contact shows no notice', async ({ page }) => {
    await search(page, 'ali');
    await add(page, 'Alina', '5552223333');
    await expect(page.locator('#search-notice')).toBeHidden();
    expect(await names(page)).toContain('Alina');
    await expect(page.locator('#live-polite')).toHaveText('Contact added.');
  });

  test('the query is not persisted: reload empties it and shows the full list', async ({ page }) => {
    await search(page, 'ali');
    await page.reload();
    await expect(page.locator('#search-input')).toHaveValue('');
    expect(await names(page)).toEqual(['Bob', 'ALI Baba', 'Alice']);
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).not.toContain('"ali"');
  });

  test('contacts with identical phones are each returned', async ({ page }) => {
    await add(page, 'Twin A', '5551119999');
    await add(page, 'Twin B', '5551119999');
    await search(page, '1119999');
    expect(await names(page)).toEqual(['Twin B', 'Twin A']);
  });

  test('keyboard only: type, Tab to Clear, Enter', async ({ page }) => {
    await page.locator('#search-input').focus();
    await page.keyboard.type('bob');
    expect(await names(page)).toEqual(['Bob']);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Clear search' })).toBeFocused();
    await page.keyboard.press('Enter');
    expect(await names(page)).toEqual(['Bob', 'ALI Baba', 'Alice']);
  });

  for (const [label, width] of [
    ['320 px', 320],
    ['desktop', 1280],
  ] as const) {
    test(`axe: search states at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      const run = () =>
        new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      await search(page, 'ali');
      expect((await run()).violations).toEqual([]);
      await add(page, 'Zed', '5552223333');
      await expect(page.locator('#search-notice')).toBeVisible();
      expect((await run()).violations).toEqual([]);
      await search(page, 'zzzz');
      await expect(page.locator('.no-match')).toBeVisible();
      expect((await run()).violations).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
      ).toBe(false);
    });
  }
});

test.describe('T-18 search during recovery (decision 7)', () => {
  const mixed = JSON.stringify({
    version: 1,
    nextSeq: 10,
    contacts: [
      { id: 'a', name: 'Alice', phone: '5551234567', createdSeq: 0, createdAt: '' },
      { id: 'b', name: 'Bob', phone: '5557654321', createdSeq: 1, createdAt: '' },
      { id: 'a', name: 'Dupe', phone: '5550000000', createdSeq: 2, createdAt: '' },
    ],
  });

  test('search filters the read-only preview and nothing is written', async ({ page }) => {
    await page.addInitScript(
      ([k, v]) => {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem(k as string, v as string);
          sessionStorage.setItem('seeded', '1');
        }
      },
      [KEY, mixed],
    );
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    expect(await names(page)).toEqual(['Bob', 'Alice']);
    await search(page, 'bob');
    expect(await names(page)).toEqual(['Bob']);
    // Add stays usable-looking only in the sense that search works; the Add
    // control itself is disabled with a visible reason during recovery (CR-12).
    const addBtn = page.getByRole('button', { name: 'Add contact' });
    await expect(addBtn).toBeDisabled();
    await expect(page.locator('#add-section [data-role="blocked-reason"]')).toHaveText(
      'Add, edit and delete are turned off until you decide what to do with the saved data (see above).',
    );
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe(mixed);
  });
});

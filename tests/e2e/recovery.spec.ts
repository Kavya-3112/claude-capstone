import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const KEY = 'contacts.v1';
const BACKUP = 'contacts.v1.backup';

const rec = (id: string, seq: number, name: string, phone = '555-123-4567') => ({
  id,
  name,
  phone,
  createdSeq: seq,
  createdAt: '',
});
// 3 valid + 2 invalid (duplicate id, duplicate createdSeq)
const MIXED = JSON.stringify({
  version: 1,
  nextSeq: 10,
  contacts: [rec('a', 0, 'Alice'), rec('b', 1, 'Bob'), rec('a', 2, 'Dupe'), rec('x', 1, 'SeqDupe'), rec('d', 3, 'Dan')],
});
const BAD_JSON = '{not json';
const GOOD = JSON.stringify({ version: 1, nextSeq: 2, contacts: [rec('g1', 0, 'Gina'), rec('g2', 1, 'Gus')] });

async function seed(page: Page, items: Record<string, string>) {
  await page.addInitScript((data) => {
    if (!sessionStorage.getItem('seeded')) {
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
      sessionStorage.setItem('seeded', '1');
    }
  }, items);
}
async function captureBlobs(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __blobs: Blob[] };
    w.__blobs = [];
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b: Blob | MediaSource) => {
      w.__blobs.push(b as Blob);
      return orig(b);
    };
  });
}
const raw = (page: Page, k: string) => page.evaluate((key) => localStorage.getItem(key), k);
const names = (page: Page) => page.locator('.contact-name').allTextContents();
const panel = (page: Page) => page.locator('#recovery-region');
const btn = (page: Page, name: string) => panel(page).getByRole('button', { name });
const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();

test.describe('T-20 unreadable data', () => {
  test('shows the notice with the invalid count and a read-only preview; original untouched', async ({ page }) => {
    await seed(page, { [KEY]: MIXED });
    await page.goto('/');
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByRole('heading', { name: 'Your saved contacts could not be read' })).toBeVisible();
    await expect(panel(page).locator('[data-role="summary"]')).toHaveText(
      '2 saved records are invalid and not shown. 3 readable contacts are shown below as a read-only preview.',
    );
    expect(await names(page)).toEqual(['Dan', 'Bob', 'Alice']);
    await expect(page.locator('#live-assertive')).toContainText('Your saved contacts could not be read');
    expect(await raw(page, KEY)).toBe(MIXED);
    expect(await raw(page, BACKUP)).toBeNull();
  });

  test('add, edit and delete controls are disabled with a visible reason; search still works; nothing is written', async ({ page }) => {
    await seed(page, { [KEY]: MIXED });
    await page.goto('/');
    // Add is disabled before any click, with the visible, recovery-specific reason (CR-12).
    const addBtn = page.getByRole('button', { name: 'Add contact' });
    await expect(addBtn).toBeDisabled();
    await expect(page.locator('#add-section [data-role="blocked-reason"]')).toHaveText(
      'Add, edit and delete are turned off until you decide what to do with the saved data (see above).',
    );
    // Edit/Delete are disabled too, with the same reason shown once near the list controls.
    const editBob = page.getByRole('button', { name: 'Edit Bob' });
    const deleteBob = page.getByRole('button', { name: 'Delete Bob' });
    await expect(editBob).toBeDisabled();
    await expect(deleteBob).toBeDisabled();
    await expect(page.locator('#contact-list-region [data-role="list-blocked-reason"]')).toHaveText(
      'Add, edit and delete are turned off until you decide what to do with the saved data (see above).',
    );
    expect(await names(page)).toEqual(['Dan', 'Bob', 'Alice']);
    await page.locator('#search-input').fill('bob');
    expect(await names(page)).toEqual(['Bob']);
    expect(await raw(page, KEY)).toBe(MIXED);
  });

  test('malformed JSON: no contacts shown, clear message, original untouched', async ({ page }) => {
    await seed(page, { [KEY]: BAD_JSON });
    await page.goto('/');
    await expect(panel(page).locator('[data-role="summary"]')).toHaveText(
      'The saved data could not be read, so no contacts are shown.',
    );
    expect(await raw(page, KEY)).toBe(BAD_JSON);
  });

  test('copy puts the exact original on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await seed(page, { [KEY]: MIXED });
    await page.goto('/');
    await btn(page, 'Copy original data').click();
    await expect(page.locator('#live-polite')).toHaveText('Original data copied.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(MIXED);
  });

  test('download hands the exact original to a file named contacts-original.json', async ({ page }) => {
    await captureBlobs(page);
    await seed(page, { [KEY]: MIXED });
    await page.goto('/');
    const [download] = await Promise.all([page.waitForEvent('download'), btn(page, 'Download original data').click()]);
    expect(download.suggestedFilename()).toBe('contacts-original.json');
    const text = await page.evaluate(() => (window as unknown as { __blobs: Blob[] }).__blobs[0]!.text());
    expect(text).toBe(MIXED);
    expect(await raw(page, KEY)).toBe(MIXED);
  });

  test('Leave unchanged keeps everything as is and the choices stay available', async ({ page }) => {
    await seed(page, { [KEY]: MIXED });
    await page.goto('/');
    await btn(page, 'Leave data unchanged').click();
    await expect(panel(page)).toContainText('Your saved data was left unchanged.');
    await expect(btn(page, 'Replace saved data')).toBeVisible();
    expect(await raw(page, KEY)).toBe(MIXED);
    await page.reload();
    await expect(panel(page)).toBeVisible();
  });

  test('Replace asks first; Cancel changes nothing', async ({ page }) => {
    await seed(page, { [KEY]: MIXED });
    await page.goto('/');
    await btn(page, 'Replace saved data').click();
    await expect(panel(page).locator('[data-role="confirm-text"]')).toContainText(
      'Replace the saved data with 3 readable contacts?',
    );
    await expect(panel(page).locator('#recovery-heading')).toBeFocused();
    await btn(page, 'Cancel').click();
    expect(await raw(page, KEY)).toBe(MIXED);
    expect(await raw(page, BACKUP)).toBeNull();
  });

  test('Replace keeps a temporary backup until the result is confirmed, then removes it', async ({ page }) => {
    await seed(page, { [KEY]: MIXED });
    await page.goto('/');
    await btn(page, 'Replace saved data').click();
    await btn(page, 'Replace').click();
    await expect(panel(page).getByRole('heading', { name: 'Saved data replaced' })).toBeVisible();
    await expect(panel(page)).toContainText('3 contacts');
    expect(await raw(page, BACKUP)).toBe(MIXED);
    const stored = JSON.parse((await raw(page, KEY))!);
    expect(stored.contacts.map((c: { name: string }) => c.name)).toEqual(['Alice', 'Bob', 'Dan']);
    // normal use works again, while the backup is still kept
    await page.locator('#add-name').fill('Eve');
    await page.locator('#add-phone').fill('5559990000');
    await page.getByRole('button', { name: 'Add contact' }).click();
    expect(await names(page)).toEqual(['Eve', 'Dan', 'Bob', 'Alice']);
    expect(await raw(page, BACKUP)).toBe(MIXED);
    await btn(page, 'Confirm result and remove backup').click();
    await expect(panel(page)).toBeHidden();
    expect(await raw(page, BACKUP)).toBeNull();
    await expect(page.locator('#live-polite')).toHaveText('Result confirmed. Backup removed.');
    await expect(page.locator('#list-heading')).toBeFocused();
  });

  test('an unconfirmed replacement offers the original back on the next load (leftover)', async ({ page }) => {
    await seed(page, { [KEY]: MIXED });
    await page.goto('/');
    await btn(page, 'Replace saved data').click();
    await btn(page, 'Replace').click();
    await page.reload();
    await expect(panel(page).getByRole('heading', { name: 'A backup was found' })).toBeVisible();
    expect(await raw(page, BACKUP)).toBe(MIXED);
  });

  test('backup cannot be saved: nothing changes; replace without backup needs the own-copy confirmation', async ({ page }) => {
    await seed(page, { [KEY]: MIXED });
    await page.goto('/');
    await page.evaluate(() => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k.endsWith('.backup')) throw new DOMException('full', 'QuotaExceededError');
        return orig.call(this, k, v);
      };
    });
    await btn(page, 'Replace saved data').click();
    await btn(page, 'Replace').click();
    await expect(panel(page).locator('[data-role="confirm-text"]')).toContainText('The temporary backup could not be saved');
    await expect(panel(page).locator('[data-role="confirm-text"]')).toContainText('Browser storage is full.');
    expect(await raw(page, KEY)).toBe(MIXED);
    const go = btn(page, 'Replace without backup');
    await expect(go).toBeDisabled();
    await page.getByLabel('I have copied or downloaded the original data myself.').check();
    await expect(go).toBeEnabled();
    await go.click();
    await expect(panel(page)).toBeHidden();
    await expect(page.locator('#live-polite')).toHaveText('Saved data replaced without a backup.');
    expect(await raw(page, BACKUP)).toBeNull();
    expect(await names(page)).toEqual(['Dan', 'Bob', 'Alice']);
  });

  test('new data cannot be written: original unchanged; Try again works after storage recovers and reuses the backup', async ({ page }) => {
    await seed(page, { [KEY]: MIXED });
    await page.goto('/');
    await page.evaluate(() => {
      const w = window as unknown as { __orig: typeof Storage.prototype.setItem };
      w.__orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k === 'contacts.v1') throw new DOMException('full', 'QuotaExceededError');
        return w.__orig.call(this, k, v);
      };
    });
    await btn(page, 'Replace saved data').click();
    await btn(page, 'Replace').click();
    await expect(panel(page).locator('[data-role="confirm-text"]')).toContainText('your original data is unchanged');
    expect(await raw(page, KEY)).toBe(MIXED);
    await page.evaluate(() => {
      const w = window as unknown as { __orig: typeof Storage.prototype.setItem };
      Storage.prototype.setItem = w.__orig;
    });
    await btn(page, 'Try again').click();
    await expect(panel(page).getByRole('heading', { name: 'Saved data replaced' })).toBeVisible();
  });

  test('keyboard only: Tab to Replace saved data, Enter, then Enter on Replace', async ({ page }) => {
    await seed(page, { [KEY]: MIXED });
    await page.goto('/');
    await btn(page, 'Replace saved data').focus();
    await page.keyboard.press('Enter');
    await expect(panel(page).locator('#recovery-heading')).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(btn(page, 'Replace')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(panel(page).getByRole('heading', { name: 'Saved data replaced' })).toBeVisible();
  });
});

test.describe('T-20 leftover backup', () => {
  test('is offered first; add/edit/delete controls are disabled with a visible reason until the user decides', async ({ page }) => {
    await seed(page, { [KEY]: GOOD, [BACKUP]: MIXED });
    await page.goto('/');
    await expect(panel(page).getByRole('heading', { name: 'A backup was found' })).toBeVisible();
    const addBtn = page.getByRole('button', { name: 'Add contact' });
    await expect(addBtn).toBeDisabled();
    await expect(page.locator('#add-section [data-role="blocked-reason"]')).toHaveText(
      'Add, edit and delete are turned off until you restore or discard the backup (see above).',
    );
    await expect(page.getByRole('button', { name: 'Edit Gina' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Delete Gina' })).toBeDisabled();
    await expect(page.locator('#contact-list-region [data-role="list-blocked-reason"]')).toHaveText(
      'Add, edit and delete are turned off until you restore or discard the backup (see above).',
    );
    expect(await raw(page, BACKUP)).toBe(MIXED);
  });

  test('Discard asks to confirm, then removes only the backup', async ({ page }) => {
    await seed(page, { [KEY]: GOOD, [BACKUP]: MIXED });
    await page.goto('/');
    await btn(page, 'Discard backup').click();
    await expect(panel(page)).toContainText('Discard the backup permanently?');
    await btn(page, 'Keep the backup').click();
    expect(await raw(page, BACKUP)).toBe(MIXED);
    await btn(page, 'Discard backup').click();
    await btn(page, 'Yes, discard it').click();
    await expect(panel(page)).toBeHidden();
    expect(await raw(page, BACKUP)).toBeNull();
    expect(await raw(page, KEY)).toBe(GOOD);
    await page.locator('#add-name').fill('New');
    await page.locator('#add-phone').fill('5551112222');
    await page.getByRole('button', { name: 'Add contact' }).click();
    expect(await names(page)).toContain('New');
  });

  test('Restore writes the backup back (data unchanged since load), removes it, and reloads', async ({ page }) => {
    const older = JSON.stringify({ version: 1, nextSeq: 1, contacts: [rec('o1', 0, 'Older')] });
    await seed(page, { [KEY]: GOOD, [BACKUP]: older });
    await page.goto('/');
    await btn(page, 'Restore backup').click();
    await expect(panel(page)).toBeHidden();
    expect(await names(page)).toEqual(['Older']);
    expect(await raw(page, BACKUP)).toBeNull();
    expect(await raw(page, KEY)).toBe(older);
    await expect(page.locator('#live-polite')).toHaveText('Backup restored.');
  });

  test('Restore over data that changed since load needs a second, explicit confirmation (decision 10)', async ({ page }) => {
    const older = JSON.stringify({ version: 1, nextSeq: 1, contacts: [rec('o1', 0, 'Older')] });
    await seed(page, { [KEY]: GOOD, [BACKUP]: older });
    await page.goto('/');
    const newer = JSON.stringify({ version: 1, nextSeq: 1, contacts: [rec('n1', 0, 'Newer')] });
    await page.evaluate(([k, v]) => localStorage.setItem(k as string, v as string), [KEY, newer]);
    await btn(page, 'Restore backup').click();
    await expect(panel(page).locator('[data-role="confirm-text"]')).toContainText('changed since this page loaded');
    expect(await raw(page, KEY)).toBe(newer);
    await btn(page, 'Keep current data').click();
    expect(await raw(page, KEY)).toBe(newer);
    expect(await raw(page, BACKUP)).toBe(older);
    await btn(page, 'Restore backup').click();
    await btn(page, 'Restore anyway').click();
    expect(await raw(page, KEY)).toBe(older);
    expect(await raw(page, BACKUP)).toBeNull();
  });

  test('a leftover is handled before new corruption; then the unreadable notice follows', async ({ page }) => {
    await seed(page, { [KEY]: BAD_JSON, [BACKUP]: 'old raw' });
    await page.goto('/');
    await expect(panel(page).getByRole('heading', { name: 'A backup was found' })).toBeVisible();
    await btn(page, 'Discard backup').click();
    await btn(page, 'Yes, discard it').click();
    await expect(panel(page).getByRole('heading', { name: 'Your saved contacts could not be read' })).toBeVisible();
    expect(await raw(page, KEY)).toBe(BAD_JSON);
  });

  test('the backup data can be copied and downloaded', async ({ page }) => {
    await captureBlobs(page);
    await seed(page, { [KEY]: GOOD, [BACKUP]: MIXED });
    await page.goto('/');
    const [download] = await Promise.all([page.waitForEvent('download'), btn(page, 'Download backup data').click()]);
    expect(download.suggestedFilename()).toBe('contacts-backup.json');
    expect(await page.evaluate(() => (window as unknown as { __blobs: Blob[] }).__blobs[0]!.text())).toBe(MIXED);
  });
});

for (const [label, width] of [
  ['320 px', 320],
  ['desktop', 1280],
] as const) {
  test(`axe: recovery views at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await seed(page, { [KEY]: MIXED });
    await page.goto('/');
    const noOverflow = async () =>
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    expect((await axe(page)).violations).toEqual([]);
    await noOverflow();
    await btn(page, 'Replace saved data').click();
    expect((await axe(page)).violations).toEqual([]);
    await btn(page, 'Replace').click();
    await expect(panel(page).getByRole('heading', { name: 'Saved data replaced' })).toBeVisible();
    expect((await axe(page)).violations).toEqual([]);
    await noOverflow();
  });

  test(`axe: backup-failed and leftover views at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await seed(page, { [KEY]: MIXED });
    await page.goto('/');
    await page.evaluate(() => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k.endsWith('.backup')) throw new DOMException('full', 'QuotaExceededError');
        return orig.call(this, k, v);
      };
    });
    await btn(page, 'Replace saved data').click();
    await btn(page, 'Replace').click();
    await expect(btn(page, 'Replace without backup')).toBeVisible();
    expect((await axe(page)).violations).toEqual([]);
  });

  test(`axe: leftover and restore confirmation at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await seed(page, { [KEY]: GOOD, [BACKUP]: MIXED });
    await page.goto('/');
    expect((await axe(page)).violations).toEqual([]);
    await btn(page, 'Discard backup').click();
    expect((await axe(page)).violations).toEqual([]);
    await btn(page, 'Keep the backup').click();
    await page.evaluate((k) => localStorage.setItem(k, '{"version":1,"nextSeq":0,"contacts":[]}'), KEY);
    await btn(page, 'Restore backup').click();
    await expect(panel(page).locator('[data-role="confirm-text"]')).toBeVisible();
    expect((await axe(page)).violations).toEqual([]);
  });
}

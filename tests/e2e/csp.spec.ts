import { test, expect } from '@playwright/test';

/** Runs against the production build served by `vite preview` (CR-04, decision 9). */
const BUILD_URL = 'http://localhost:4173/';

test('built page carries a meta CSP and the app loads under it with no violations', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.addInitScript(() => {
    (window as unknown as { __violations: string[] }).__violations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __violations: string[] }).__violations.push(e.violatedDirective);
    });
  });

  await page.goto(BUILD_URL);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("object-src 'none'");
  await expect(page.getByRole('heading', { level: 1, name: 'Contacts' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations)).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('an injected inline script is blocked by the CSP', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __violations: string[] }).__violations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __violations: string[] }).__violations.push(e.violatedDirective);
    });
  });
  await page.goto(BUILD_URL);
  await page.evaluate(() => {
    const s = document.createElement('script');
    s.textContent = 'window.__ran = true';
    document.body.append(s);
  });
  expect(await page.evaluate(() => (window as unknown as { __ran?: boolean }).__ran)).toBeUndefined();
  const violations = await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);
  expect(violations.some((v) => v.startsWith('script-src'))).toBe(true);
});

test('the built page makes no third-party requests and the layout still has no overflow at 320 px', async ({
  page,
}) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost:4173') && !r.url().startsWith('data:')) external.push(r.url());
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(BUILD_URL);
  expect(external).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(
    false,
  );
});

test('the dev server page has no meta CSP (build-only)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(0);
});

test('add, edit and delete work on the built page under the CSP with no violations', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(String(e)));
  await page.addInitScript(() => {
    (window as unknown as { __v: string[] }).__v = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __v: string[] }).__v.push(e.violatedDirective);
    });
  });
  await page.goto(BUILD_URL);
  await page.locator('#add-name').fill('<img src=x onerror=alert(1)>');
  await page.locator('#add-phone').fill('5551234567');
  await page.getByRole('button', { name: 'Add contact' }).click();
  await expect(page.locator('.contact-name')).toHaveText('<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: /^Edit/ }).click();
  await page.locator('#edit-name').fill('Edited');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.contact-name')).toHaveText('Edited');
  await page.getByRole('button', { name: /^Delete/ }).click();
  await page.getByRole('button', { name: 'Delete contact' }).click();
  await expect(page.locator('.empty-state')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __v: string[] }).__v)).toEqual([]);
  expect(problems).toEqual([]);
});

test('recovery screen, Blob download and copy work on the built page under the CSP with no violations', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const bad = '{"version":1,"nextSeq":3,"contacts":[{"id":"a","name":"Alice","phone":"5551234567","createdSeq":0,"createdAt":""},{"id":"a","name":"Dupe","phone":"5551234567","createdSeq":1,"createdAt":""}]}';
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(String(e)));
  await page.addInitScript((raw) => {
    const w = window as unknown as { __v: string[]; __blobs: Blob[] };
    w.__v = [];
    w.__blobs = [];
    document.addEventListener('securitypolicyviolation', (e) => w.__v.push(e.violatedDirective));
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b: Blob | MediaSource) => {
      w.__blobs.push(b as Blob);
      return orig(b);
    };
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('contacts.v1', raw);
      sessionStorage.setItem('seeded', '1');
    }
  }, bad);
  await page.goto(BUILD_URL);
  const panel = page.locator('#recovery-region');
  await expect(panel.getByRole('heading', { name: 'Your saved contacts could not be read' })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel.getByRole('button', { name: 'Download original data' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('contacts-original.json');
  expect(await page.evaluate(() => (window as unknown as { __blobs: Blob[] }).__blobs[0]!.text())).toBe(bad);
  await panel.getByRole('button', { name: 'Copy original data' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(bad);
  await panel.getByRole('button', { name: 'Replace saved data' }).click();
  await panel.getByRole('button', { name: 'Replace' }).click();
  await panel.getByRole('button', { name: 'Confirm result and remove backup' }).click();
  await expect(panel).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { __v: string[] }).__v)).toEqual([]);
  expect(problems).toEqual([]);
});

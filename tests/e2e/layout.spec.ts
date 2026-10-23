import { test, expect, type Page } from '@playwright/test';

const longName = 'W'.repeat(120);
const longPhone = '1'.repeat(60);

/**
 * Adds worst-case content using the classes defined for the later UI tasks, so
 * the overflow check exercises the real CSS (the list itself arrives in T-14).
 */
async function injectSampleContent(page: Page) {
  await page.evaluate(
    ({ longName, longPhone }) => {
      const region = document.getElementById('contact-list-region')!;
      const ul = document.createElement('ul');
      ul.className = 'contact-list';
      for (let i = 0; i < 3; i++) {
        const li = document.createElement('li');
        li.className = 'contact-item';
        const d = document.createElement('div');
        d.className = 'contact-details';
        const n = document.createElement('div');
        n.className = 'contact-name';
        n.textContent = longName;
        const p = document.createElement('div');
        p.className = 'contact-phone';
        p.textContent = longPhone;
        d.append(n, p);
        const row = document.createElement('div');
        row.className = 'btn-row';
        for (const t of ['Edit', 'Delete']) {
          const b = document.createElement('button');
          b.className = 'btn';
          b.textContent = t;
          row.append(b);
        }
        li.append(d, row);
        ul.append(li);
      }
      region.append(ul);

      const add = document.getElementById('add-section')!;
      const f = document.createElement('div');
      f.className = 'field';
      const l = document.createElement('label');
      l.textContent = 'Name';
      l.htmlFor = 'sample-name';
      const i = document.createElement('input');
      i.type = 'text';
      i.id = 'sample-name';
      i.value = longName;
      f.append(l, i);
      add.append(f);
    },
    { longName, longPhone },
  );
}

async function hasHorizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

for (const [label, width] of [
  ['320 px', 320],
  ['desktop', 1280],
] as const) {
  test(`no horizontal overflow at ${label} with long content`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await injectSampleContent(page);
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
}

test('shell has a main landmark, one h1, labelled sections and live regions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Add a contact' })).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Search' })).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Contact list' })).toHaveCount(1);
  await expect(page.locator('#live-polite')).toHaveAttribute('aria-live', 'polite');
  // One mechanism only (CR-09): role="alert" implies assertive and atomic.
  await expect(page.locator('#live-assertive')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#live-assertive')).not.toHaveAttribute('aria-live', /.*/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('focus is visible: skip link appears and has an outline on first Tab', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to contacts' });
  await expect(skip).toBeFocused();
  const box = await skip.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0); // moved on screen
  const outline = await skip.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
  });
  expect(outline.style).not.toBe('none');
  expect(outline.width).toBeGreaterThanOrEqual(2);
});

test('buttons meet the target size and show a focus outline', async ({ page }) => {
  await page.goto('/');
  await injectSampleContent(page);
  const btn = page.getByRole('button', { name: 'Edit' }).first();
  const box = await btn.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(24); // WCAG 2.2 AA minimum (2.5.8)
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await btn.focus();
  const outline = await btn.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
  });
  expect(outline.style).not.toBe('none');
  expect(outline.width).toBeGreaterThanOrEqual(2);
});

test('no third-party requests are made', async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(baseURL!) && !u.startsWith('data:')) external.push(u);
  });
  await page.goto('/');
  expect(external).toEqual([]);
});

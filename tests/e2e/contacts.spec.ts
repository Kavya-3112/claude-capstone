import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const KEY = 'contacts.v1';

async function add(page: Page, name: string, phone: string) {
  await page.locator('#add-name').fill(name);
  await page.locator('#add-phone').fill(phone);
  await page.getByRole('button', { name: 'Add contact' }).click();
}
const names = (page: Page) => page.locator('.contact-name').allTextContents();
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY);
const storedCount = async (page: Page) => {
  const raw = await stored(page);
  return raw === null ? null : (JSON.parse(raw).contacts as unknown[]).length;
};
const row = (page: Page, name: string) => page.locator('li.contact-item', { hasText: name });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('T-14 list and empty state', () => {
  test('shows the empty state with no contacts', async ({ page }) => {
    await expect(page.locator('.empty-state')).toHaveText('No contacts yet. Add your first contact above.');
    await expect(page.locator('li.contact-item')).toHaveCount(0);
  });

  test('lists newest first with name and phone, and survives a reload in the same order', async ({ page }) => {
    await add(page, 'Alice', '555-123-4567');
    await add(page, 'Bob', '+1 (555) 987-6543');
    await add(page, 'Cara', '5550001111');
    expect(await names(page)).toEqual(['Cara', 'Bob', 'Alice']);
    await expect(row(page, 'Bob').locator('.contact-phone')).toHaveText('+1 (555) 987-6543');
    await page.reload();
    expect(await names(page)).toEqual(['Cara', 'Bob', 'Alice']);
    await expect(page.locator('.empty-state')).toHaveCount(0);
  });

  test('renders markup in names literally and runs no script', async ({ page }) => {
    let dialogSeen = false;
    page.on('dialog', async (d) => {
      dialogSeen = true;
      await d.dismiss();
    });
    await add(page, '<img src=x onerror=alert(1)>', '5551234567');
    await expect(page.locator('.contact-name')).toHaveText('<img src=x onerror=alert(1)>');
    await expect(page.locator('li.contact-item img')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.contact-name')).toHaveText('<img src=x onerror=alert(1)>');
    expect(dialogSeen).toBe(false);
  });

  test('long names and phones do not cause horizontal scroll at 320 px or desktop', async ({ page }) => {
    await add(page, 'W'.repeat(100), '1'.repeat(15));
    await add(page, 'N'.repeat(100), '+1 (234) 567-890 123');
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
      ).toBe(false);
    }
  });
});

test.describe('T-15 add form', () => {
  test('a valid add appears first, clears the form, announces and keeps focus on the name field', async ({ page }) => {
    await add(page, 'Alice', '5551234567');
    await expect(page.locator('#add-name')).toHaveValue('');
    await expect(page.locator('#add-name')).toBeFocused();
    await expect(page.locator('#live-polite')).toHaveText('Contact added.');
    expect(await storedCount(page)).toBe(1);
  });

  test('trims input before saving', async ({ page }) => {
    await add(page, '  Ann  ', '  555-123-4567  ');
    expect(await names(page)).toEqual(['Ann']);
    await expect(page.locator('.contact-phone')).toHaveText('555-123-4567');
  });

  test('empty name, empty phone and both are rejected with messages and nothing is saved', async ({ page }) => {
    await add(page, '', '5551234567');
    await expect(page.locator('#add-name-error')).toHaveText('Enter a name.');
    await expect(page.locator('#add-name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#add-name')).toBeFocused();

    await page.locator('#add-name').fill('Alice');
    await page.locator('#add-phone').fill('');
    await page.getByRole('button', { name: 'Add contact' }).click();
    await expect(page.locator('#add-phone-error')).toHaveText('Enter a phone number.');
    await expect(page.locator('#add-phone')).toBeFocused();
    await expect(page.locator('#add-name-error')).toBeHidden();

    await page.locator('#add-name').fill('');
    await page.getByRole('button', { name: 'Add contact' }).click();
    await expect(page.locator('#add-name-error')).toBeVisible();
    await expect(page.locator('#add-phone-error')).toBeVisible();
    await expect(page.locator('#add-name')).toBeFocused();
    await expect(page.locator('#live-assertive')).toContainText('Please fix the problems');

    expect(await stored(page)).toBeNull();
    await expect(page.locator('li.contact-item')).toHaveCount(0);
  });

  test('phone describedby links the hint and the error', async ({ page }) => {
    await add(page, 'Alice', 'abc');
    await expect(page.locator('#add-phone')).toHaveAttribute('aria-describedby', 'add-phone-hint add-phone-error');
    await expect(page.locator('#add-phone-error')).toContainText('letters');
  });

  const phoneCases: Array<[string, boolean]> = [
    ['123456', false],
    ['1234567', true],
    ['123456789012345', true],
    ['1234567890123456', false],
    ['+1 (555) 123-4567', true],
    ['555-123-4567', true],
    ['+1234567', true],
    ['555-CALL-NOW', false],
    ['5551234567 ext 12', false],
    ['5551234567x12', false],
    ['555+1234567', false],
  ];
  for (const [phone, valid] of phoneCases) {
    test(`phone "${phone}" is ${valid ? 'accepted' : 'rejected'}`, async ({ page }) => {
      await add(page, 'P', phone);
      expect(await storedCount(page)).toBe(valid ? 1 : null);
      if (!valid) await expect(page.locator('#add-phone-error')).toBeVisible();
    });
  }

  test('length limits: name 100 ok / 101 rejected; phone 20 ok / 21 rejected; never truncated', async ({ page }) => {
    await add(page, 'n'.repeat(101), '5551234567');
    await expect(page.locator('#add-name-error')).toContainText('at most 100');
    await expect(page.locator('#add-name')).toHaveValue('n'.repeat(101)); // input is not truncated
    await add(page, 'n'.repeat(100), '5551234567');
    expect(await storedCount(page)).toBe(1);
    await add(page, 'Q', '1 2 3 4 5 6 7 8 9 0 1');
    await expect(page.locator('#add-phone-error')).toContainText('at most 20');
    await add(page, 'Q', '+1 (234) 567-890 123');
    expect(await storedCount(page)).toBe(2);
  });

  test('identical contacts are both accepted with no duplicate warning', async ({ page }) => {
    await add(page, 'Twin', '5551234567');
    await add(page, 'Twin', '5551234567');
    expect(await names(page)).toEqual(['Twin', 'Twin']);
    await expect(page.locator('#live-assertive')).toHaveText('');
    expect(await storedCount(page)).toBe(2);
  });

  test('keyboard only: type, Tab, Enter adds a contact', async ({ page }) => {
    await page.locator('#add-name').focus();
    await page.keyboard.type('Keyed');
    await page.keyboard.press('Tab');
    await page.keyboard.type('5551234567');
    await page.keyboard.press('Enter');
    expect(await names(page)).toEqual(['Keyed']);
  });

  test('a failed save keeps the contact visible and never announces success', async ({ page }) => {
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('full', 'QuotaExceededError');
      };
    });
    await add(page, 'Alice', '5551234567');
    expect(await names(page)).toEqual(['Alice']);
    await expect(page.locator('#live-assertive')).toContainText('Not saved');
    await expect(page.locator('#live-polite')).not.toHaveText('Contact added.');
  });
});

test.describe('T-16 edit', () => {
  test.beforeEach(async ({ page }) => {
    await add(page, 'Alice', '5551234567');
    await add(page, 'Bob', '5557654321');
    await add(page, 'Cara', '5550001111');
  });

  test('opens prefilled with focus in the name field; saving keeps the position', async ({ page }) => {
    await row(page, 'Bob').getByRole('button', { name: 'Edit Bob' }).click();
    await expect(page.locator('#edit-name')).toHaveValue('Bob');
    await expect(page.locator('#edit-phone')).toHaveValue('5557654321');
    await expect(page.locator('#edit-name')).toBeFocused();
    await page.locator('#edit-name').fill('Robert');
    await page.locator('#edit-phone').fill('555-765-4321');
    await page.getByRole('button', { name: 'Save changes' }).click();
    expect(await names(page)).toEqual(['Cara', 'Robert', 'Alice']);
    await expect(page.locator('#live-polite')).toHaveText('Contact updated.');
    await expect(row(page, 'Robert').getByRole('button', { name: 'Edit Robert' })).toBeFocused();
    await page.reload();
    expect(await names(page)).toEqual(['Cara', 'Robert', 'Alice']);
  });

  test('invalid edits are rejected with messages and the saved contact is unchanged after reload', async ({ page }) => {
    await row(page, 'Bob').getByRole('button', { name: 'Edit Bob' }).click();
    await page.locator('#edit-name').fill('   ');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('#edit-name-error')).toHaveText('Enter a name.');
    await expect(page.locator('#edit-name')).toBeFocused();
    await page.locator('#edit-name').fill('Bob');
    await page.locator('#edit-phone').fill('12ab');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('#edit-phone-error')).toBeVisible();
    await expect(page.locator('#edit-phone')).toBeFocused();
    await page.reload();
    await expect(row(page, 'Bob').locator('.contact-phone')).toHaveText('5557654321');
  });

  test('every add validation outcome applies to edit', async ({ page }) => {
    const cases: Array<[string, boolean]> = [
      ['123456', false],
      ['1234567', true],
      ['1234567890123456', false],
      ['+1234567', true],
      ['555-CALL-NOW', false],
      ['5551234567x12', false],
      ['1 2 3 4 5 6 7 8 9 0 1', false],
    ];
    for (const [phone, valid] of cases) {
      await row(page, 'Alice').getByRole('button', { name: /^Edit/ }).click();
      await page.locator('#edit-phone').fill(phone);
      await page.getByRole('button', { name: 'Save changes' }).click();
      if (valid) await expect(page.locator('#edit-phone')).toHaveCount(0);
      else {
        await expect(page.locator('#edit-phone-error')).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();
      }
    }
  });

  test('Cancel and Escape leave values unchanged and return focus to the Edit button', async ({ page }) => {
    await row(page, 'Bob').getByRole('button', { name: 'Edit Bob' }).click();
    await page.locator('#edit-name').fill('Changed');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(row(page, 'Bob')).toHaveCount(1);
    await expect(row(page, 'Bob').getByRole('button', { name: 'Edit Bob' })).toBeFocused();

    await row(page, 'Bob').getByRole('button', { name: 'Edit Bob' }).click();
    await page.locator('#edit-name').fill('Changed again');
    await page.keyboard.press('Escape');
    await expect(page.locator('#edit-name')).toHaveCount(0);
    await expect(row(page, 'Bob').getByRole('button', { name: 'Edit Bob' })).toBeFocused();
    await page.reload();
    expect(await names(page)).toEqual(['Cara', 'Bob', 'Alice']);
  });

  test('typing in the edit form survives a change elsewhere (draft kept)', async ({ page }) => {
    await row(page, 'Bob').getByRole('button', { name: 'Edit Bob' }).click();
    await page.locator('#edit-name').fill('Draft name');
    await add(page, 'Dan', '5552223333'); // re-renders the list
    await expect(page.locator('#edit-name')).toHaveValue('Draft name');
  });

  test('editing one of two identical-phone contacts changes only that one', async ({ page }) => {
    await add(page, 'Twin', '5559999999');
    await add(page, 'Twin', '5559999999');
    await page.locator('li.contact-item', { hasText: 'Twin' }).first().getByRole('button', { name: /^Edit/ }).click();
    await page.locator('#edit-name').fill('Twin edited');
    await page.getByRole('button', { name: 'Save changes' }).click();
    const all = await names(page);
    expect(all.filter((n) => n === 'Twin')).toHaveLength(1);
    expect(all.filter((n) => n === 'Twin edited')).toHaveLength(1);
  });

  test('keyboard only: Tab to Edit, Enter, change, Enter to save', async ({ page }) => {
    await row(page, 'Cara').getByRole('button', { name: 'Edit Cara' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#edit-name')).toBeFocused();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Clara');
    await page.keyboard.press('Enter');
    expect(await names(page)).toEqual(['Clara', 'Bob', 'Alice']);
  });
});

test.describe('T-17 delete', () => {
  test.beforeEach(async ({ page }) => {
    await add(page, 'Alice', '5551234567');
    await add(page, 'Bob', '5551234567');
  });

  test('dialog opens with focus on Cancel; Cancel keeps the contact and returns focus to Delete', async ({ page }) => {
    await row(page, 'Alice').getByRole('button', { name: 'Delete Alice' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete this contact?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Alice');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await names(page)).toEqual(['Bob', 'Alice']);
    await expect(row(page, 'Alice').getByRole('button', { name: 'Delete Alice' })).toBeFocused();
  });

  test('Escape cancels', async ({ page }) => {
    await row(page, 'Alice').getByRole('button', { name: 'Delete Alice' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await names(page)).toEqual(['Bob', 'Alice']);
    await expect(row(page, 'Alice').getByRole('button', { name: 'Delete Alice' })).toBeFocused();
  });

  test('confirming removes only the selected contact, announces, and focuses the list heading', async ({ page }) => {
    await row(page, 'Alice').getByRole('button', { name: 'Delete Alice' }).click();
    await page.getByRole('button', { name: 'Delete contact' }).click();
    expect(await names(page)).toEqual(['Bob']);
    await expect(page.locator('#live-polite')).toHaveText('Contact deleted.');
    await expect(page.locator('#list-heading')).toBeFocused();
    await page.reload();
    expect(await names(page)).toEqual(['Bob']);
  });

  test('deleting the last contact shows the empty state', async ({ page }) => {
    for (const n of ['Alice', 'Bob']) {
      await row(page, n).getByRole('button', { name: `Delete ${n}` }).click();
      await page.getByRole('button', { name: 'Delete contact' }).click();
    }
    await expect(page.locator('.empty-state')).toBeVisible();
    expect(await storedCount(page)).toBe(0);
  });

  test('keyboard only: Tab traps inside the dialog and Enter on Cancel closes it', async ({ page }) => {
    await row(page, 'Alice').getByRole('button', { name: 'Delete Alice' }).focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Delete contact' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused(); // wrapped, not escaped to the page
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
  });

  test('a failed save on delete keeps the change visible and never announces success', async ({ page }) => {
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('full', 'QuotaExceededError');
      };
    });
    await row(page, 'Alice').getByRole('button', { name: 'Delete Alice' }).click();
    await page.getByRole('button', { name: 'Delete contact' }).click();
    expect(await names(page)).toEqual(['Bob']);
    await expect(page.locator('#live-assertive')).toContainText('Not saved');
    await expect(page.locator('#live-polite')).not.toHaveText('Contact deleted.');
  });
});

test.describe('CR-10 structure', () => {
  test('the skip link moves focus into main, which is programmatically focusable', async ({ page }) => {
    await expect(page.locator('#main')).toHaveAttribute('tabindex', '-1');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });
  test('the empty banner region is hidden, not an empty landmark', async ({ page }) => {
    await expect(page.locator('#banner-region')).toBeHidden();
    await expect(page.getByRole('region', { name: 'Status messages' })).toHaveCount(0);
  });
});

test.describe('axe-core automated checks (not a conformance claim)', () => {
  const run = (page: Page) =>
    new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();

  test('empty state', async ({ page }) => {
    expect((await run(page)).violations).toEqual([]);
  });
  test('list, add errors, edit form with errors and the delete dialog', async ({ page }) => {
    await add(page, 'Alice', '5551234567');
    await add(page, 'Bob', '5557654321');
    expect((await run(page)).violations).toEqual([]);

    await add(page, '', 'abc');
    expect((await run(page)).violations).toEqual([]);

    await row(page, 'Bob').getByRole('button', { name: 'Edit Bob' }).click();
    await page.locator('#edit-phone').fill('1');
    await page.getByRole('button', { name: 'Save changes' }).click();
    expect((await run(page)).violations).toEqual([]);
    await page.getByRole('button', { name: 'Cancel' }).click();

    await row(page, 'Alice').getByRole('button', { name: 'Delete Alice' }).click();
    expect((await run(page)).violations).toEqual([]);
  });
  test('at 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await add(page, 'W'.repeat(100), '5551234567');
    expect((await run(page)).violations).toEqual([]);
  });
});

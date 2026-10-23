import { test, expect } from '@playwright/test';

test('page loads with heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible();
});

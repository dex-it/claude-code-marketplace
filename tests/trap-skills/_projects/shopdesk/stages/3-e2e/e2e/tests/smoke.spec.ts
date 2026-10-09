import { expect, test } from '@playwright/test';

test('открывается главная страница', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Shopdesk');
});

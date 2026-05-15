import { test, expect } from '@playwright/test';

test('mobile /m deve carregar cardápio', async ({ page }) => {
  await page.goto('/m');

  await expect(page).toHaveURL(/\/m/);

  await expect(page.locator('body')).toBeVisible();

  const bodyText = await page.locator('body').innerText();

  expect(bodyText.length).toBeGreaterThan(50);
});

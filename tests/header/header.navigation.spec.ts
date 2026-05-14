import { test, expect } from '@playwright/test';

test.describe('Header — navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('click phone opens tel integration', async ({ page }) => {
    const header = page.getByRole('banner');

    const phone = header.getByRole('link', { name: /\(098\)/ });

    await expect(phone).toHaveAttribute('href', 'tel:+380988584035');
  });

  test('click login redirects to /vkhid', async ({ page }) => {
    await page.getByRole('link', { name: 'Увійти' }).click();

    await expect(page).toHaveURL('https://bestprice.com.ua/vkhid');
  });

  test('click favorites redirects to coming soon', async ({ page }) => {
    await page.getByRole('link', { name: 'Обране' }).click();

    await expect(page).toHaveURL(/coming-soon/);
  });
});

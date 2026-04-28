import { test, expect } from '@playwright/test';

test.describe('Header — smoke (UI elements visibility)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('all main header elements are visible', async ({ page }) => {
    const header = page.getByRole('banner'); // 💡 ключевая строка

    const phone = header.getByRole('link', { name: /\(098\)/ });
    const workingHours = header.getByText('Пн-Пт 9:00-18:00');
    const logo = header.locator('a[href="/"]');
    const searchInput = header.getByRole('combobox', { name: 'Пошук товарів' });
    const searchButton = header.getByRole('button', { name: 'Знайти' });
    const login = header.getByRole('link', { name: 'Увійти' });
    const favorites = header.getByRole('link', { name: 'Обране' });
    const cart = header.getByLabel('Кошик');

    await expect(phone).toBeVisible();
    await expect(workingHours).toBeVisible();
    await expect(logo).toBeVisible();
    await expect(searchInput).toBeVisible();
    await expect(searchButton).toBeVisible();
    await expect(login).toBeVisible();
    await expect(favorites).toBeVisible();
    await expect(cart).toBeVisible();
  });
});
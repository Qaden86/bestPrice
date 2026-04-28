import { test, expect } from '@playwright/test';

test.describe('Header — functional', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('search random product', async ({ page }) => {
    const searchInput = page.getByRole('combobox', { name: 'Пошук товарів' });

    await searchInput.fill('генератор');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/poshuk|search|q=|генератор/);
  });

  test('catalog menu shows categories', async ({ page }) => {
  const header = page.getByRole('banner');

  await header.getByRole('button', { name: 'Каталог' }).click();

  const catalogMenu = page.getByLabel('Каталог категорій'); // 💡 ключ

  await expect(catalogMenu).toBeVisible();

  const category = catalogMenu.getByRole('link', { name: 'Агротехніка' });

  await expect(category).toBeVisible();
  });

  test('cart opens and shows empty state', async ({ page }) => {
  const header = page.locator('header');

  await header.getByLabel('Кошик').click();

  const drawer = page.getByRole('dialog');

  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Кошик порожній')).toBeVisible();
  });
});
import { test, expect } from '@playwright/test';
import { Header } from './components/Header';

test.describe('Header — desktop', () => {
  let header: Header;

  test.beforeEach(async ({ page }) => {
    header = new Header(page);
    await page.goto('/');
    await header.expectVisible();
  });

  test('shows top-bar contacts and auth link', async ({ page }) => {
    await expect(header.phoneLink).toBeVisible();
    await expect(header.phoneLink).toHaveAttribute('href', /^tel:\+?\d+$/);
    await expect(header.workingHours).toBeVisible();

    await expect(header.topBarAuthLink).toBeVisible();
    await expect(header.topBarAuthLink).toHaveAttribute('href', /\/(vkhid|kabinet)/);
  });

  test('logo navigates back to home', async ({ page }) => {
    await header.openTopBarAuth();
    await expect(page).not.toHaveURL(/\/$/);

    await header.goToHome();
    await expect(page).toHaveURL(/\/$/);
  });

  test('exposes catalog button, search and account controls', async () => {
    await expect(header.catalogButton).toBeVisible();
    await expect(header.searchInput).toBeVisible();
    await expect(header.searchInput).toHaveAttribute('placeholder', 'Пошук товарів...');
    await expect(header.searchSubmitButton).toBeVisible();
    await expect(header.favoritesLink).toBeVisible();
    await expect(header.cartButton).toBeVisible();
  });

  test('search submits via the button', async ({ page }) => {
    await header.submitSearch('генератор');
    await expect(page).not.toHaveURL(/\/$/);
    await expect(page.url()).toContain;
    expect(page.url()).toMatch(/poshuk|search|q=/i);
  });

  test('typing into search opens the autocomplete listbox', async ({ page }) => {
    await header.searchInput.fill('дриль');
    await expect(header.searchInput).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('listbox')).toBeVisible();
  });

  test('header stays in viewport while scrolling (sticky)', async ({ page }) => {
    await page.mouse.wheel(0, 2000);
    await expect(header.root).toBeInViewport();
  });

  test('favorites link routes away from home', async ({ page }) => {
    await header.openFavorites();
    await expect(page).not.toHaveURL(/\/$/);
  });

  test('cart trigger reacts to click', async ({ page }) => {
    await header.openCart();
    const navigated = !page.url().endsWith('/');
    const dialogVisible = await page
      .getByRole('dialog')
      .first()
      .isVisible()
      .catch(() => false);
    expect(navigated || dialogVisible).toBe(true);
  });

  test('mobile-only controls are hidden on desktop', async () => {
    await expect(header.openMobileMenuButton).toBeHidden();
  });
});

test.describe('Header — mobile', () => {
  test.use({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });

  let header: Header;

  test.beforeEach(async ({ page }) => {
    header = new Header(page);
    await page.goto('/');
    await header.expectVisible();
  });

  test('shows mobile menu trigger and inline search bar', async () => {
    await expect(header.openMobileMenuButton).toBeVisible();
    await expect(header.searchInput).toBeVisible();
    await expect(header.catalogButton).toBeHidden();
  });

  test('drawer opens and closes', async () => {
    await header.expectMobileMenuClosed();

    await header.openMobileMenu();
    await expect(header.mobileMenuNav).toBeVisible();
    await expect(header.mobileLoginLink).toBeVisible();
    await expect(header.mobileCartLink).toBeVisible();

    await header.closeMobileMenu();
  });

  test('drawer category link navigates to its page', async ({ page }) => {
    await header.openMobileMenu();
    await header.openCategoryFromMobileMenu('Агротехніка');
    await expect(page).toHaveURL(/\/kategoriya\/agrotekhnika/);
  });

  test('mobile search opens autocomplete on input', async ({ page }) => {
    await header.searchInput.fill('пила');
    await expect(header.searchInput).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('listbox')).toBeVisible();
  });
});

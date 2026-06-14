import { test, expect } from '../../src/fixtures';

test.describe('Header — desktop', () => {
  test('top bar renders correctly', async ({ header }) => {
    await expect(header.desktop.phoneLink).toBeVisible();
    await expect(header.desktop.phoneLink).toHaveAttribute('href', 'tel:+380988584035');

    await expect(header.desktop.workingHours).toBeVisible();

    await expect(header.desktop.topBarAuthLink).toBeVisible();
    await expect(header.desktop.topBarAuthLink).toHaveText('Увійти');
    await expect(header.desktop.topBarAuthLink).toHaveAttribute('href', '/vkhid');
  });

  test('navigation elements are visible', async ({ header }) => {
    await expect(header.desktop.catalogButton).toBeVisible();
    await expect(header.desktop.searchInput).toBeVisible();
    await expect(header.desktop.searchSubmitButton).toBeVisible();
    await expect(header.desktop.favoritesLink).toBeVisible();
    await expect(header.desktop.cartButton).toBeVisible();
  });

  test('search works', async ({ header, page }) => {
    await header.desktop.submitSearch('генератор');
    await expect(page).toHaveURL(/\/poshuk(?:[/?#]|$)/);
  });

  test('autocomplete opens on input', async ({ header }) => {
    await header.desktop.typeSearch('дриль');
    await expect(header.desktop.searchInput).toHaveAttribute('aria-expanded', 'true');
    await expect(header.desktop.searchListbox).toBeVisible();
  });

  test('sticky header stays in viewport', async ({ header, page }) => {
    await page.mouse.wheel(0, 2000);
    await expect(header.root).toBeInViewport();
  });

  test('favorites navigation works', async ({ header, page }) => {
    await header.desktop.openFavorites();
    await expect(page).toHaveURL(/\/bazhannya(?:[/?#]|$)/);
  });

  test('cart opens dialog', async ({ header }) => {
    await header.desktop.openCart();

    await header.cart.expectOpened();
  });

  test('mobile controls hidden on desktop', async ({ header }) => {
    await expect(header.mobile.openButton).toBeHidden();
  });
});


test.describe('Header — mobile', () => {
  test.use({
    viewport: { width: 393, height: 851 },
    isMobile: true,
    hasTouch: true,
  });

  test('mobile header layout', async ({ header }) => {
    await expect(header.mobile.openButton).toBeVisible();
    await expect(header.desktop.searchInput).toBeVisible();
    await expect(header.desktop.catalogButton).toBeHidden();
  });

  test('drawer opens and closes', async ({ header }) => {
    await header.mobile.expectClosed();

    await header.mobile.open();

    await expect(header.mobile.mobileMenuNav).toBeVisible();

    await header.mobile.close();

    await header.mobile.expectClosed();
  });

  test('drawer navigation links are visible', async ({ header }) => {
    await header.mobile.open();

    await expect(header.mobile.loginLink).toHaveAttribute('href', '/vkhid');
    await expect(header.mobile.cartLink).toHaveAttribute('href', '/koshyk');
  });

  test('mobile search autocomplete works', async ({ header }) => {
    await header.desktop.typeSearch('пила');

    await expect(header.desktop.searchInput).toHaveAttribute('aria-expanded', 'true');
    await expect(header.desktop.searchListbox).toBeVisible();
  });

  test('category navigation works', async ({ header, page }) => {
    await header.mobile.open();

    await header.mobile.openCategory('Агротехніка');

    await expect(page).toHaveURL(/\/kategoriya\/agrotekhnika(?:[/?#]|$)/);
  });
});
import { test, expect } from '../../src/fixtures';

test.describe('Header — desktop', () => {
  test('top bar shows phone, working hours and auth link', async ({
    header,
  }) => {
    await expect(header.phoneLink).toBeVisible();
    await expect(header.phoneLink).toHaveAttribute('href', 'tel:+380988584035');
    await expect(header.workingHours).toBeVisible();

    await expect(header.topBarAuthLink).toBeVisible();
    await expect(header.topBarAuthLink).toHaveText('Увійти');
    await expect(header.topBarAuthLink).toHaveAttribute('href', '/vkhid');
  });

  test('logo returns to home from a sub-page', async ({ header, page }) => {
    await header.openTopBarAuth();
    await expect(page).toHaveURL(/\/vkhid(?:[/?#]|$)/);

    await header.goToHome();
    await expect(page).toHaveURL('/');
  });

  test('main bar exposes catalog, search and account controls', async ({
    header,
  }) => {
    await expect(header.catalogButton).toBeVisible();
    await expect(header.searchInput).toBeVisible();
    await expect(header.searchInput).toHaveAttribute(
      'placeholder',
      'Пошук товарів...',
    );
    await expect(header.searchSubmitButton).toBeVisible();
    await expect(header.favoritesLink).toBeVisible();
    await expect(header.cartButton).toBeVisible();
  });

  test('search button submits the query to /poshuk', async ({
    header,
    page,
  }) => {
    await header.submitSearch('генератор');
    await expect(page).toHaveURL(/\/poshuk(?:[/?#]|$)/);
  });

  test('typing into search opens the autocomplete listbox', async ({
    header,
  }) => {
    await header.typeSearch('дриль');
    await expect(header.searchInput).toHaveAttribute('aria-expanded', 'true');
    await expect(header.searchListbox).toBeVisible();
  });

  test('header stays in viewport while scrolling (sticky)', async ({
    header,
    page,
  }) => {
    await page.mouse.wheel(0, 2000);
    await expect(header.root).toBeInViewport();
  });

  test('favorites link routes to /bazhannya', async ({ header, page }) => {
    await header.openFavorites();
    await expect(page).toHaveURL(/\/bazhannya(?:[/?#]|$)/);
  });

  test('cart trigger opens the cart dialog', async ({ header, page }) => {
    await header.openCart();
    await expect(page.getByRole('dialog').first()).toBeVisible();
  });

  test('mobile-only controls are hidden on desktop', async ({ header }) => {
    await expect(header.openMobileMenuButton).toBeHidden();
  });
});

test.describe('Header — mobile', () => {
  test.use({
    viewport: { width: 393, height: 851 },
    isMobile: true,
    hasTouch: true,
  });

  test('shows mobile menu trigger and inline search bar', async ({
    header,
  }) => {
    await expect(header.openMobileMenuButton).toBeVisible();
    await expect(header.searchInput).toBeVisible();
    await expect(header.catalogButton).toBeHidden();
  });

  test('drawer opens, lists nav items and closes', async ({ header }) => {
    await header.expectMobileMenuClosed();

    await header.openMobileMenu();
    await expect(header.mobileMenuNav).toBeVisible();
    await expect(header.mobileLoginLink).toHaveAttribute(
      'href',
      '/coming-soon',
    );
    await expect(header.mobileCartLink).toHaveAttribute('href', '/coming-soon');

    await header.closeMobileMenu();
  });

  test('drawer category link navigates to its page', async ({
    header,
    page,
  }) => {
    await header.openMobileMenu();
    await header.openCategoryFromMobileMenu('Агротехніка');
    await expect(page).toHaveURL(/\/kategoriya\/agrotekhnika(?:[/?#]|$)/);
  });

  test('typing into mobile search opens the autocomplete listbox', async ({
    header,
  }) => {
    await header.typeSearch('пила');
    await expect(header.searchInput).toHaveAttribute('aria-expanded', 'true');
    await expect(header.searchListbox).toBeVisible();
  });
});

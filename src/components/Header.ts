import { Locator, Page, expect } from '@playwright/test';

export class Header {
  readonly page: Page;
  readonly root: Locator;

  readonly phoneLink: Locator;
  readonly workingHours: Locator;
  readonly topBarAuthLink: Locator;

  readonly logoLink: Locator;
  readonly catalogButton: Locator;

  readonly searchInput: Locator;
  readonly searchSubmitButton: Locator;
  readonly searchListbox: Locator;

  readonly favoritesLink: Locator;
  readonly cartButton: Locator;

  readonly openMobileMenuButton: Locator;
  readonly mobileMenu: Locator;
  readonly closeMobileMenuButton: Locator;
  readonly mobileMenuNav: Locator;
  readonly mobileLoginLink: Locator;
  readonly mobileCartLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByRole('banner');

    const topBar = this.root
      .locator('div')
      .filter({ hasText: 'Пн-Пт' })
      .first();
    this.phoneLink = topBar.locator('a[href^="tel:"]');
    this.workingHours = topBar.getByText('Пн-Пт 9:00-18:00');
    this.topBarAuthLink = topBar.getByRole('link', {
      name: /^(Увійти|Кабінет)$/,
    });

    this.logoLink = this.root.locator('a[href="/"]');
    this.catalogButton = this.root.getByRole('button', { name: 'Каталог' });

    this.searchInput = this.root
      .getByRole('combobox', { name: 'Пошук товарів' })
      .filter({ visible: true });
    this.searchSubmitButton = this.root
      .getByRole('button', { name: 'Знайти' })
      .filter({ visible: true });
    this.searchListbox = this.root.getByRole('listbox');

    this.favoritesLink = this.root.getByRole('link', { name: 'Обране' });
    this.cartButton = this.root.getByRole('button', { name: 'Кошик' });

    this.openMobileMenuButton = this.root.getByRole('button', {
      name: 'Відкрити меню',
    });
    this.mobileMenu = this.root.getByRole('dialog', {
      name: 'Навігаційне меню',
    });
    this.closeMobileMenuButton = this.mobileMenu.getByRole('button', {
      name: 'Закрити меню',
    });
    this.mobileMenuNav = this.mobileMenu.getByRole('navigation', {
      name: 'Основна навігація',
    });
    this.mobileLoginLink = this.mobileMenu.getByRole('link', {
      name: 'Увійти',
    });
    this.mobileCartLink = this.mobileMenu.getByRole('link', { name: 'Кошик' });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.root).toBeVisible();
    await expect(this.logoLink).toBeVisible();
  }

  async goToHome(): Promise<void> {
    await this.logoLink.click();
  }

  async openTopBarAuth(): Promise<void> {
    await this.topBarAuthLink.click();
  }

  async typeSearch(query: string): Promise<void> {
    await this.searchInput.fill(query);
  }

  async submitSearch(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchSubmitButton.click();
  }

  async openCatalog(): Promise<void> {
    await this.catalogButton.click();
  }

  async openFavorites(): Promise<void> {
    await this.favoritesLink.click();
  }

  async openCart(): Promise<void> {
    await this.cartButton.click();
  }

  async openMobileMenu(): Promise<void> {
    await this.openMobileMenuButton.click();
    await this.expectMobileMenuOpen();
  }

  async closeMobileMenu(): Promise<void> {
    await this.closeMobileMenuButton.click();
    await this.expectMobileMenuClosed();
  }

  async expectMobileMenuOpen(): Promise<void> {
    await expect(this.mobileMenu).not.toHaveClass(/-translate-x-full/);
  }

  async expectMobileMenuClosed(): Promise<void> {
    await expect(this.mobileMenu).toHaveClass(/-translate-x-full/);
  }

  async openCategoryFromMobileMenu(name: string | RegExp): Promise<void> {
    await this.mobileMenuNav.getByRole('link', { name }).click();
  }
}

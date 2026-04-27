import { Locator, Page, expect } from '@playwright/test';

export class Header {
  readonly page: Page;
  readonly root: Locator;

  readonly phoneLink: Locator;
  readonly workingHours: Locator;
  readonly topBarAuthLink: Locator;

  readonly openMobileMenuButton: Locator;
  readonly mobileMenu: Locator;
  readonly closeMobileMenuButton: Locator;
  readonly mobileMenuSearchLink: Locator;
  readonly mobileMenuNav: Locator;
  readonly mobileLoginLink: Locator;
  readonly mobileCartLink: Locator;

  readonly logoLink: Locator;

  readonly catalogButton: Locator;
  readonly searchInput: Locator;
  readonly searchSubmitButton: Locator;

  readonly favoritesLink: Locator;
  readonly cartButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator('header');

    this.phoneLink = this.root.locator('a[href^="tel:"]');
    this.workingHours = this.root.getByText('Пн-Пт 9:00-18:00');
    this.topBarAuthLink = this.root
      .locator('div.hidden.md\\:block a')
      .filter({ hasText: /Увійти|Кабінет/ });

    this.openMobileMenuButton = this.root.getByRole('button', { name: 'Відкрити меню' });
    this.mobileMenu = this.root.getByRole('dialog', { name: 'Навігаційне меню' });
    this.closeMobileMenuButton = this.mobileMenu.getByRole('button', { name: 'Закрити меню' });
    this.mobileMenuSearchLink = this.mobileMenu.getByRole('link', { name: 'Пошук товарів...' });
    this.mobileMenuNav = this.mobileMenu.getByRole('navigation', { name: 'Основна навігація' });
    this.mobileLoginLink = this.mobileMenu.getByRole('link', { name: 'Увійти' });
    this.mobileCartLink = this.mobileMenu.getByRole('link', { name: 'Кошик' });

    this.logoLink = this.root.locator('a[href="/"]').first();

    this.catalogButton = this.root.getByRole('button', { name: 'Каталог' });
    this.searchInput = this.root
      .getByRole('combobox', { name: 'Пошук товарів' })
      .locator('visible=true');
    this.searchSubmitButton = this.root
      .getByRole('button', { name: 'Знайти' })
      .locator('visible=true');

    this.favoritesLink = this.root.getByRole('link', { name: 'Обране' });
    this.cartButton = this.root.locator('[aria-label="Кошик"]').first();
  }

  async expectVisible(): Promise<void> {
    await expect(this.root).toBeVisible();
    await expect(this.logoLink).toBeVisible();
  }

  async goToHome(): Promise<void> {
    await this.logoLink.click();
  }

  async openTopBarAuth(): Promise<void> {
    await this.topBarAuthLink.click();
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
  }

  async submitSearch(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchSubmitButton.click();
  }

  async openCatalog(): Promise<void> {
    await this.catalogButton.click();
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

  async openFavorites(): Promise<void> {
    await this.favoritesLink.click();
  }

  async openCart(): Promise<void> {
    await this.cartButton.click();
  }
}

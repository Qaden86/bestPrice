import { Locator, Page, expect } from '@playwright/test';

export class DesktopHeader {
  constructor(private page: Page, private root: Locator) {}

  phoneLink = this.root.locator('a[href^="tel:"]').first();

  workingHours = this.root.getByText('Пн-Пт 9:00-18:00');

  topBarAuthLink = this.root.getByRole('link', { name: /Увійти|Кабінет/ });

  catalogButton = this.root.getByRole('button', { name: 'Каталог' });

  searchInput = this.root.getByRole('combobox', { name: 'Пошук товарів' });

  searchSubmitButton = this.root
    .locator('[data-testid="header-search-submit"]')
    .first();

  searchListbox = this.root.getByRole('listbox');

  favoritesLink = this.root.getByRole('link', { name: 'Обране' });

  cartButton = this.root.getByRole('button', { name: 'Кошик' });

  async typeSearch(text: string) {
    await this.searchInput.fill(text);
  }

  async submitSearch(text: string) {
    await this.searchInput.fill(text);
    await this.searchSubmitButton.click();
  }

  async openFavorites() {
    await this.favoritesLink.click();
  }

  async openCart() {
    await this.cartButton.click();
  }
}
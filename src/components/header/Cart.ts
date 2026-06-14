import { Page, Locator, expect } from '@playwright/test';

export class Cart {
  readonly page: Page;
  readonly dialog: Locator;
  readonly title: Locator;

  constructor(page: Page) {
    this.page = page;

    this.dialog = page.locator('[data-slot="sheet-content"]');
    this.title = this.dialog.getByRole('heading', { name: 'Кошик' });
  }

  async expectOpened() {
    await expect(this.dialog).toBeVisible();
    await expect(this.title).toBeVisible();
  }
}
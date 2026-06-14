import { Locator, expect } from '@playwright/test';

export class MobileHeader {
  constructor(private page, private root: Locator) {}

  openButton = this.root.getByRole('button', { name: 'Відкрити меню' });

  mobileMenu = this.root.getByRole('dialog', { name: 'Навігаційне меню' });

  mobileMenuNav = this.mobileMenu.getByRole('navigation');

  loginLink = this.mobileMenu.getByRole('link', { name: 'Увійти' });

  cartLink = this.mobileMenu.getByRole('link', { name: 'Кошик' });

  async open() {
    await this.openButton.click();
  }

  async close() {
    await this.mobileMenu.getByRole('button', { name: 'Закрити меню' }).click();
  }

  async expectClosed() {
    await expect(this.mobileMenu).toHaveClass(/-translate-x-full/);
  }

  async openCategory(name: string) {
    await this.mobileMenuNav.getByRole('link', { name }).click();
  }
}
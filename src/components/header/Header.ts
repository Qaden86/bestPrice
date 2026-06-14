import { Page, Locator } from '@playwright/test';
import { DesktopHeader } from './DesktopHeader';
import { MobileHeader } from './MobileHeader';
import { Cart } from './Cart';

export class Header {
  readonly root: Locator;

  readonly desktop: DesktopHeader;
  readonly mobile: MobileHeader;
  readonly cart: Cart;

  constructor(public page: Page) {
    this.root = page.getByRole('banner');

    this.desktop = new DesktopHeader(page, this.root);
    this.mobile = new MobileHeader(page, this.root);
    this.cart = new Cart(page);
  }
}
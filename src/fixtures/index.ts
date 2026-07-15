import { test as base, expect } from '@playwright/test';
import { Header } from '../components/Header';

type Fixtures = {
  header: Header;
};

export const test = base.extend<Fixtures>({
  header: async ({ page }, use) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const header = new Header(page);
    await header.expectLoaded();
    await use(header);
  },
});

export { expect };

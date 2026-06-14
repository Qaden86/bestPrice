import { test as base, expect } from '@playwright/test';
import { Header } from '../components/header/Header';

export const test = base.extend({
  header: async ({ page }, use) => {
    await page.goto('/');
    await use(new Header(page));
  },
});

export { expect };
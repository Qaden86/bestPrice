import { Page } from 'playwright';

export async function dismissOverlays(page: Page): Promise<void> {
  const candidates = [
    '[data-testid="cookie-accept"]',
    '[data-testid="cookies-accept"]',
    'button:has-text("Прийняти")',
    'button:has-text("Погоджуюсь")',
    'button:has-text("OK")',
  ];

  for (const selector of candidates) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 2_000 }).catch(() => {});
      await page.waitForTimeout(200);
      return;
    }
  }
}

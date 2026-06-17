import { Page } from 'playwright';
import fs from 'fs';
import path from 'path';

import { SCREENSHOTS_DIR } from '../../config/path';

const SCREENSHOT_TIMEOUT_MS = Number(
  process.env.CRAWL_SCREENSHOT_TIMEOUT_MS ?? 8_000,
);

let screenshotsEnabled = true;

export function setScreenshotsEnabled(enabled: boolean): void {
  screenshotsEnabled = enabled;
}

export function areScreenshotsEnabled(): boolean {
  return screenshotsEnabled;
}

export async function takeScreenshot(
  page: Page,
  name: string,
): Promise<string | null> {
  if (!screenshotsEnabled) {
    return null;
  }

  try {
    const dir = SCREENSHOTS_DIR;

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, `${name}-${Date.now()}.png`);

    await page.screenshot({
      path: filePath,
      fullPage: false,
      timeout: SCREENSHOT_TIMEOUT_MS,
    });

    return filePath;
  } catch (e) {
    console.warn(
      '[screenshot] skipped',
      name,
      (e as Error).message?.slice(0, 120) ?? e,
    );
    return null;
  }
}

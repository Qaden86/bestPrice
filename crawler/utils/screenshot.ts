/**
 * SCREENSHOT UTILITY
 *
 * Captures browser state when something fails.
 *
 * This is critical for:
 * - debugging flaky selectors
 * - understanding UI state at failure time
 * - incident investigation
 */

import { Page } from 'playwright';
import fs from 'fs';
import path from 'path';

import { SCREENSHOTS_DIR } from '../../config/path';

export async function takeScreenshot(page: Page, name: string) {
  const dir = SCREENSHOTS_DIR;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `${name}-${Date.now()}.png`);

  await page.screenshot({
    path: filePath,
    fullPage: true,
  });

  return filePath;
}

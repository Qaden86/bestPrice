import { crawl } from './crawl';
import { chromium } from 'playwright';
import { RESULTS_PATH } from '../config/path';
import fs from 'fs';

function log(step: string, data?: any) {
  console.log(`[ENGINE:${step}]`, data ?? '');
}

export async function runEngine(urls: any[]) {
  log('START', { input: urls.length });

  // 💣 ALWAYS CLEAN FILE
  fs.writeFileSync(RESULTS_PATH, '[]', 'utf-8');

  // 🔥 HARD LIMIT 5 URL
  const limited = urls.slice(0, 100);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const results: any[] = [];

  for (const [i, item] of limited.entries()) {
    console.log(`\n[CRAWL ${i + 1}/${limited.length}]`, item.url);

    const page = await context.newPage();

    try {
      const r = await crawl(page, item.url);
      results.push(r);
    } catch (e: any) {
      results.push({
        url: item.url,
        status: 'ERROR',
        reason: e.message,
      });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  log('DONE', {
    input: urls.length,
    processed: results.length,
  });

  fs.writeFileSync(
    RESULTS_PATH,
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  return results;
}
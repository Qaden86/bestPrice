import fs from 'fs';
import { chromium } from 'playwright';

import { crawl } from './crawl';
import { RESULTS_PATH } from '../config/path';

type UrlItem = {
  url: string;
};

function log(step: string, data?: any) {
  console.log(`[ENGINE:${step}]`, data ?? '');
}

export async function runEngine(urls: UrlItem[]) {
  fs.writeFileSync(
    RESULTS_PATH,
    JSON.stringify([], null, 2),
    'utf-8'
  );

  log('START', {
    input: urls.length,
  });

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext();

  const results: any[] = [];

  for (const [index, item] of urls.entries()) {
    console.log(
      `\n[CRAWL ${index + 1}/${urls.length}]`,
      item.url
    );

    const page = await context.newPage();

    try {
      const result = await crawl(page, item.url);

      results.push(result);
    } catch (e: any) {
      results.push({
        url: item.url,
        status: 'ERROR',
        reason: e.message,
      });
    } finally {
      await page.close();

      await new Promise(r =>
        setTimeout(
          r,
          1000 + Math.random() * 2000
        )
      );
    }
  }

  await browser.close();

  fs.writeFileSync(
    RESULTS_PATH,
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  log('DONE', {
    input: urls.length,
    processed: results.length,
  });

  return results;
}
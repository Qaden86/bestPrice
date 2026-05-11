import { chromium } from '@playwright/test';
import { crawlItem } from './crawl-item';

export async function worker(urls: string[], id: number) {
  const browser = await chromium.launch({ headless: false });

  const context = await browser.newContext(); // 🔥 FIX: изоляция корзины
  const page = await context.newPage();

  const results = [];

  let i = 0;

  for (const url of urls) {
    i++;

    console.log(`[worker ${id}] ${i}/${urls.length} -> ${url}`);

    const result = await crawlItem(page, url);

    results.push(result);
  }

  await browser.close();

  return results;
}
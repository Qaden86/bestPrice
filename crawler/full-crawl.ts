import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

import { chromium } from 'playwright';

import { getSitemapUrls } from '../tests/utils/sitemap';
import { isProductPage } from '../tests/utils/filter';

type Result = {
  url: string;

  htmlPrice: number | null;
  browserPrice: number | null;

  htmlOk: boolean;
  browserOk: boolean;

  finalOk: boolean;
};

async function extractPrice(url: string): Promise<number | null> {

  try {

    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const $ = cheerio.load(res.data);

    // -----------------------------------
    // 1. CSS SELECTORS
    // -----------------------------------

    const selectors = [
      '.price',
      '.product-price',
      '.price-value',
      '[data-price]',
      '.cost',
      '.product__price',
      '.price-current'
    ];

    for (const sel of selectors) {

      const text = $(sel).first().text().trim();

      const value = Number(
        text.replace(/[^\d]/g, '')
      );

      // 🔥 IMPORTANT
      // reject 0 price
      if (!isNaN(value) && value > 0) {
        return value;
      }
    }

    // -----------------------------------
    // 2. JSON-LD
    // -----------------------------------

    const scripts = $('script[type="application/ld+json"]');

    for (let i = 0; i < scripts.length; i++) {

      try {

        const raw = $(scripts[i]).html();

        if (!raw) continue;

        const json = JSON.parse(raw);

        const price = json?.offers?.price;

        const value = Number(price);

        if (!isNaN(value) && value > 0) {
          return value;
        }

      } catch {
        continue;
      }
    }

    // -----------------------------------
    // 3. REGEX FALLBACK
    // -----------------------------------

    const body = $('body').text();

    const matches = body.match(/\d[\d\s]{2,}\d/g);

    if (matches) {

      for (const m of matches) {

        const value = Number(
          m.replace(/[^\d]/g, '')
        );

        // 🔥 CRITICAL FIX
        // ignore fake tiny numbers
        if (
          !isNaN(value) &&
          value > 50 &&
          value < 1000000
        ) {
          return value;
        }
      }
    }

    return null;

  } catch {
    return null;
  }
}

async function extractBrowserPrice(
  url: string
): Promise<number | null> {

  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage();

  try {

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });

    await page.waitForTimeout(2000);

    const selectors = [
      '.price',
      '.product-price',
      '.price-value',
      '[data-price]',
      '.cost',
      '.product__price',
      '.price-current'
    ];

    for (const sel of selectors) {

      const loc = page.locator(sel).first();

      if (await loc.count()) {

        const text = await loc.innerText();

        const value = Number(
          text.replace(/[^\d]/g, '')
        );

        if (!isNaN(value) && value > 0) {

          await browser.close();

          return value;
        }
      }
    }

    await browser.close();

    return null;

  } catch {

    await browser.close();

    return null;
  }
}

async function run() {

  console.log('🚀 START HTML + BROWSER CRAWLER');

  const sitemap = await getSitemapUrls();

  const products = sitemap.filter(isProductPage);

  console.log(`TOTAL: ${products.length}`);

  const results: Result[] = [];

  let success = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {

    const item = products[i];

    // -----------------------------------
    // HTML VALIDATION
    // -----------------------------------

    const htmlPrice = await extractPrice(item.url);

    const htmlOk =
      htmlPrice !== null &&
      htmlPrice > 0;

    // -----------------------------------
    // BROWSER FALLBACK
    // -----------------------------------

    let browserPrice: number | null = null;
    let browserOk = false;

    if (!htmlOk) {

      console.log(`🌐 Browser fallback: ${item.url}`);

      browserPrice = await extractBrowserPrice(
        item.url
      );

      browserOk =
        browserPrice !== null &&
        browserPrice > 0;
    }

    // -----------------------------------
    // FINAL RESULT
    // -----------------------------------

    const finalOk = htmlOk || browserOk;

    results.push({
      url: item.url,

      htmlPrice,
      browserPrice,

      htmlOk,
      browserOk,

      finalOk
    });

    // -----------------------------------
    // STATS
    // -----------------------------------

    if (finalOk) {
      success++;
    } else {

      failed++;

      console.log(`❌ REAL FAIL: ${item.url}`);
    }

    // -----------------------------------
    // PROGRESS
    // -----------------------------------

    if (i % 50 === 0) {

      console.log(
        `📊 Progress: ${i}/${products.length}`
      );
    }
  }

  // -----------------------------------
  // RESULT
  // -----------------------------------

  console.log('\n--- RESULT ---');

  console.log(`TOTAL: ${products.length}`);
  console.log(`SUCCESS: ${success}`);
  console.log(`FAILED: ${failed}`);

  console.log(
    `SUCCESS RATE: ${(
      (success / products.length) * 100
    ).toFixed(2)}%`
  );

  fs.writeFileSync(
    'crawler-result.json',
    JSON.stringify(
      {
        results,
        success,
        failed
      },
      null,
      2
    )
  );

  console.log(
    '💾 saved crawler-result.json'
  );
}

run();
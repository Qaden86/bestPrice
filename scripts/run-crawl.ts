/**
 * ENTRYPOINT SCRIPT
 *
 * This is the application entrypoint.
 *
 * Responsibilities:
 * - fetch sitemap
 * - filter URLs (ingestion layer)
 * - start crawling engine
 *
 * This file simulates a production "job runner".
 */

import { getSitemapUrls } from '../crawler/ingestion/sitemapFetcher';
import { isProductPage } from '../crawler/ingestion/urlFilter';
import { runConcurrentEngine } from '../crawler/engine/concurrentEngine';
import { writeResults } from '../crawler/output/resultWriter';

async function main() {
  console.log('[ENTRY] concurrent crawler started');

  const LIMIT = Number(process.env.LIMIT || 10);

  // ---------------- INGESTION ----------------
  const allUrls = await getSitemapUrls();

  const productUrls = allUrls.filter(isProductPage).slice(0, LIMIT);

  console.log('[INGESTION]', productUrls.length);

  // ---------------- EXECUTION ----------------
  const results = await runConcurrentEngine({
    urls: productUrls,
    concurrency: 3,
  });

  writeResults(results);

  console.log('[DONE]', {
    total: results.length,
  });

  return results;
}

main();

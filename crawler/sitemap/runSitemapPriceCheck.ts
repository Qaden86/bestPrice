import fs from 'fs';
import pLimit from 'p-limit';
import { getSitemapUrls } from '../ingestion/sitemapFetcher';
import { isProductPage } from '../ingestion/urlFilter';
import {
  BASE_URL,
  getSitemapConcurrency,
  getSitemapLimit,
  SITEMAP_REQUEST_TIMEOUT_MS,
} from '../../config/env';
import { SITEMAP_FAILURES_PATH } from '../../config/path';
import { ensureDataDir } from '../output/ensureDataDir';
import { checkProductPrice, createSitemapHttpClient } from './productPriceCheck';
import type { ProductPriceCheckResult, SitemapPriceCheckSummary } from './types';

export type RunSitemapPriceCheckOptions = {
  /** Override env SITEMAP_LIMIT; undefined = use env default (50). Pass null for no limit. */
  limit?: number | null;
  concurrency?: number;
  writeFailures?: boolean;
};

export async function runSitemapPriceCheck(
  options: RunSitemapPriceCheckOptions = {},
): Promise<SitemapPriceCheckSummary> {
  const limit =
    options.limit === undefined ? getSitemapLimit() : options.limit === null ? undefined : options.limit;

  const concurrency = options.concurrency ?? getSitemapConcurrency();
  const writeFailures = options.writeFailures ?? true;

  const client = createSitemapHttpClient(BASE_URL);
  const allItems = await getSitemapUrls();
  const productItems = allItems.filter(isProductPage);
  const urls =
    limit === undefined ? productItems.map((i) => i.url) : productItems.slice(0, limit).map((i) => i.url);

  console.log(
    `[sitemap] checking ${urls.length} of ${productItems.length} product URL(s) ` +
      `(sitemap total: ${allItems.length}) with concurrency ${concurrency}`,
  );

  const limiter = pLimit(concurrency);
  const results = await Promise.all(
    urls.map((url) =>
      limiter(() => checkProductPrice(client, url, SITEMAP_REQUEST_TIMEOUT_MS)),
    ),
  );

  const failures = results.filter((r) => !r.ok);
  let failuresPath: string | null = null;

  if (writeFailures && failures.length > 0) {
    ensureDataDir();
    failuresPath = SITEMAP_FAILURES_PATH;
    fs.writeFileSync(
      failuresPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          checked: results.length,
          failureCount: failures.length,
          failures,
        },
        null,
        2,
      ),
      'utf-8',
    );
    console.error(`[sitemap] wrote ${failures.length} failure(s) to ${failuresPath}`);
  }

  if (failures.length > 0) {
    const preview = failures
      .slice(0, 50)
      .map((f) => `  - [${f.status || 'ERR'}] ${f.url} — ${f.error}`)
      .join('\n');
    const more = failures.length > 50 ? `\n  ...and ${failures.length - 50} more` : '';
    console.error(`[sitemap] ${failures.length} product(s) without a valid price:\n${preview}${more}`);
  }

  return {
    checked: results.length,
    productTotal: productItems.length,
    sitemapTotal: allItems.length,
    failures,
    failuresPath,
  };
}

export function formatSitemapFailureMessage(summary: SitemapPriceCheckSummary): string {
  return `${summary.failures.length} of ${summary.checked} products are missing a positive JSON-LD offer price`;
}

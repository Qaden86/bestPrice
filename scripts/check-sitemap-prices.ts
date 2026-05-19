/**
 * CLI entry for full or custom sitemap price checks (no Playwright runner).
 *
 * Examples:
 *   npm run check:sitemap
 *   SITEMAP_LIMIT=all npm run check:sitemap
 *   SITEMAP_LIMIT=200 SITEMAP_CONCURRENCY=30 npm run check:sitemap
 */

import {
  formatSitemapFailureMessage,
  runSitemapPriceCheck,
} from '../crawler/sitemap/runSitemapPriceCheck';

async function main() {
  const summary = await runSitemapPriceCheck();

  if (summary.failures.length > 0) {
    console.error(formatSitemapFailureMessage(summary));
    process.exit(1);
  }

  console.log(`[sitemap] OK — ${summary.checked} product(s) checked`);
}

main().catch((err) => {
  console.error('[sitemap] fatal', err);
  process.exit(1);
});

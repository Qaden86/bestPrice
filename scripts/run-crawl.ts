import { runEngine } from '../crawler/engine';

import { getSitemapUrls } from '../crawler/utils/sitemap';
import { isProductPage } from '../crawler/utils/filter';

console.log('[ENTRY] start');

async function main() {
  const LIMIT = Number(process.env.LIMIT || 1);

  const allUrls = await getSitemapUrls();

  const productUrls =
    allUrls.filter(isProductPage);

  console.log(
    '[PRODUCT URLS]',
    productUrls.length
  );

  const limited =
    productUrls.slice(0, LIMIT);

  const results =
    await runEngine(limited);

  console.log(
    '[FINAL RESULTS]',
    results
  );
}

main();
import { getSitemapUrls } from '../crawler/utils/sitemap';
import { isProductPage } from '../crawler/utils/filter';
import { runEngine } from '../crawler/engine';

console.log('[ENTRY] start');

async function main() {
  const all = await getSitemapUrls();

  const products = all.filter(isProductPage);

  console.log('[PRODUCT URLS]', products.length);

  const results = await runEngine(products.slice(0, 100));

  console.log('[FINAL RESULTS]', results);
}

main();
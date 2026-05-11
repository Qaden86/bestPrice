import { getSitemapUrls } from '../tests/utils/sitemap';
import { fullCrawl } from '../crawler/full-crawl';

(async () => {
  const items = await getSitemapUrls();

  const urls = items
    .map(i => i.url)
    .filter(u => u.includes('/produkt/'))
    .slice(0, 1); // 🔥 DEBUG LIMIT

  console.log('TOTAL URLS:', urls.length);

  await fullCrawl(urls);

  console.log('CRAWL FINISHED');
})();
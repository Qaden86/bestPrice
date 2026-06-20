import { Browser, BrowserContext } from 'playwright';

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'font', 'media']);

const CRAWL_CONTEXT_OPTIONS = {
  locale: 'uk-UA',
  viewport: { width: 1280, height: 900 },
  userAgent:
    'Mozilla/5.0 (compatible; BestPriceCrawler/1.0; +https://bestprice.com.ua)',
} as const;

/**
 * Crawl-optimized context: blocks heavy assets, keeps DOM + scripts.
 */
export async function createCrawlContext(
  browser: Browser,
): Promise<BrowserContext> {
  const context = await browser.newContext(CRAWL_CONTEXT_OPTIONS);

  await context.route('**/*', (route) => {
    if (BLOCKED_RESOURCE_TYPES.has(route.request().resourceType())) {
      return route.abort();
    }
    return route.continue();
  });

  return context;
}

export function parseBrowserRotateAfter(): number {
  const raw = process.env.CRAWL_BROWSER_ROTATE_AFTER;
  if (!raw) return 200;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 200;
}

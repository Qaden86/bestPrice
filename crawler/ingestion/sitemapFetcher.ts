import axios from 'axios';
import * as xml2js from 'xml2js';

import { AppConfig } from '../../config/appConfig';

/**
 * INGESTION LAYER
 * Fetches URLs from sitemap source.
 */

export type SitemapItem = {
  url: string;
  id: string | null;
};

export async function getSitemapUrls(
  config: AppConfig,
): Promise<SitemapItem[]> {
  const sitemapUrl = `${config.baseUrl}/sitemap.xml`;

  console.log('[SITEMAP]', sitemapUrl);

  const timeout = Number(process.env.SITEMAP_REQUEST_TIMEOUT_MS ?? 15_000);
  const res = await axios.get(sitemapUrl, {
    timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 15_000,
  });

  const parsed = await xml2js.parseStringPromise(res.data, {
    explicitArray: false,
  });

  const urlset = parsed?.urlset?.url;

  if (!urlset) {
    throw new Error('Invalid sitemap');
  }

  const urls = Array.isArray(urlset) ? urlset : [urlset];

  return urls.map((u: any) => ({
    url: u.loc,
    id: u.productId || null,
  }));
}

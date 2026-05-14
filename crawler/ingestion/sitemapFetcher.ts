import axios from 'axios';
import * as xml2js from 'xml2js';
import { BASE_URL } from '../../config/env';

/**
 * INGESTION LAYER
 *
 * Responsible for fetching raw URLs from sitemap source.
 * This is the first stage of the pipeline.
 */

export type SitemapItem = {
  url: string;
  id: string | null;
};

export async function getSitemapUrls(): Promise<SitemapItem[]> {
  const sitemapUrl = `${BASE_URL}/sitemap.xml`;

  console.log('[SITEMAP]', sitemapUrl);

  const res = await axios.get(sitemapUrl);

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

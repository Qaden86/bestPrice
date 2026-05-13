import axios from 'axios';
import * as xml2js from 'xml2js';

export type SitemapItem = {
  url: string;
  id: string | null;
};

export async function getSitemapUrls(): Promise<SitemapItem[]> {
  const res = await axios.get('https://bestprice.com.ua/sitemap.xml');

  const parsed = await xml2js.parseStringPromise(res.data, {
    explicitArray: false,
  });

  const urlset = parsed?.urlset?.url;

  if (!urlset) throw new Error('Invalid sitemap structure');

  const urls = Array.isArray(urlset) ? urlset : [urlset];

  return urls.map((u: any) => ({
    url: u.loc,
    id: u['productId'] || null,
  }));
}
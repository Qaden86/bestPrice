import axios from 'axios';
import * as xml2js from 'xml2js';

export type SitemapItem = {
  url: string;
  id: string | null;
};

export async function getSitemapUrls(): Promise<SitemapItem[]> {

  const res = await axios.get('https://bestprice.com.ua/sitemap.xml');

  const parsed = await xml2js.parseStringPromise(res.data);

  return parsed.urlset.url.map((u: any) => ({
    url: u.loc[0],
    id: u['productId']?.[0] || null,
  }));
}
import axios, { AxiosInstance } from 'axios';
import { extractOfferPriceFromHtml } from '../extractors/jsonLdPriceExtractor';
import { retry } from '../retry/retry';
import type { ProductPriceCheckResult } from './types';

export function evaluateProductPage(
  url: string,
  status: number,
  html: string | null,
): ProductPriceCheckResult {
  if (status < 200 || status >= 300) {
    return {
      url,
      status,
      price: null,
      ok: false,
      error: `HTTP ${status}`,
    };
  }

  if (!html) {
    return { url, status, price: null, ok: false, error: 'empty response body' };
  }

  const price = extractOfferPriceFromHtml(html);

  if (price === null) {
    return { url, status, price: null, ok: false, error: 'offer price not found in JSON-LD' };
  }

  if (price <= 0) {
    return { url, status, price, ok: false, error: `non-positive price: ${price}` };
  }

  return { url, status, price, ok: true };
}

export async function checkProductPrice(
  client: AxiosInstance,
  url: string,
  timeoutMs: number,
): Promise<ProductPriceCheckResult> {
  try {
    const res = await retry(
      () =>
        client.get(url, {
          timeout: timeoutMs,
          maxRedirects: 5,
          validateStatus: () => true,
        }),
      { retries: 2, delay: 500 },
    );

    return evaluateProductPage(url, res.status, res.data as string);
  } catch (err) {
    return {
      url,
      status: 0,
      price: null,
      ok: false,
      error: (err as Error).message,
    };
  }
}

export function createSitemapHttpClient(baseUrl: string): AxiosInstance {
  return axios.create({
    headers: {
      'User-Agent': `Mozilla/5.0 (compatible; BestPriceSitemapCheck/1.0; +${baseUrl})`,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
}

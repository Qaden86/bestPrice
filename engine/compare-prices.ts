import { CrawlResult } from '../crawler/crawl-item';

export type FinalResult = CrawlResult & {
  finalOk: boolean | null;
  reason: string;
};

export function comparePrices(item: CrawlResult): FinalResult {

  if (!item.pdpPrice || !item.cartPrice) {
    return {
      ...item,
      finalOk: null,
      reason: 'INVALID_PRICE'
    };
  }

  if (item.pdpPrice !== item.cartPrice) {
    return {
      ...item,
      finalOk: false,
      reason: 'PRICE_MISMATCH'
    };
  }

  return {
    ...item,
    finalOk: true,
    reason: 'OK'
  };
}
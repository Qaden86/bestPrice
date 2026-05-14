/**
 * Single source of truth for crawler output
 */
export type CrawlResult = {
  url: string;

  pdpPrice: number | null;
  cartPrice: number | null;

  match: boolean;
  reason: string;

  status: 'OK' | 'FAIL';
};

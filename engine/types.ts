export type CrawlResult = {
  url: string;

  pdpPrice: number | null;
  cartPrice: number | null;

  priceOk: boolean | null;
  reason?: string;
};
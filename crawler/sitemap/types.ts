export type ProductPriceCheckResult = {
  url: string;
  status: number;
  price: number | null;
  ok: boolean;
  error?: string;
};

export type SitemapPriceCheckSummary = {
  checked: number;
  productTotal: number;
  sitemapTotal: number;
  failures: ProductPriceCheckResult[];
  failuresPath: string | null;
};

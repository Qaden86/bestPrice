const VAT_RATE = Number(process.env.CRAWL_VAT_RATE ?? 0.1);
const ALT_VAT_RATE = 0.2;
const MATCH_TOLERANCE_UAH = Number(process.env.CRAWL_PRICE_TOLERANCE_UAH ?? 0.51);

export function pricesMatch(pdp: number, cart: number): boolean {
  if (pdp === cart) {
    return true;
  }

  if (Math.abs(cart - roundMoney(pdp * (1 + VAT_RATE))) <= MATCH_TOLERANCE_UAH) {
    return true;
  }

  if (Math.abs(cart - roundMoney(pdp * (1 + ALT_VAT_RATE))) <= MATCH_TOLERANCE_UAH) {
    return true;
  }

  return false;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

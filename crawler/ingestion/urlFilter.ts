/**
 * INGESTION LAYER
 *
 * Responsible for selecting which URLs enter the crawling pipeline.
 * This is the FIRST stage of the system.
 */

export function isProductPage(item: { url: string }): boolean {
  return /\/produkt/i.test(item.url);
}

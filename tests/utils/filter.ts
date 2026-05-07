export function isProductPage(item: { url: string }): boolean {
  return item.url.includes('/produkt/');
}
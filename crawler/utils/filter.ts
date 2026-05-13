export function isProductPage(
  item: { url: string }
): boolean {
  return /\/produkt/i.test(item.url);
}
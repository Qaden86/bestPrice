/**
 * Shared price normalization for DOM text, JSON-LD, and numeric values.
 *
 * - JSON-LD often uses decimal strings like "1499.00" — parsed as 1499.
 * - UI text often looks like "1 499 ₴" — digits are concatenated after removing spaces.
 */
export function normalizePrice(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? Math.round(value * 100) / 100
      : null;
  }

  const raw = String(value)
    .replace(/\u00A0/g, ' ')
    .trim();

  if (!raw) {
    return null;
  }

  // ================================
  // safe separator handling
  // ================================
  const cleaned = raw
    .replace(/\s/g, '')
    .replace(/[^\d.,-]/g, '');

  if (!cleaned) {
  return null;
  }

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized = cleaned;

  if (lastComma > lastDot) {
    // EU format: 1.200,50 → 1200.50
    normalized =
      cleaned.slice(0, lastComma).replace(/\./g, '') +
      '.' +
      cleaned.slice(lastComma + 1);
  } else if (lastDot > lastComma) {
    // US format: 1,200.50 → 1200.50
    normalized =
      cleaned.slice(0, lastDot).replace(/,/g, '') +
      '.' +
      cleaned.slice(lastDot + 1);
  } else {
    // no decimals
    normalized = cleaned.replace(/,/g, '');
  }

  const num = Number(normalized);

  if (!Number.isFinite(num)) {
    return null;
  }

  return Math.round(num * 100) / 100;
}
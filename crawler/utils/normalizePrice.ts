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
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  }

  const raw = String(value)
    .replace(/\u00A0/g, ' ')
    .trim();
  if (!raw) {
    return null;
  }

  const compact = raw
    .replace(/\s/g, '')
    .replace(/[^\d.,-]/g, '')
    .replace(',', '.');

  if (/^-?\d+(\.\d+)?$/.test(compact)) {
    const n = Number(compact);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }

  const digitsOnly = raw.replace(/[^\d]/g, '');
  if (!digitsOnly) {
    return null;
  }

  const n2 = Number(digitsOnly);
  return Number.isFinite(n2) ? n2 : null;
}

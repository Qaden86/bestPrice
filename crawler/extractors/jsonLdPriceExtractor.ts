import * as cheerio from 'cheerio';
import { normalizePrice } from '../utils/normalizePrice';

function parseJsonLdBlocks(html: string): unknown[] {
  const $ = cheerio.load(html);
  const blocks: unknown[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).html()?.trim();
    if (!text) return;

    try {
      blocks.push(JSON.parse(text));
    } catch {
      // ignore malformed blocks
    }
  });

  return blocks;
}

function flattenNodes(node: unknown): Record<string, unknown>[] {
  if (node == null) {
    return [];
  }

  if (Array.isArray(node)) {
    return node.flatMap(flattenNodes);
  }

  if (typeof node !== 'object') {
    return [];
  }

  const obj = node as Record<string, unknown>;
  const graph = obj['@graph'];

  if (Array.isArray(graph)) {
    return graph.flatMap(flattenNodes);
  }

  return [obj];
}

function hasOfferType(type: unknown): boolean {
  if (typeof type === 'string') {
    return /\b(AggregateOffer|Offer)\b/i.test(type);
  }

  if (Array.isArray(type)) {
    return type.some(hasOfferType);
  }

  return false;
}

function priceFromOffer(offer: Record<string, unknown>): number | null {
  const raw = offer.price ?? offer.lowPrice ?? offer.highPrice;
  return normalizePrice(raw);
}

function collectOffers(node: Record<string, unknown>): Record<string, unknown>[] {
  const offers: Record<string, unknown>[] = [];

  if (hasOfferType(node['@type'])) {
    offers.push(node);
  }

  const nested = node.offers;
  if (nested) {
    const list = Array.isArray(nested) ? nested : [nested];
    for (const item of list) {
      if (item && typeof item === 'object') {
        offers.push(item as Record<string, unknown>);
      }
    }
  }

  return offers;
}

/**
 * Extracts the product offer price from schema.org JSON-LD embedded in HTML.
 */
export function extractOfferPriceFromHtml(html: string): number | null {
  const blocks = parseJsonLdBlocks(html);

  for (const block of blocks) {
    for (const node of flattenNodes(block)) {
      for (const offer of collectOffers(node)) {
        if (!hasOfferType(offer['@type']) && !offer.price && !offer.lowPrice) {
          continue;
        }

        const price = priceFromOffer(offer);
        if (price !== null && price > 0) {
          return price;
        }
      }
    }
  }

  return null;
}

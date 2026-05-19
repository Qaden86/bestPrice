import { describe, it, expect } from 'vitest';
import { extractOfferPriceFromHtml } from '@crawler/extractors/jsonLdPriceExtractor';

describe('extractOfferPriceFromHtml', () => {
  it('extracts price from a Product with nested Offer', () => {
    const html = `
      <html><body>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Test",
            "offers": {
              "@type": "Offer",
              "price": "1499.00",
              "priceCurrency": "UAH"
            }
          }
        </script>
      </body></html>
    `;

    expect(extractOfferPriceFromHtml(html)).toBe(1499);
  });

  it('extracts price from @graph with Offer node', () => {
    const html = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebPage", "name": "Page" },
            { "@type": "Offer", "price": "45.00", "priceCurrency": "UAH" }
          ]
        }
      </script>
    `;

    expect(extractOfferPriceFromHtml(html)).toBe(45);
  });

  it('ignores unrelated price fields when no Offer is present', () => {
    const html = `
      <script type="application/ld+json">
        { "@type": "Organization", "name": "Shop", "price": "1" }
      </script>
    `;

    expect(extractOfferPriceFromHtml(html)).toBeNull();
  });

  it('returns null when JSON-LD is missing', () => {
    expect(extractOfferPriceFromHtml('<html><body>no ld+json</body></html>')).toBeNull();
  });

  it('extracts lowPrice from AggregateOffer', () => {
    const html = `
      <script type="application/ld+json">
        {
          "@type": "Product",
          "offers": {
            "@type": "AggregateOffer",
            "lowPrice": "99.99",
            "priceCurrency": "UAH"
          }
        }
      </script>
    `;

    expect(extractOfferPriceFromHtml(html)).toBe(99.99);
  });
});

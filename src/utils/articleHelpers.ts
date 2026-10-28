import { Article, ArticleBrandOffer, WarehouseStock } from '../types';
import { formatFCFA } from './formatters';

/**
 * Returns all brand offers associated with an article.
 * Guaranteed to return at least one offer (the default brand if none specified).
 */
export function getArticleBrandOffers(article: Article): ArticleBrandOffer[] {
  if (article.brandOffers && article.brandOffers.length > 0) {
    return article.brandOffers;
  }
  return [
    {
      id: 'default',
      brand: article.brand || 'Générique',
      brandReference: article.mainReference,
      purchasePrice: article.purchasePrice || 0,
      salePrice: article.salePrice || 0,
      preferredSupplier: article.preferredSupplier,
      barcode: article.barcode,
      isDefault: true,
    },
  ];
}

/**
 * Gets the default brand offer for an article.
 */
export function getDefaultBrandOffer(article: Article): ArticleBrandOffer {
  const offers = getArticleBrandOffers(article);
  const def = offers.find((o) => o.isDefault);
  return def || offers[0];
}

/**
 * Finds a specific brand offer by brand name.
 */
export function getBrandOffer(article: Article, brandName?: string): ArticleBrandOffer | undefined {
  if (!brandName) return getDefaultBrandOffer(article);
  const offers = getArticleBrandOffers(article);
  return (
    offers.find((o) => o.brand.toLowerCase().trim() === brandName.toLowerCase().trim()) ||
    getDefaultBrandOffer(article)
  );
}

/**
 * Returns the list of distinct brand names handled for this article.
 */
export function getArticleAvailableBrands(article: Article): string[] {
  const offers = getArticleBrandOffers(article);
  const brands = offers.map((o) => o.brand.trim()).filter(Boolean);
  return Array.from(new Set(brands));
}

/**
 * Formats a clean price string or range for catalogue display.
 * If multiple brand offers have different prices, displays "18 000 — 35 000 FCFA".
 * If only one price, displays "25 000 FCFA".
 */
export function formatSalePriceRange(article: Article): string {
  const offers = getArticleBrandOffers(article);
  const prices = offers.map((o) => o.salePrice).filter((p) => p > 0);
  if (prices.length === 0) return formatFCFA(article.salePrice || 0);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) {
    return formatFCFA(min);
  }
  return `${formatFCFA(min)} — ${formatFCFA(max)}`;
}

/**
 * Formats a clean purchase price string or range for cost analysis.
 */
export function formatPurchasePriceRange(article: Article): string {
  const offers = getArticleBrandOffers(article);
  const prices = offers.map((o) => o.purchasePrice).filter((p) => p > 0);
  if (prices.length === 0) return formatFCFA(article.purchasePrice || 0);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) {
    return formatFCFA(min);
  }
  return `${formatFCFA(min)} — ${formatFCFA(max)}`;
}

/**
 * Computes the specific physical stock of a given brand inside a warehouse stock record.
 */
export function getBrandStock(
  stock: WarehouseStock | undefined,
  brandName: string,
  totalQty = 0
): number {
  if (!stock) return 0;
  if (stock.brandBreakdown && typeof stock.brandBreakdown === 'object') {
    const key = Object.keys(stock.brandBreakdown).find(
      (b) => b.toLowerCase().trim() === brandName.toLowerCase().trim()
    );
    if (key !== undefined) {
      return stock.brandBreakdown[key] ?? 0;
    }
  }
  return totalQty;
}

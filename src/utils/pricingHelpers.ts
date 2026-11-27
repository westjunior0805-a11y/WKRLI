import { Article, ArticleBrandOffer, WarehouseStock } from '../types';
import { cleanBrandName, getArticleBrandOffers, getBrandStockAcrossWarehouses } from './articleHelpers';

export interface MissingPriceRow {
  key: string;
  article: Article;
  brand: string;
  offerId?: string;
  purchasePrice: number;
  salePrice: number;
  stockQty: number;
  missingSale: boolean;
  missingPurchase: boolean;
}

/**
 * Vérifie si un article (ou l'une de ses déclinaisons de marque) n'a pas de prix de vente défini.
 */
export function hasMissingSalePrice(article: Article): boolean {
  const offers = getArticleBrandOffers(article);
  if (offers.length > 0) {
    return offers.some((o) => !o.salePrice || o.salePrice <= 0);
  }
  return !article.salePrice || article.salePrice <= 0;
}

/**
 * Vérifie si un article (ou l'une de ses déclinaisons de marque) n'a pas de prix d'achat défini.
 */
export function hasMissingPurchasePrice(article: Article): boolean {
  const offers = getArticleBrandOffers(article);
  if (offers.length > 0) {
    return offers.some((o) => !o.purchasePrice || o.purchasePrice <= 0);
  }
  return !article.purchasePrice || article.purchasePrice <= 0;
}

/**
 * Construit l'objet de mise à jour Partial<Article> pour enregistrer de nouveaux prix
 * sur une marque spécifique tout en maintenant la cohérence des champs racine de l'article.
 */
export function buildArticlePriceUpdate(
  article: Article,
  brandName: string | undefined,
  newSalePrice: number,
  newPurchasePrice?: number
): Partial<Article> {
  const cleanSale = Math.max(0, Math.round(Number(newSalePrice) || 0));
  const hasPurchaseUpdate =
    newPurchasePrice !== undefined && !Number.isNaN(Number(newPurchasePrice));
  const cleanPurchase = hasPurchaseUpdate
    ? Math.max(0, Math.round((Number(newPurchasePrice) || 0) * 100) / 100)
    : undefined;

  const targetBrand = cleanBrandName(brandName !== undefined ? brandName : article.brand);
  const normTarget = targetBrand.toLowerCase();
  const normArticleBrand = cleanBrandName(article.brand).toLowerCase();

  const existingOffers = article.brandOffers && article.brandOffers.length > 0
    ? article.brandOffers.map((o) => ({ ...o, brand: cleanBrandName(o.brand) }))
    : [];

  let nextOffers: ArticleBrandOffer[] | undefined;

  if (existingOffers.length > 0) {
    let matched = false;
    nextOffers = existingOffers.map((o) => {
      if (cleanBrandName(o.brand).toLowerCase() === normTarget) {
        matched = true;
        return {
          ...o,
          salePrice: cleanSale,
          purchasePrice: cleanPurchase !== undefined ? cleanPurchase : o.purchasePrice,
        };
      }
      return o;
    });

    if (!matched) {
      nextOffers.push({
        id: `bo_${article.id}_${Date.now()}`,
        brand: targetBrand,
        brandReference: article.mainReference,
        purchasePrice: cleanPurchase !== undefined ? cleanPurchase : article.purchasePrice || 0,
        salePrice: cleanSale,
        location: article.defaultLocation,
        isDefault: existingOffers.length === 0,
      });
    }
  }

  const shouldUpdateRoot =
    !existingOffers.length ||
    existingOffers.length === 1 ||
    normTarget === normArticleBrand ||
    article.salePrice <= 0;

  const updates: Partial<Article> = {};
  if (nextOffers) {
    updates.brandOffers = nextOffers;
  }
  if (shouldUpdateRoot) {
    updates.salePrice = cleanSale;
    if (cleanPurchase !== undefined && (cleanPurchase > 0 || article.purchasePrice <= 0)) {
      updates.purchasePrice = cleanPurchase;
    }
  } else if (cleanPurchase !== undefined && article.purchasePrice <= 0) {
    updates.purchasePrice = cleanPurchase;
  }

  return updates;
}

/**
 * Extrait toutes les lignes (article + marque) dont le prix de vente ou d'achat est manquant (<= 0).
 */
export function extractMissingPriceRows(
  articles: Article[],
  stocks: WarehouseStock[],
  warehouseId?: string | null
): MissingPriceRow[] {
  const rows: MissingPriceRow[] = [];
  const whFilter = warehouseId && warehouseId !== 'ALL' ? warehouseId : undefined;

  for (const article of articles) {
    if (article.status === 'archived') continue;

    const offers = getArticleBrandOffers(article);
    const listToCheck: Array<{ brand: string; id?: string; salePrice: number; purchasePrice: number }> =
      offers.length > 0
        ? offers.map((o) => ({
            brand: cleanBrandName(o.brand),
            id: o.id,
            salePrice: Number(o.salePrice) || 0,
            purchasePrice: Number(o.purchasePrice) || 0,
          }))
        : [
            {
              brand: cleanBrandName(article.brand),
              salePrice: Number(article.salePrice) || 0,
              purchasePrice: Number(article.purchasePrice) || 0,
            },
          ];

    for (const entry of listToCheck) {
      const missingSale = entry.salePrice <= 0;
      const missingPurchase = entry.purchasePrice <= 0;
      if (!missingSale && !missingPurchase) continue;

      const stockQty = getBrandStockAcrossWarehouses(stocks, article, entry.brand, whFilter);

      rows.push({
        key: `${article.id}__${entry.brand.toLowerCase()}`,
        article,
        brand: entry.brand,
        offerId: entry.id,
        purchasePrice: entry.purchasePrice,
        salePrice: entry.salePrice,
        stockQty,
        missingSale,
        missingPurchase,
      });
    }
  }

  // Trier : pièces en stock d'abord, puis par référence
  rows.sort((a, b) => {
    if (a.stockQty > 0 && b.stockQty <= 0) return -1;
    if (a.stockQty <= 0 && b.stockQty > 0) return 1;
    return a.article.mainReference.localeCompare(b.article.mainReference, 'fr', { numeric: true });
  });

  return rows;
}

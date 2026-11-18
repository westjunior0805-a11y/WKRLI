import { Article, ArticleBrandOffer, Warehouse, WarehouseStock } from '../types';
import { formatFCFA } from './formatters';

/**
 * Parses a single location segment to separate an optional "<Prefix> :" from the inner shelf code.
 */
function parseLocationSegment(seg: string): { prefix: string | null; innerLoc: string } {
  const trimmed = seg.trim();
  const colonMatch = trimmed.match(/^([^:]{2,45}?)\s*:\s*(.+)$/);
  if (!colonMatch) {
    return { prefix: null, innerLoc: trimmed };
  }
  const prefix = colonMatch[1].trim();
  let innerLoc = colonMatch[2].trim();
  // Strip any accidental repeated prefix inside innerLoc
  while (innerLoc.toLowerCase().startsWith(`${prefix.toLowerCase()} :`)) {
    innerLoc = innerLoc.slice(prefix.length + 2).trim();
  }
  while (innerLoc.toLowerCase().startsWith(`${prefix.toLowerCase()}:`)) {
    innerLoc = innerLoc.slice(prefix.length + 1).trim();
  }
  return { prefix, innerLoc };
}

function isEmptyLocationValue(val: string | undefined | null): boolean {
  if (!val) return true;
  const norm = val.trim().toLowerCase();
  return (
    !norm ||
    norm === 'non renseigné' ||
    norm === 'non renseigne' ||
    norm === 'non spécifié' ||
    norm === 'non specifie' ||
    norm === '-'
  );
}

/**
 * Strips any "<Magasin> :" prefix from a location string to return only the pure shelf/rack code.
 * Used when pre-filling single-warehouse location inputs.
 */
export function stripWarehousePrefix(
  rawLocation: string | undefined | null,
  warehouses?: Warehouse[],
  currentWarehouseName?: string | null
): string {
  if (isEmptyLocationValue(rawLocation)) return '';
  const segments = String(rawLocation)
    .split(/\s*\|\s*|\s*•\s*|\s*;\s*/)
    .map((s) => s.trim())
    .filter((s) => !isEmptyLocationValue(s));

  if (segments.length === 0) return '';

  const knownNames = new Set<string>();
  if (currentWarehouseName?.trim()) {
    knownNames.add(currentWarehouseName.trim().toLowerCase());
  }
  if (warehouses) {
    warehouses.forEach((w) => {
      if (w.name?.trim()) knownNames.add(w.name.trim().toLowerCase());
      if (w.code?.trim()) knownNames.add(w.code.trim().toLowerCase());
    });
  }

  const pureSegments: string[] = [];
  for (const seg of segments) {
    const { prefix, innerLoc } = parseLocationSegment(seg);
    if (isEmptyLocationValue(innerLoc)) continue;
    if (
      prefix &&
      (knownNames.size === 0 ||
        knownNames.has(prefix.toLowerCase()) ||
        currentWarehouseName?.toLowerCase().trim() === prefix.toLowerCase())
    ) {
      if (!pureSegments.includes(innerLoc)) pureSegments.push(innerLoc);
    } else if (prefix) {
      // Even if prefix wasn't in knownNames, strip it when editing a single warehouse shelf
      if (!pureSegments.includes(innerLoc)) pureSegments.push(innerLoc);
    } else {
      if (!pureSegments.includes(innerLoc)) pureSegments.push(innerLoc);
    }
  }

  return pureSegments.join(' • ');
}

/**
 * Formats a location string for a specific warehouse so every location segment is preceded by its relative warehouse name.
 * Always enforces `warehouseName` as the prefix when saving/formatting for that warehouse, preventing cross-warehouse prefix pollution.
 */
export function prefixLocationWithWarehouse(
  rawLocation: string | undefined | null,
  warehouseName?: string | null,
  warehouses?: Warehouse[]
): string {
  if (isEmptyLocationValue(rawLocation)) return 'Non renseigné';
  const trimmed = String(rawLocation).trim();

  const whName = (warehouseName || 'Magasin').trim() || 'Magasin';

  const segments = trimmed
    .split(/\s*\|\s*|\s*•\s*|\s*;\s*/)
    .map((s) => s.trim())
    .filter((s) => !isEmptyLocationValue(s));

  if (segments.length === 0) return 'Non renseigné';

  const formattedSegments: string[] = [];

  for (const seg of segments) {
    const { prefix, innerLoc } = parseLocationSegment(seg);
    if (isEmptyLocationValue(innerLoc)) continue;

    // If a specific warehouseName is provided, always prefix with whName
    // unless no warehouseName was passed and an existing warehouse prefix exists
    const finalPrefix = warehouseName?.trim()
      ? whName
      : prefix && (!warehouses || warehouses.some((w) => w.name.toLowerCase() === prefix.toLowerCase()))
      ? prefix
      : whName;

    const candidate = `${finalPrefix} : ${innerLoc}`;
    if (!formattedSegments.includes(candidate)) {
      formattedSegments.push(candidate);
    }
  }

  return formattedSegments.length > 0 ? formattedSegments.join(' • ') : 'Non renseigné';
}

export function isPlaceholderBrand(val: string | undefined | null): boolean {
  if (!val) return true;
  const norm = String(val).trim().toLowerCase();
  return (
    !norm ||
    norm === 'non spécifié' ||
    norm === 'non specifie' ||
    norm === 'non renseigné' ||
    norm === 'non renseigne' ||
    norm === 'générique' ||
    norm === 'generique' ||
    norm === 'aucune' ||
    norm === 'sans marque' ||
    norm === '-' ||
    norm === '—' ||
    norm === 'n/a'
  );
}

export function cleanBrandName(val: string | undefined | null): string {
  if (isPlaceholderBrand(val)) return '';
  return String(val).trim();
}

/**
 * Returns all brand offers associated with an article.
 * Guaranteed to return at least one offer (the default brand if none specified),
 * while stripping duplicate or stale placeholder offers when real brands exist.
 */
export function getArticleBrandOffers(article: Article): ArticleBrandOffer[] {
  const cleanPrimaryBrand = cleanBrandName(article.brand);

  if (article.brandOffers && article.brandOffers.length > 0) {
    const normalized = article.brandOffers.map((bo) => ({
      ...bo,
      brand: cleanBrandName(bo.brand),
    }));

    const hasRealBrand = normalized.some((bo) => Boolean(bo.brand)) || Boolean(cleanPrimaryBrand);

    const dedupMap = new Map<string, ArticleBrandOffer>();
    for (const bo of normalized) {
      // Skip empty placeholder offers if the article already has at least one real named brand offer
      if (!bo.brand && hasRealBrand && normalized.some((other) => Boolean(other.brand))) {
        continue;
      }
      const key = bo.brand.toLowerCase();
      const existing = dedupMap.get(key);
      if (!existing) {
        dedupMap.set(key, bo);
      } else {
        dedupMap.set(key, {
          ...existing,
          ...bo,
          brand: bo.brand || existing.brand,
          purchasePrice: bo.purchasePrice || existing.purchasePrice,
          salePrice: bo.salePrice || existing.salePrice,
          stockQuantity: Math.max(bo.stockQuantity || 0, existing.stockQuantity || 0),
          location:
            bo.location && bo.location !== 'Non renseigné' ? bo.location : existing.location,
          isDefault: Boolean(existing.isDefault || bo.isDefault),
        });
      }
    }

    const list = Array.from(dedupMap.values());
    if (list.length > 0) {
      if (list.length === 1 && !list[0].brand && cleanPrimaryBrand) {
        list[0] = { ...list[0], brand: cleanPrimaryBrand };
      }
      return list;
    }
  }

  return [
    {
      id: 'default',
      brand: cleanPrimaryBrand,
      brandReference: article.mainReference,
      purchasePrice: article.purchasePrice || 0,
      salePrice: article.salePrice || 0,
      location: article.defaultLocation,
      invoiceNumber: article.invoiceNumber,
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
  const cleanTarget = cleanBrandName(brandName);
  if (!cleanTarget) return getDefaultBrandOffer(article);
  const offers = getArticleBrandOffers(article);
  return (
    offers.find((o) => cleanBrandName(o.brand).toLowerCase() === cleanTarget.toLowerCase()) ||
    getDefaultBrandOffer(article)
  );
}

/**
 * Returns the list of distinct brand names handled for this article.
 */
export function getArticleAvailableBrands(article: Article): string[] {
  const offers = getArticleBrandOffers(article);
  const brands = offers.map((o) => cleanBrandName(o.brand)).filter(Boolean);
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
 * Computes the specific physical stock of a given brand inside a single warehouse stock record.
 */
export function getBrandStock(
  stock: WarehouseStock | undefined,
  brandName: string,
  totalQty = 0
): number {
  if (!stock) return 0;
  const whQty = Math.max(0, Number(stock.quantity) || 0);
  if (whQty === 0) return 0;

  const normBrand = cleanBrandName(brandName).toLowerCase();

  if (stock.brandBreakdown && typeof stock.brandBreakdown === 'object') {
    const keys = Object.keys(stock.brandBreakdown);
    const bdSum = keys.reduce(
      (sum, k) => sum + Math.max(0, Number(stock.brandBreakdown![k]) || 0),
      0
    );
    if (bdSum > 0) {
      const key = keys.find(
        (b) =>
          b.toLowerCase().trim() === brandName.toLowerCase().trim() ||
          cleanBrandName(b).toLowerCase() === normBrand
      );
      if (key !== undefined) {
        const rawVal = Math.max(0, Number(stock.brandBreakdown[key]) || 0);
        if (bdSum > whQty) {
          return keys.length === 1 ? whQty : Math.round((rawVal / bdSum) * whQty);
        }
        return rawVal;
      }
      if (keys.length === 1 && isPlaceholderBrand(keys[0])) {
        return whQty;
      }
      return 0;
    }
  }
  return totalQty;
}

/**
 * Computes the available stock quantity for a specific brand of an article across all (or selected) warehouses.
 */
export function getBrandStockAcrossWarehouses(
  stocks: WarehouseStock[],
  article: Article,
  brandName: string,
  selectedWarehouseId?: string | null
): number {
  const relevantStocks = stocks.filter(
    (s) =>
      s.articleId === article.id &&
      (!selectedWarehouseId || s.warehouseId === selectedWarehouseId)
  );

  const normBrand = cleanBrandName(brandName).toLowerCase();
  const offers = getArticleBrandOffers(article);
  const matchingOffer = offers.find((o) => cleanBrandName(o.brand).toLowerCase() === normBrand);
  const isPrimaryBrand =
    offers.length === 1 ||
    Boolean(matchingOffer?.isDefault) ||
    cleanBrandName(offers[0]?.brand).toLowerCase() === normBrand;

  let totalForBrand = 0;

  for (const st of relevantStocks) {
    const whQty = Math.max(0, Number(st.quantity) || 0);
    if (whQty === 0) continue;

    if (st.brandBreakdown && typeof st.brandBreakdown === 'object') {
      const keys = Object.keys(st.brandBreakdown);
      const bdSum = keys.reduce(
        (sum, k) => sum + Math.max(0, Number(st.brandBreakdown![k]) || 0),
        0
      );
      if (bdSum > 0) {
        const matchKey = keys.find(
          (k) =>
            k.toLowerCase().trim() === brandName.toLowerCase().trim() ||
            cleanBrandName(k).toLowerCase() === normBrand
        );
        if (matchKey !== undefined) {
          const rawVal = Math.max(0, Number(st.brandBreakdown[matchKey]) || 0);
          if (bdSum > whQty) {
            totalForBrand +=
              keys.length === 1 ? whQty : Math.round((rawVal / bdSum) * whQty);
          } else {
            totalForBrand += rawVal;
          }
        } else if (offers.length === 1 && keys.length === 1 && isPlaceholderBrand(keys[0])) {
          totalForBrand += whQty;
        }
        continue;
      }
    }

    // Fallback when warehouse stock has whQty > 0 but no positive brandBreakdown
    if (isPrimaryBrand) {
      totalForBrand += whQty;
    }
  }

  return totalForBrand;
}

/**
 * Strictly resolves the shelf location of a specific brand inside ONE specific warehouse (`warehouseId`).
 * Prevents locations from other warehouses or global article fields from leaking into secondary/transfer warehouses.
 */
export function getSingleWarehouseBrandLocation(
  st: WarehouseStock | undefined,
  article: Article,
  brandName: string,
  warehouseId: string,
  warehouses?: Warehouse[],
  allArticleStocks?: WarehouseStock[]
): string {
  const normBrand = brandName.toLowerCase().trim();
  const whObj = warehouses?.find((w) => w.id === warehouseId);
  const whName =
    whObj?.name?.trim() ||
    (warehouseId === 'mag_principal' ? 'Magasin' : warehouseId || 'Magasin');
  const normWhName = whName.toLowerCase();

  // Checks if a location prefix explicitly names a DIFFERENT warehouse
  const isPrefixFromOtherWarehouse = (prefix: string | null): boolean => {
    if (!prefix) return false;
    const normP = prefix.toLowerCase().trim();
    if (normP === normWhName || (whObj?.code && normP === whObj.code.toLowerCase().trim())) {
      return false;
    }
    if (warehouses && warehouses.length > 0) {
      const matchesOther = warehouses.some(
        (w) =>
          w.id !== warehouseId &&
          (w.name.toLowerCase().trim() === normP || w.code.toLowerCase().trim() === normP)
      );
      if (matchesOther) return true;
    }
    if (
      article.warehouseLocation &&
      article.warehouseLocation.toLowerCase().trim() === normP &&
      normP !== normWhName
    ) {
      return true;
    }
    return false;
  };

  // Helper to extract valid segments belonging to THIS warehouse
  const extractValidShelfForThisWh = (rawVal: string | undefined | null): string | null => {
    if (isEmptyLocationValue(rawVal)) return null;
    const segments = String(rawVal)
      .split(/\s*\|\s*|\s*•\s*|\s*;\s*/)
      .map((s) => s.trim())
      .filter((s) => !isEmptyLocationValue(s));

    const validShelves: string[] = [];
    for (const seg of segments) {
      const { prefix, innerLoc } = parseLocationSegment(seg);
      if (isEmptyLocationValue(innerLoc)) continue;
      if (isPrefixFromOtherWarehouse(prefix)) continue;
      if (!validShelves.includes(innerLoc)) {
        validShelves.push(innerLoc);
      }
    }
    if (validShelves.length === 0) return null;
    return validShelves.map((shelf) => `${whName} : ${shelf}`).join(' • ');
  };

  // 1. Check warehouse-specific brandLocations[brand]
  if (st?.brandLocations) {
    const matchKey = Object.keys(st.brandLocations).find(
      (k) => k.toLowerCase().trim() === normBrand
    );
    if (matchKey) {
      const resolved = extractValidShelfForThisWh(st.brandLocations[matchKey]);
      if (resolved) return resolved;
    }
  }

  // 2. Check warehouse-specific shelfLocation
  if (st?.shelfLocation && !isEmptyLocationValue(st.shelfLocation)) {
    const hasOwnBrandLocations =
      st.brandLocations && Object.keys(st.brandLocations).length > 0;
    const pureStShelf = stripWarehousePrefix(st.shelfLocation, warehouses, whName);

    // Detect if st.shelfLocation was accidentally copied from another warehouse by legacy transfer delta
    const isPollutedFromOtherWh =
      !hasOwnBrandLocations &&
      allArticleStocks &&
      allArticleStocks.some((other) => {
        if (other.warehouseId === warehouseId) return false;
        const otherHasBrandLocs =
          other.brandLocations && Object.keys(other.brandLocations).length > 0;
        if (!otherHasBrandLocs) return false;
        const otherPureShelves = [
          other.shelfLocation
            ? stripWarehousePrefix(other.shelfLocation, warehouses)
            : '',
          ...Object.values(other.brandLocations || {}).map((v) =>
            stripWarehousePrefix(v, warehouses)
          ),
        ].filter(Boolean);
        return (
          pureStShelf.length > 0 &&
          otherPureShelves.some(
            (os) => os.toLowerCase().trim() === pureStShelf.toLowerCase().trim()
          )
        );
      });

    if (!isPollutedFromOtherWh) {
      const resolved = extractValidShelfForThisWh(st.shelfLocation);
      if (resolved) return resolved;
    }
  }

  // 3. Check brandOffer.locations / brandOffer.location / article.defaultLocation ONLY for segments explicitly prefixed with THIS warehouse's name
  const offers = getArticleBrandOffers(article);
  const matchingOffer = offers.find((o) => o.brand.toLowerCase().trim() === normBrand);
  const candidateGlobalStrings: string[] = [];
  if (matchingOffer?.locations) candidateGlobalStrings.push(...matchingOffer.locations);
  if (matchingOffer?.location) candidateGlobalStrings.push(matchingOffer.location);
  if (article.defaultLocation) candidateGlobalStrings.push(article.defaultLocation);

  const explicitlyMatchedShelves: string[] = [];
  for (const rawStr of candidateGlobalStrings) {
    if (isEmptyLocationValue(rawStr)) continue;
    const segments = String(rawStr)
      .split(/\s*\|\s*|\s*•\s*|\s*;\s*/)
      .map((s) => s.trim())
      .filter((s) => !isEmptyLocationValue(s));

    for (const seg of segments) {
      const { prefix, innerLoc } = parseLocationSegment(seg);
      if (isEmptyLocationValue(innerLoc)) continue;
      if (
        prefix &&
        (prefix.toLowerCase().trim() === normWhName ||
          (whObj?.code && prefix.toLowerCase().trim() === whObj.code.toLowerCase().trim()))
      ) {
        const formatted = `${whName} : ${innerLoc}`;
        if (!explicitlyMatchedShelves.includes(formatted)) {
          explicitlyMatchedShelves.push(formatted);
        }
      }
    }
  }
  if (explicitlyMatchedShelves.length > 0) {
    return explicitlyMatchedShelves.join(' • ');
  }

  // 4. Legacy unprefixed fallback: ONLY if this warehouse is the sole warehouse holding stock (and was not explicitly initialized to 'Non renseigné')
  const stocksWithPositiveQty = (allArticleStocks || []).filter(
    (s) => (Number(s.quantity) || 0) > 0
  );
  const isSoleStockWarehouse =
    stocksWithPositiveQty.length === 1 &&
    stocksWithPositiveQty[0].warehouseId === warehouseId;
  const isOriginalArticleWarehouse =
    Boolean(article.warehouseLocation) &&
    article.warehouseLocation!.toLowerCase().trim() === normWhName;

  if (
    (isSoleStockWarehouse || isOriginalArticleWarehouse) &&
    st?.shelfLocation !== 'Non renseigné'
  ) {
    for (const rawStr of candidateGlobalStrings) {
      if (isEmptyLocationValue(rawStr)) continue;
      const segments = String(rawStr)
        .split(/\s*\|\s*|\s*•\s*|\s*;\s*/)
        .map((s) => s.trim())
        .filter((s) => !isEmptyLocationValue(s));
      for (const seg of segments) {
        const { prefix, innerLoc } = parseLocationSegment(seg);
        if (!prefix && !isEmptyLocationValue(innerLoc)) {
          return `${whName} : ${innerLoc}`;
        }
      }
    }
  }

  return 'Non renseigné';
}

/**
 * Returns the location(s) associated with a specific brand for an article,
 * always preceded by the relative warehouse name (e.g. "Magasin : Rayon A1").
 */
export function getBrandLocation(
  stocks: WarehouseStock[],
  article: Article,
  brandName: string,
  selectedWarehouseId?: string | null,
  warehouses?: Warehouse[]
): string {
  const articleStocks = stocks.filter((s) => s.articleId === article.id);

  const resolveWarehouseName = (whId?: string | null): string => {
    if (whId && warehouses && warehouses.length > 0) {
      const found = warehouses.find((w) => w.id === whId);
      if (found) return found.name;
    }
    if (whId === 'mag_principal') return 'Magasin';
    if (warehouses && warehouses.length > 0) {
      const def = warehouses.find((w) => w.isDefault) || warehouses[0];
      if (def) return def.name;
    }
    return article.warehouseLocation?.trim() || 'Magasin';
  };

  // CASE 1: Specific warehouse requested
  if (selectedWarehouseId && selectedWarehouseId !== 'ALL') {
    const st = articleStocks.find((s) => s.warehouseId === selectedWarehouseId);
    const singleLoc = getSingleWarehouseBrandLocation(
      st,
      article,
      brandName,
      selectedWarehouseId,
      warehouses,
      articleStocks
    );
    if (singleLoc !== 'Non renseigné') {
      return singleLoc;
    }
    const whName = resolveWarehouseName(selectedWarehouseId);
    const qtyInWh = st
      ? getBrandStockAcrossWarehouses([st], article, brandName, selectedWarehouseId)
      : 0;
    return qtyInWh > 0 ? `${whName} : Non renseigné` : 'Non renseigné';
  }

  // CASE 2: All warehouses ("Tous les dépôts")
  const locList: string[] = [];
  const warehousesWithBrandStock = articleStocks.filter(
    (st) => getBrandStockAcrossWarehouses([st], article, brandName, st.warehouseId) > 0
  );

  if (warehousesWithBrandStock.length > 0) {
    for (const st of warehousesWithBrandStock) {
      const whName = resolveWarehouseName(st.warehouseId);
      const singleLoc = getSingleWarehouseBrandLocation(
        st,
        article,
        brandName,
        st.warehouseId,
        warehouses,
        articleStocks
      );
      const entry = singleLoc !== 'Non renseigné' ? singleLoc : `${whName} : Non renseigné`;
      if (!locList.includes(entry)) {
        locList.push(entry);
      }
    }
    return locList.join(' • ');
  }

  // Fallback when total stock for this brand is 0 across all warehouses
  for (const st of articleStocks) {
    const singleLoc = getSingleWarehouseBrandLocation(
      st,
      article,
      brandName,
      st.warehouseId,
      warehouses,
      articleStocks
    );
    if (singleLoc !== 'Non renseigné' && !locList.includes(singleLoc)) {
      locList.push(singleLoc);
    }
  }

  if (locList.length > 0) {
    return locList.join(' • ');
  }

  const normBrand = brandName.toLowerCase().trim();
  const offers = getArticleBrandOffers(article);
  const matchingOffer = offers.find((o) => o.brand.toLowerCase().trim() === normBrand);
  const fallbackWhName = resolveWarehouseName(articleStocks[0]?.warehouseId);

  if (matchingOffer?.location && !isEmptyLocationValue(matchingOffer.location)) {
    return prefixLocationWithWarehouse(matchingOffer.location, fallbackWhName, warehouses);
  }
  if (article.defaultLocation && !isEmptyLocationValue(article.defaultLocation)) {
    return prefixLocationWithWarehouse(article.defaultLocation, fallbackWhName, warehouses);
  }

  return 'Non renseigné';
}

/**
 * Returns the order invoice number(s) (Numéro de facture de commande) associated with a specific brand for an article.
 */
export function getBrandInvoiceNumber(
  stocks: WarehouseStock[],
  article: Article,
  brandName: string,
  selectedWarehouseId?: string | null
): string {
  const normBrand = brandName.toLowerCase().trim();
  const offers = getArticleBrandOffers(article);
  const matchingOffer = offers.find((o) => o.brand.toLowerCase().trim() === normBrand);

  const invSet = new Set<string>();

  if (matchingOffer?.invoiceNumbers && matchingOffer.invoiceNumbers.length > 0) {
    matchingOffer.invoiceNumbers.forEach((inv) => {
      if (inv && inv.trim()) invSet.add(inv.trim());
    });
  }
  if (matchingOffer?.invoiceNumber && matchingOffer.invoiceNumber.trim()) {
    matchingOffer.invoiceNumber
      .split(/\s*\|\s*|\s*;\s*|\s*,\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => invSet.add(s));
  }

  const relevantStocks = stocks.filter(
    (s) =>
      s.articleId === article.id &&
      (!selectedWarehouseId || s.warehouseId === selectedWarehouseId)
  );

  for (const st of relevantStocks) {
    if (st.brandInvoices) {
      const matchKey = Object.keys(st.brandInvoices).find(
        (k) => k.toLowerCase().trim() === normBrand
      );
      if (matchKey && st.brandInvoices[matchKey]?.trim()) {
        st.brandInvoices[matchKey]
          .split(/\s*\|\s*|\s*;\s*|\s*,\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((s) => invSet.add(s));
      }
    }
    if (invSet.size === 0 && st.invoiceNumber && st.invoiceNumber.trim()) {
      invSet.add(st.invoiceNumber.trim());
    }
  }

  if (invSet.size > 0) {
    return Array.from(invSet).join(', ');
  }

  return article.invoiceNumber?.trim() || '-';
}

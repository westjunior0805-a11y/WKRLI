import { ArticleCategory, ImportFieldMapping, ParsedImportRow, Warehouse, Article, ImportMode } from '../types';

export const VALID_CATEGORIES: ArticleCategory[] = [
  'Filtration',
  'Moteur & Refroidissement',
  'Système Injection & Carburant',
  'Train de Roulement & Chenilles',
  'Hydraulique & Vérins',
  'Freinage & Friction',
  'Électricité & Démarreurs',
  'Transmission & Ponts',
  'Outils d’Attaque au Sol (Dents/Lames)',
];

export const TEMPLATE_HEADERS = [
  'Référence',
  'Désignation',
  'Équivalences',
  'Marque',
  'Catégorie',
  'Quantité initiale',
  'Prix d\'achat',
  'Prix de vente',
  'Fournisseur habituel',
  'Magasin',
  'Emplacement physique',
  'Rayonnage',
  'Étagère',
  'Case',
  'Seuil minimum',
  'Code-barres',
  'URL Image',
];

export const SAMPLE_ROWS = [
  [
    'CAT-1R-0716',
    'Filtre à Carburant Haute Efficacité 2 Microns',
    'Donaldson P551313, Baldwin B7299, LF3349',
    'Caterpillar',
    'Filtration',
    10,
    14500,
    22000,
    'Sodimate BTP Dakar',
    'Entrepôt Central Dakar Port',
    'Rayonnage A / Étagère 02 / Case 05',
    'A',
    '02',
    '05',
    4,
    '076837891234',
    '',
  ],
  [
    'KOM-6732-71-6110',
    'Injecteur Common Rail PC200-8',
    'Bosch 0445120231',
    'Komatsu',
    'Système Injection & Carburant',
    25,
    95000,
    140000,
    'Africaine d\'Équipements',
    'Entrepôt Central Dakar Port',
    'Rayonnage B / Étagère 01 / Case 10',
    'B',
    '01',
    '10',
    2,
    '493827104921',
    '',
  ],
  [
    'VOL-14532650',
    'Pompe Hydraulique Principale EC210B',
    'Kawasaki K3V112DT',
    'Volvo Construction',
    'Hydraulique & Vérins',
    0,
    650000,
    880000,
    'Matforce Sénégal',
    'Dépôt Régional Thiès Carrières',
    'Travée Spéciale Lourde',
    'C',
    '01',
    '01',
    1,
    '',
    '',
  ],
];

export function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function autoDetectMapping(cols: string[]): ImportFieldMapping {
  const findMatch = (exactList: string[], partialList: string[] = []): string => {
    // 1. Try exact match first
    const exact = cols.find((col) => {
      const norm = normalizeHeader(col);
      return exactList.some((cand) => norm === normalizeHeader(cand));
    });
    if (exact) return exact;

    // 2. Try partial match with specific safeguards
    return (
      cols.find((col) => {
        const norm = normalizeHeader(col);
        return partialList.some((cand) => norm.includes(normalizeHeader(cand)));
      }) || ''
    );
  };

  return {
    mainReference: findMatch(
      ['reference', 'ref', 'referenceprincipale', 'refconstructeur', 'codearticle'],
      ['reference', 'codearticle']
    ),
    designation: findMatch(
      ['designation', 'nom', 'libelle', 'description', 'designationpiece'],
      ['designation', 'libelle', 'nom']
    ),
    equivalentReferences: findMatch(
      ['equivalence', 'equivalences', 'crossref', 'crossreference', 'referenceequivalente', 'refsequivalentes'],
      ['equivalence', 'crossref']
    ),
    brand: findMatch(['marque', 'brand', 'constructeur', 'fabricant'], ['marque', 'brand']),
    category: findMatch(['categorie', 'category', 'famille', 'typepiece'], ['categorie', 'category']),
    initialQuantity: findMatch(
      ['quantiteinitiale', 'qteinitiale', 'stockinitial', 'quantite', 'qte', 'stock', 'initialquantity', 'qty'],
      ['quantiteinitiale', 'stockinitial', 'qteinitiale']
    ),
    purchasePrice: findMatch(
      ['prixachat', 'pa', 'cout', 'prixachatfcfa', 'purchaseprice', 'prixdachat'],
      ['prixachat', 'achat']
    ),
    salePrice: findMatch(
      ['prixvente', 'pv', 'prix', 'prixventefcfa', 'saleprice', 'prixdevente'],
      ['prixvente', 'vente']
    ),
    preferredSupplier: findMatch(
      ['fournisseur', 'supplier', 'fournisseurhabituel'],
      ['fournisseur', 'supplier']
    ),
    warehouse: findMatch(
      ['magasin', 'entrepot', 'depot', 'warehouse', 'codemagasin', 'nommagasin'],
      ['magasin', 'entrepot']
    ),
    physicalLocation: findMatch(
      ['emplacement', 'location', 'emplacementphysique', 'adresse'],
      ['emplacement']
    ),
    rack: findMatch(['rayon', 'rayonnage', 'rack']),
    shelf: findMatch(['etagere', 'shelf', 'niveau']),
    bin: findMatch(['case', 'bin', 'casier', 'bac']),
    minStockThreshold: findMatch(
      ['seuilminimum', 'seuilmin', 'stockminimum', 'minstock', 'seuilalerte', 'seuil'],
      ['seuil', 'minstock']
    ),
    barcode: findMatch(['codebarre', 'barcode', 'ean', 'upc']),
    imageUrl: findMatch(['image', 'urlimage', 'photo', 'picture']),
  };
}

/**
 * Robust numeric parser for quantities.
 * Treats null, undefined, and empty string as 0 with isValid: true.
 * Treats positive numbers and formatted integers as valid.
 * Treats negative numbers or non-numeric strings as invalid.
 */
export function parseCleanQuantity(val: any): { qty: number; isValid: boolean } {
  if (val === null || val === undefined || val === '') {
    return { qty: 0, isValid: true };
  }
  if (typeof val === 'number') {
    if (isNaN(val) || val < 0) return { qty: 0, isValid: false };
    return { qty: Math.floor(val), isValid: true };
  }
  const str = String(val).trim().replace(/\s+/g, '').replace(',', '.');
  if (str === '') return { qty: 0, isValid: true };
  const num = Number(str);
  if (isNaN(num) || num < 0) {
    return { qty: 0, isValid: false };
  }
  return { qty: Math.floor(num), isValid: true };
}

/**
 * Robust numeric parser for prices in FCFA.
 */
export function parseCleanPrice(val: any): { price: number; isValid: boolean } {
  if (val === null || val === undefined || val === '') {
    return { price: 0, isValid: true };
  }
  if (typeof val === 'number') {
    if (isNaN(val) || val < 0) return { price: 0, isValid: false };
    return { price: Math.round(val), isValid: true };
  }
  const str = String(val).trim().replace(/\s+/g, '').replace(',', '.');
  if (str === '') return { price: 0, isValid: true };
  const num = Number(str);
  if (isNaN(num) || num < 0) {
    return { price: 0, isValid: false };
  }
  return { price: Math.round(num), isValid: true };
}

/**
 * Validates and transforms raw sheet rows into typed ParsedImportRow array
 */
export function parseAndValidateImportRows(
  rawRows: Record<string, any>[],
  mapping: ImportFieldMapping,
  articles: Article[],
  warehouses: Warehouse[],
  mode: ImportMode,
  defaultWarehouseId: string
): ParsedImportRow[] {
  if (!mapping.mainReference || !mapping.designation || rawRows.length === 0) {
    return [];
  }

  // Track references and brands seen in this file
  const seenCompositeKeysInFile = new Set<string>();
  const seenRefsInFile = new Set<string>();

  return rawRows.map((raw, idx) => {
    const rowIndex = idx + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Brand (parsed early to allow multi-brand grouping with reference)
    const rawBrand = mapping.brand ? raw[mapping.brand] ?? raw[mapping.brand.trim()] : '';
    const brand = String(rawBrand || '').trim() || 'Générique';

    // Reference (Pivot unique)
    const rawRef = raw[mapping.mainReference] ?? raw[mapping.mainReference.trim()];
    const mainReference = String(rawRef || '').trim();
    if (!mainReference) {
      errors.push('Référence constructeur obligatoire manquante');
    } else {
      const refKey = mainReference.toLowerCase();
      const compositeKey = `${refKey}:::${brand.toLowerCase()}`;
      if (seenCompositeKeysInFile.has(compositeKey)) {
        errors.push(`Doublon dans ce fichier : la référence "${mainReference}" pour la marque "${brand}" est déjà présente`);
      } else if (seenRefsInFile.has(refKey)) {
        warnings.push(`Marque complémentaire "${brand}" rattachée à la référence pivot "${mainReference}"`);
      }
      seenCompositeKeysInFile.add(compositeKey);
      seenRefsInFile.add(refKey);
    }

    // Equivalent references (cross-references)
    let equivalentReferences: string[] | undefined = undefined;
    if (mapping.equivalentReferences) {
      const rawEq = raw[mapping.equivalentReferences] ?? raw[mapping.equivalentReferences.trim()];
      if (rawEq) {
        equivalentReferences = String(rawEq)
          .split(/[,;\/|]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    // Duplicate check in existing catalog (searches by mainReference or cross-references)
    const existingInCatalog = articles.find(
      (a) =>
        a.mainReference.toLowerCase().trim() === mainReference.toLowerCase().trim() ||
        a.equivalentReferences?.some((eq) => eq.toLowerCase().trim() === mainReference.toLowerCase().trim())
    );
    const isDuplicateInCatalog = !!existingInCatalog;
    if (isDuplicateInCatalog) {
      const existingBrands = [
        existingInCatalog.brand,
        ...(existingInCatalog.brandOffers?.map((b) => b.brand) || []),
      ].map((b) => b.toLowerCase().trim());

      const hasExactBrand = existingBrands.includes(brand.toLowerCase().trim());
      if (mode === 'INITIAL_IMPORT') {
        if (hasExactBrand) {
          warnings.push(`Pièce déjà existante avec la marque "${brand}" dans le catalogue (ignorée en import initial pour préserver le stock)`);
        } else {
          warnings.push(`Référence existante : la marque "${brand}" sera ajoutée à la fiche de la pièce ${existingInCatalog.mainReference}`);
        }
      } else if (mode === 'PRICING_UPDATE') {
        warnings.push(`Mise à jour tarifaire de la marque "${brand}" sur la pièce ${existingInCatalog.mainReference}`);
      }
    }

    // Designation
    const rawDesig = raw[mapping.designation] ?? raw[mapping.designation.trim()];
    const designation = String(rawDesig || '').trim();
    if (!designation) {
      errors.push('Désignation obligatoire manquante');
    }

    // Category
    let category: ArticleCategory = 'Filtration';
    if (mapping.category) {
      const catRaw = String(raw[mapping.category] ?? raw[mapping.category.trim()] ?? '').trim();
      if (catRaw) {
        const matched = VALID_CATEGORIES.find(
          (c) => c.toLowerCase() === catRaw.toLowerCase()
        );
        if (matched) {
          category = matched;
        } else {
          warnings.push(`Catégorie "${catRaw}" non standard, classée sous "Filtration"`);
        }
      }
    }

    // Initial Quantity
    const rawQtyVal = mapping.initialQuantity
      ? raw[mapping.initialQuantity] ?? raw[mapping.initialQuantity.trim()]
      : 0;
    const parsedQty = parseCleanQuantity(rawQtyVal);
    if (!parsedQty.isValid) {
      errors.push(`Quantité initiale invalide ("${rawQtyVal}") : doit être un entier positif ou zéro`);
    }
    const initialQuantity = parsedQty.qty;

    // Purchase Price
    const rawPAVal = mapping.purchasePrice
      ? raw[mapping.purchasePrice] ?? raw[mapping.purchasePrice.trim()]
      : 0;
    const parsedPA = parseCleanPrice(rawPAVal);
    if (!parsedPA.isValid) {
      errors.push(`Prix d'achat invalide ("${rawPAVal}") : doit être un nombre positif`);
    }
    const purchasePrice = parsedPA.price;

    // Sale Price
    const rawPVVal = mapping.salePrice
      ? raw[mapping.salePrice] ?? raw[mapping.salePrice.trim()]
      : 0;
    const parsedPV = parseCleanPrice(rawPVVal);
    if (!parsedPV.isValid) {
      errors.push(`Prix de vente invalide ("${rawPVVal}") : doit être un nombre positif`);
    }
    const salePrice = parsedPV.price;

    if (purchasePrice > 0 && salePrice > 0 && salePrice < purchasePrice) {
      warnings.push(`Prix de vente (${salePrice.toLocaleString()} FCFA) inférieur au prix d'achat (${purchasePrice.toLocaleString()} FCFA)`);
    }

    // Warehouse matching from file column or default
    let warehouseId = defaultWarehouseId;
    let warehouseName = warehouses.find((w) => w.id === defaultWarehouseId)?.name;
    if (mapping.warehouse) {
      const rawWh = String(raw[mapping.warehouse] ?? raw[mapping.warehouse.trim()] ?? '').trim();
      if (rawWh) {
        const found = warehouses.find(
          (w) =>
            w.id.toLowerCase() === rawWh.toLowerCase() ||
            w.code.toLowerCase() === rawWh.toLowerCase() ||
            w.name.toLowerCase().includes(rawWh.toLowerCase()) ||
            rawWh.toLowerCase().includes(w.name.toLowerCase())
        );
        if (found) {
          warehouseId = found.id;
          warehouseName = found.name;
        } else {
          warnings.push(`Magasin "${rawWh}" non reconnu, affecté par défaut à "${warehouseName}"`);
        }
      }
    }

    // Physical location
    const rack = mapping.rack ? String(raw[mapping.rack] ?? raw[mapping.rack.trim()] ?? '').trim() : undefined;
    const shelf = mapping.shelf ? String(raw[mapping.shelf] ?? raw[mapping.shelf.trim()] ?? '').trim() : undefined;
    const bin = mapping.bin ? String(raw[mapping.bin] ?? raw[mapping.bin.trim()] ?? '').trim() : undefined;

    let physicalLocation = mapping.physicalLocation
      ? String(raw[mapping.physicalLocation] ?? raw[mapping.physicalLocation.trim()] ?? '').trim()
      : '';

    if (!physicalLocation && (rack || shelf || bin)) {
      const parts: string[] = [];
      if (rack) parts.push(`Rayonnage ${rack}`);
      if (shelf) parts.push(`Étagère ${shelf}`);
      if (bin) parts.push(`Case ${bin}`);
      physicalLocation = parts.join(' / ');
    }

    if (!physicalLocation) {
      physicalLocation = 'Non renseigné';
    }

    // Min threshold
    let minStockThreshold = 2;
    if (mapping.minStockThreshold) {
      const rawMin = raw[mapping.minStockThreshold] ?? raw[mapping.minStockThreshold.trim()];
      const parsedMin = parseCleanQuantity(rawMin);
      if (parsedMin.isValid && rawMin !== '' && rawMin !== undefined) {
        minStockThreshold = parsedMin.qty;
      }
    }

    const rawSup = mapping.preferredSupplier
      ? raw[mapping.preferredSupplier] ?? raw[mapping.preferredSupplier.trim()]
      : undefined;
    const preferredSupplier = rawSup ? String(rawSup).trim() : undefined;

    const rawBar = mapping.barcode
      ? raw[mapping.barcode] ?? raw[mapping.barcode.trim()]
      : undefined;
    const barcode = rawBar ? String(rawBar).trim() : undefined;

    const rawImg = mapping.imageUrl
      ? raw[mapping.imageUrl] ?? raw[mapping.imageUrl.trim()]
      : undefined;
    const imageUrl = rawImg ? String(rawImg).trim() : undefined;

    const status: 'VALID' | 'WARNING' | 'ERROR' =
      errors.length > 0 ? 'ERROR' : warnings.length > 0 ? 'WARNING' : 'VALID';

    return {
      rowIndex,
      raw,
      mainReference,
      designation,
      brand,
      equivalentReferences,
      category,
      initialQuantity,
      purchasePrice,
      salePrice,
      preferredSupplier,
      warehouseId,
      warehouseName,
      physicalLocation,
      rack,
      shelf,
      bin,
      minStockThreshold,
      barcode,
      imageUrl,
      status,
      errors,
      warnings,
      isDuplicateInCatalog,
      existingArticleId: existingInCatalog?.id,
    };
  });
}

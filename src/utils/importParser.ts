import { ArticleCategory, ImportFieldMapping, ParsedImportRow, Warehouse, Article, ImportMode } from '../types';
import { prefixLocationWithWarehouse } from './articleHelpers';

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

// 1. Modèle officiel pour l'Importation du Catalogue
export const CATALOG_TEMPLATE_HEADERS = [
  'Référence',
  'Désignation',
  'Description',
  'Équivalences',
  'Seuil minimum',
];

export const CATALOG_SAMPLE_ROWS = [
  [
    '1R-0716',
    'Filtre à Carburant Haute Efficacité 2 Microns',
    'Filtre secondaire spin-on haute efficacité pour moteurs Caterpillar C9, C13, C15, 3306',
    'Donaldson P551313, Baldwin BF7587, Fleetguard FF5320',
    5,
  ],
  [
    '320-0680',
    'Injecteur Électronique Common Rail C7 / C9',
    'Injecteur complet haute pression pour pelles CAT 325D, 329D, 330D et niveleuses 140M',
    'CAT 10R-7222, Perkins 2645A747',
    2,
  ],
  [
    '1U-3352',
    'Dent de Godet Standard J350',
    'Pointe de godet standard série J350 pour pelles 320, 322, 325 et chargeuses 950, 966',
    'ESCO V33SYL, MTG 1U3352, BYG J350',
    12,
  ],
];

// 2. Modèle officiel pour l'Importation du Stock
export const STOCK_TEMPLATE_HEADERS = [
  'Référence',
  'Marque',
  'Quantité',
  'Emplacement',
  'Numéro de facture de commande',
  "Prix d'achat unitaire",
  'Prix de vente unitaire',
];

export const STOCK_SAMPLE_ROWS = [
  [
    '1R-0716',
    'Caterpillar',
    12,
    'Rayonnage A - Étagère 01 - Case 01',
    'FAC-CMD-2026-001',
    18500,
    28000,
  ],
  [
    '1R-0716',
    'CTP',
    20,
    'Rayonnage A - Étagère 01 - Case 02',
    'FAC-CMD-2026-002',
    11000,
    17500,
  ],
  [
    '1R-0716',
    'ITR',
    15,
    'Rayonnage B - Étagère 03 - Case 04',
    'FAC-CMD-2026-003',
    9500,
    15000,
  ],
  [
    '320-0680',
    'Caterpillar',
    4,
    'Armoire Sécurisée Injection - Casier 02',
    'FAC-CMD-2026-004',
    195000,
    280000,
  ],
  [
    '1U-3352',
    'ITR',
    30,
    'Zone Lourde Sol - Palette 04',
    'FAC-CMD-2026-005',
    16000,
    25000,
  ],
];

export const TEMPLATE_HEADERS = [
  'Référence',
  'Désignation',
  'Description',
  'Équivalences',
  'Marque',
  'Quantité',
  'Emplacement',
  'Numéro de facture de commande',
  "Prix d'achat unitaire",
  'Prix de vente unitaire',
  'Seuil minimum',
  'Catégorie',
  'Fournisseur habituel',
  'Magasin',
  'Code-barres',
  'URL Image',
];

export const SAMPLE_ROWS = [
  [
    '1R-0716',
    'Filtre à Carburant Haute Efficacité 2 Microns',
    'Filtre secondaire haute efficacité pour moteurs CAT',
    'Donaldson P551313, Baldwin B7299, LF3349',
    'Caterpillar',
    10,
    'Rayonnage A / Étagère 02 / Case 05',
    'FAC-CMD-2026-001',
    14500,
    22000,
    4,
    'Filtration',
    'Sodimate BTP Dakar',
    'Magasin Principal',
    '076837891234',
    '',
  ],
  [
    '1R-0716',
    'Filtre à Carburant Haute Efficacité 2 Microns',
    'Version adaptable CTP haute qualité',
    'Donaldson P551313, Baldwin B7299',
    'CTP',
    18,
    'Rayonnage A / Étagère 02 / Case 06',
    'FAC-CMD-2026-002',
    9500,
    15500,
    4,
    'Filtration',
    'CTP Parts USA',
    'Magasin Principal',
    '',
    '',
  ],
  [
    '1U-3352',
    'Dent de Godet Standard J350',
    'Pointe d’attaque au sol renforcée',
    'ESCO V33SYL, MTG 1U3352',
    'ITR',
    25,
    'Zone Sol / Rack C / Niveau 01',
    'FAC-CMD-2026-003',
    16000,
    25000,
    6,
    'Outils d’Attaque au Sol (Dents/Lames)',
    'ITR Benelux',
    'Magasin Principal',
    '',
    '',
  ],
];

export const CATERPILLAR_SIS2_CATALOG_ROWS = [
  // FILTRATION
  ['1R-0716', 'Filtre à Carburant Secondary High Efficiency', 'Donaldson P551313, Fleetguard FF5320, Baldwin BF7587', 'Caterpillar', 'Filtration', 20, 14500, 22500, 'Sodimate BTP Dakar', 'Entrepôt Central Dakar Port', 'Allée A - Travée 01', 'A', '01', '01', 5, '731234001', ''],
  ['1R-0750', 'Filtre à Carburant High Efficiency Spin-On', 'Donaldson P551315, Fleetguard FF5319, Baldwin BF7633', 'Caterpillar', 'Filtration', 18, 16000, 24500, 'Sodimate BTP Dakar', 'Entrepôt Central Dakar Port', 'Allée A - Travée 01', 'A', '01', '02', 5, '731234002', ''],
  ['1R-1808', 'Filtre à Huile Moteur C13 / C15 / C18', 'Donaldson P551808, Fleetguard LF16015, Baldwin B7299', 'Caterpillar', 'Filtration', 15, 22000, 33000, 'Sodimate BTP Dakar', 'Entrepôt Central Dakar Port', 'Allée A - Travée 02', 'A', '02', '01', 4, '731234003', ''],
  ['1R-0739', 'Filtre à Huile Moteur C7 / C9 / 3306', 'Donaldson P550739, Fleetguard LF3376, Baldwin B7002', 'Caterpillar', 'Filtration', 12, 19500, 29000, 'Sodimate BTP Dakar', 'Entrepôt Central Dakar Port', 'Allée A - Travée 02', 'A', '02', '02', 3, '731234004', ''],
  ['1R-0722', 'Filtre Hydraulique Cartouche Haute Pression', 'Donaldson P550388, Fleetguard HF6202', 'Caterpillar', 'Filtration', 8, 38000, 56000, 'Sodimate BTP Dakar', 'Entrepôt Central Dakar Port', 'Allée A - Travée 03', 'A', '03', '01', 2, '731234005', ''],
  ['326-1644', 'Filtre Séparateur d’Eau et Carburant avec Bol', 'Donaldson P551425, Fleetguard FS19820', 'Caterpillar', 'Filtration', 10, 28500, 42000, 'Sodimate BTP Dakar', 'Entrepôt Central Dakar Port', 'Allée A - Travée 03', 'A', '03', '02', 3, '731234006', ''],
  ['142-1339', 'Filtre à Air Primaire Radial Seal', 'Donaldson P532509, Fleetguard AF25557', 'Caterpillar', 'Filtration', 8, 45000, 68000, 'Sodimate BTP Dakar', 'Dépôt Régional Thiès Carrières', 'Allée B - Travée 01', 'B', '01', '01', 2, '731234007', ''],
  ['142-1340', 'Filtre à Air Secondaire Radial Seal', 'Donaldson P532510, Fleetguard AF25558', 'Caterpillar', 'Filtration', 8, 32000, 48000, 'Sodimate BTP Dakar', 'Dépôt Régional Thiès Carrières', 'Allée B - Travée 01', 'B', '01', '02', 2, '731234008', ''],
  ['4I-2013', 'Filtre Hydraulique de Retour Pelle 320D/330D', 'Donaldson P550698, Fleetguard HF35150', 'Caterpillar', 'Filtration', 6, 42000, 62000, 'Sodimate BTP Dakar', 'Entrepôt Central Dakar Port', 'Allée A - Travée 04', 'A', '04', '01', 2, '731234009', ''],

  // MOTEUR & INJECTION
  ['320-0680', 'Injecteur Common Rail Moteur C6.6 / C7.1', 'Perkins 2645A747, Bosch 0445120224', 'Caterpillar', 'Système Injection & Carburant', 6, 185000, 260000, 'Africaine d’Équipements', 'Entrepôt Central Dakar Port', 'Section Injection B-02', 'B', '02', '01', 2, '731234010', ''],
  ['268-1835', 'Injecteur Moteur EUI C9 CAT 330D / 336D', 'Reman 20R-1263, Perkins 10R-7222', 'Caterpillar', 'Système Injection & Carburant', 4, 210000, 295000, 'Africaine d’Équipements', 'Entrepôt Central Dakar Port', 'Section Injection B-02', 'B', '02', '02', 2, '731234011', ''],
  ['20R-8064', 'Injecteur Moteur C15 ACERT D8T / 345D', 'CAT 10R-1273, Reman 20R-8064', 'Caterpillar', 'Système Injection & Carburant', 4, 245000, 340000, 'Africaine d’Équipements', 'Antenne Minière Kédougou', 'Coffre Fort Pièces Sensibles', 'K', '01', '01', 1, '731234012', ''],
  ['235-9620', 'Turbocompresseur Moteur C9 CAT 330D / 336D', 'Garrett GTA4294BS, CAT 20R-0130', 'Caterpillar', 'Moteur & Refroidissement', 2, 680000, 920000, 'Africaine d’Équipements', 'Entrepôt Central Dakar Port', 'Rayonnage Lourd Moteurs C-01', 'C', '01', '01', 1, '731234013', ''],
  ['386-3439', 'Pompe à Eau Moteur C13 / C15 D8T / 345D', 'CAT 20R-0125, Reman 10R-3286', 'Caterpillar', 'Moteur & Refroidissement', 3, 290000, 410000, 'Matforce Sénégal', 'Entrepôt Central Dakar Port', 'Rayonnage Moteurs C-02', 'C', '02', '01', 1, '731234014', ''],
  ['248-5513', 'Thermostat d’Eau Moteur C9 / C13 / C15 (82°C)', 'CAT 248-5513, Perkins 10000-00342', 'Caterpillar', 'Moteur & Refroidissement', 10, 18000, 27000, 'Matforce Sénégal', 'Entrepôt Central Dakar Port', 'Rayonnage C-03', 'C', '03', '01', 3, '731234015', ''],
  ['320-2512', 'Pompe d’Amorçage Carburant Manuelle CAT', 'Bosch 1457010007, CAT 320-2512', 'Caterpillar', 'Système Injection & Carburant', 8, 32000, 48000, 'Africaine d’Équipements', 'Entrepôt Central Dakar Port', 'Section B-03', 'B', '03', '01', 2, '731234016', ''],
  ['223-7468', 'Joint de Culasse Moteur C13 ACERT', 'Elring 322.110, Payen HG1200', 'Caterpillar', 'Moteur & Refroidissement', 5, 85000, 125000, 'Matforce Sénégal', 'Entrepôt Central Dakar Port', 'Rayonnage C-04', 'C', '04', '01', 2, '731234017', ''],

  // HYDRAULIQUE
  ['295-9677', 'Pompe Hydraulique Principale Double CAT 320D', 'Kawasaki K3V112DT, Handok K3V112', 'Caterpillar', 'Hydraulique & Vérins', 1, 1450000, 1950000, 'Matforce Sénégal', 'Entrepôt Central Dakar Port', 'Zone Matériel Lourd H-01', 'H', '01', '01', 1, '731234018', ''],
  ['200-2929', 'Kit de Joints Vérin Flèche Pelle CAT 330D / 336D', 'SKF NOK Seal Kit 200-2929', 'Caterpillar', 'Hydraulique & Vérins', 8, 48000, 72000, 'Matforce Sénégal', 'Entrepôt Central Dakar Port', 'Section Joints H-02', 'H', '02', '01', 3, '731234019', ''],
  ['200-2930', 'Kit de Joints Vérin Balancier Pelle CAT 320D', 'SKF NOK Seal Kit 200-2930', 'Caterpillar', 'Hydraulique & Vérins', 10, 42000, 64000, 'Matforce Sénégal', 'Entrepôt Central Dakar Port', 'Section Joints H-02', 'H', '02', '02', 3, '731234020', ''],
  ['200-2931', 'Kit de Joints Vérin Godet Pelle CAT 320D / 323D', 'SKF NOK Seal Kit 200-2931', 'Caterpillar', 'Hydraulique & Vérins', 10, 38000, 58000, 'Matforce Sénégal', 'Entrepôt Central Dakar Port', 'Section Joints H-02', 'H', '02', '03', 3, '731234021', ''],
  ['244-3114', 'Distributeur Hydraulique Principal CAT 320D', 'Mottrol CAT 244-3114', 'Caterpillar', 'Hydraulique & Vérins', 1, 1850000, 2450000, 'Matforce Sénégal', 'Entrepôt Central Dakar Port', 'Zone Matériel Lourd H-03', 'H', '03', '01', 1, '731234022', ''],

  // TRAIN DE ROULEMENT & CHENILLES
  ['173-0946', 'Galet Inférieur de Chenille CAT 320D / 323D', 'Berco CR5511, ITM A2002000M00', 'Caterpillar', 'Train de Roulement & Chenilles', 12, 85000, 125000, 'Sodimate BTP Dakar', 'Dépôt Régional Thiès Carrières', 'Allée Chenilles T-01', 'T', '01', '01', 4, '731234023', ''],
  ['173-0950', 'Galet Supérieur de Chenille CAT 330D / 336D', 'Berco CR5520, ITM A2003000M00', 'Caterpillar', 'Train de Roulement & Chenilles', 10, 68000, 98000, 'Sodimate BTP Dakar', 'Dépôt Régional Thiès Carrières', 'Allée Chenilles T-01', 'T', '01', '02', 4, '731234024', ''],
  ['114-5009', 'Roue Folle (Idler Assembly) CAT 320D / 323D', 'Berco CR5500, ITM A2001000M00', 'Caterpillar', 'Train de Roulement & Chenilles', 2, 280000, 390000, 'Sodimate BTP Dakar', 'Dépôt Régional Thiès Carrières', 'Allée Chenilles T-02', 'T', '02', '01', 1, '731234025', ''],
  ['8E-4512', 'Barbotin / Segment de Barbotin Bouteur CAT D6R', 'Berco CR4812, ITM A3005000M00', 'Caterpillar', 'Train de Roulement & Chenilles', 15, 32000, 48000, 'Sodimate BTP Dakar', 'Dépôt Régional Thiès Carrières', 'Allée Chenilles T-03', 'T', '03', '01', 5, '731234026', ''],

  // OUTILS D'ATTAQUE AU SOL (GET - TEETH/BLADES)
  ['1U-3352', 'Dent de Godet Pénétration Système J350', 'Eteo J350, Black Cat 1U-3352', 'Caterpillar', 'Outils d’Attaque au Sol (Dents/Lames)', 40, 18500, 28000, 'Sodimate BTP Dakar', 'Entrepôt Central Dakar Port', 'Bac Dents G-01', 'G', '01', '01', 10, '731234027', ''],
  ['1U-3302', 'Dent de Godet Usage Général Système J300', 'Eteo J300, Black Cat 1U-3302', 'Caterpillar', 'Outils d’Attaque au Sol (Dents/Lames)', 50, 14000, 21000, 'Sodimate BTP Dakar', 'Entrepôt Central Dakar Port', 'Bac Dents G-01', 'G', '01', '02', 15, '731234028', ''],
  ['8E-6358', 'Axe et Bague de Blocage Dent Godet J350', 'CAT 8E-6358 + 8E-6359', 'Caterpillar', 'Outils d’Attaque au Sol (Dents/Lames)', 100, 2500, 4500, 'Sodimate BTP Dakar', 'Entrepôt Central Dakar Port', 'Bac Dents G-02', 'G', '02', '01', 25, '731234029', ''],
  ['9W-8452', 'Lame de Bouteur D8T Biseau Double (7 trous)', 'Black Cat Blades 9W-8452', 'Caterpillar', 'Outils d’Attaque au Sol (Dents/Lames)', 6, 120000, 175000, 'Sodimate BTP Dakar', 'Antenne Minière Kédougou', 'Stock Lames Extérieur', 'G', '03', '01', 2, '731234030', ''],
  ['4T-6659', 'Lame de Niveleuse 140K / 140M (7 Pieds 3/4")', 'Black Cat Blades 4T-6659', 'Caterpillar', 'Outils d’Attaque au Sol (Dents/Lames)', 12, 65000, 95000, 'Sodimate BTP Dakar', 'Entrepôt Central Dakar Port', 'Stock Lames Extérieur', 'G', '03', '02', 4, '731234031', ''],

  // ÉLECTRICITÉ & DÉMARREURS
  ['338-3454', 'Démarreur Heavy Duty 24V 7.5kW Moteur C9 / C13', 'Denso 428000-3450, Delco Remy 39MT', 'Caterpillar', 'Électricité & Démarreurs', 3, 240000, 340000, 'Africaine d’Équipements', 'Entrepôt Central Dakar Port', 'Rayonnage Électrique E-01', 'E', '01', '01', 1, '731234032', ''],
  ['185-5294', 'Alternateur 24V 80A Moteur C7 / C9 / C13', 'Denso 101211-8520, Delco Remy 24SI', 'Caterpillar', 'Électricité & Démarreurs', 4, 165000, 235000, 'Africaine d’Équipements', 'Entrepôt Central Dakar Port', 'Rayonnage Électrique E-01', 'E', '01', '02', 2, '731234033', ''],
  ['263-5090', 'Projecteur LED de Travail Cabine 24V 2500 Lumens', 'CAT 263-5090 LED Worklamp', 'Caterpillar', 'Électricité & Démarreurs', 15, 28000, 42000, 'Africaine d’Équipements', 'Entrepôt Central Dakar Port', 'Rayonnage Électrique E-02', 'E', '02', '01', 5, '731234034', ''],
  ['115-1615', 'Contacteur à Clé de Démarrage 4 Positions avec Clés', 'CAT Key Switch 115-1615', 'Caterpillar', 'Électricité & Démarreurs', 10, 18500, 28000, 'Africaine d’Équipements', 'Entrepôt Central Dakar Port', 'Rayonnage Électrique E-02', 'E', '02', '02', 3, '731234035', ''],

  // TRANSMISSION & FREINAGE
  ['198-4687', 'Disque de Friction Frein Chargeuse CAT 966H / 980H', 'Friction Disc CAT 198-4687', 'Caterpillar', 'Freinage & Friction', 12, 35000, 52000, 'Matforce Sénégal', 'Entrepôt Central Dakar Port', 'Section Freins F-01', 'F', '01', '01', 4, '731234036', ''],
  ['6Y-5678', 'Joint d’Étanchéité Duo-Cone Réducteur Final 330D', 'CAT Duo-Cone Seal 6Y-5678', 'Caterpillar', 'Transmission & Ponts', 8, 62000, 92000, 'Matforce Sénégal', 'Entrepôt Central Dakar Port', 'Section Joints F-02', 'F', '02', '01', 2, '731234037', ''],
];

export function normalizeHeader(s: string): string {
  return String(s || '')
    .trim()
    // Fix common Windows-1252 / UTF-8 mojibake for French accents in CSV files
    .replace(/Ã©|Ã¨|Ãª|Ã«|é|è|ê|ë/gi, 'e')
    .replace(/Ã |Ã¢|à|â/gi, 'a')
    .replace(/Ã´|ô/gi, 'o')
    .replace(/Ã¹|Ã»|ù|û/gi, 'u')
    .replace(/Ã®|Ã¯|î|ï/gi, 'i')
    .replace(/Ã§|ç/gi, 'c')
    .replace(/Ã‰|É/g, 'e')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function detectImportModeFromColumns(cols: string[]): ImportMode | null {
  const normCols = cols.map(normalizeHeader);
  const hasStockSpecific = normCols.some(
    (c) =>
      c.includes('quantite') ||
      c.includes('marque') ||
      c.includes('facture') ||
      c.includes('prixdachat') ||
      c.includes('prixachat') ||
      c.includes('prixdevente') ||
      c.includes('prixvente')
  );
  const hasCatalogSpecific = normCols.some(
    (c) =>
      c.includes('designation') ||
      c.includes('description') ||
      c.includes('equivalence') ||
      c.includes('seuil')
  );
  if (hasCatalogSpecific && !hasStockSpecific) return 'CATALOG_IMPORT';
  if (hasStockSpecific && !hasCatalogSpecific) return 'STOCK_IMPORT';
  return null;
}

export function parseRawSis2Text(rawText: string): Record<string, any>[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results: Record<string, any>[] = [];
  const catPartRegex = /\b([0-9][A-Z0-9]{1,2}-?[0-9]{4}|[0-9]{3}-?[0-9]{4}|[0-9][A-Z]-[0-9]{4}|[0-9]{7})\b/gi;

  for (const line of lines) {
    const matches = line.match(catPartRegex);
    if (!matches || matches.length === 0) continue;

    const rawPartNum = matches[0].toUpperCase();
    let formattedPartNum = rawPartNum;
    if (!rawPartNum.includes('-') && rawPartNum.length === 7) {
      formattedPartNum = `${rawPartNum.substring(0, 3)}-${rawPartNum.substring(3)}`;
    }

    let desc = line.replace(catPartRegex, '').replace(/[\t;,]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!desc || desc.length < 2) {
      desc = `Pièce d'Origine Caterpillar SIS 2.0 Ref ${formattedPartNum}`;
    }

    results.push({
      'Référence': formattedPartNum,
      'Désignation': desc,
      'Description': desc,
      'Équivalences': `OEM CAT ${formattedPartNum}`,
      'Seuil minimum': 2,
    });
  }

  return results;
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
      ['reference', 'ref', 'referenceprincipale', 'refconstructeur', 'codearticle', 'rfrence'],
      ['reference', 'rfrence', 'codearticle', 'ref']
    ),
    designation: findMatch(
      ['designation', 'nom', 'libelle', 'designationpiece', 'dsignation'],
      ['designation', 'dsignation', 'libelle', 'nom']
    ),
    description: findMatch(
      ['description', 'descriptiondetaillee', 'observations', 'notes', 'details', 'caracteristiques'],
      ['description', 'observation', 'detail']
    ),
    equivalentReferences: findMatch(
      ['equivalences', 'equivalence', 'quivalences', 'quivalence', 'crossref', 'crossreference', 'referenceequivalente', 'refsequivalentes'],
      ['equivalence', 'quivalence', 'crossref']
    ),
    brand: findMatch(['marque', 'brand', 'constructeur', 'fabricant'], ['marque', 'brand', 'constructeur']),
    category: findMatch(['categorie', 'category', 'famille', 'typepiece'], ['categorie', 'category']),
    initialQuantity: findMatch(
      ['quantite', 'quantit', 'quantiteinitiale', 'qteinitiale', 'stockinitial', 'qte', 'stock', 'quantitedisponible', 'initialquantity', 'qty'],
      ['quantite', 'quantit', 'stockinitial', 'qte', 'stock']
    ),
    purchasePrice: findMatch(
      ['prixdachatunitaire', 'prixachatunitaire', 'prixdachat', 'prixachat', 'pa', 'paunitaire', 'coutunitaire', 'cout', 'prixachatfcfa', 'purchaseprice'],
      ['prixdachat', 'prixachat', 'achat']
    ),
    salePrice: findMatch(
      ['prixdeventeunitaire', 'prixventeunitaire', 'prixdevente', 'prixvente', 'pv', 'pvunitaire', 'prix', 'prixventefcfa', 'saleprice'],
      ['prixdevente', 'prixvente', 'vente']
    ),
    invoiceNumber: findMatch(
      [
        'numerodefacturedecommande',
        'numrodefacturedecommande',
        'numerodefacture',
        'numrodefacture',
        'nfacturedecommande',
        'nfacture',
        'facturedecommande',
        'facturecommande',
        'facture',
        'numfacture',
        'bondecommande',
        'invoicenumber',
        'docref',
        'referencedocument',
      ],
      ['facture', 'bondecommande', 'invoice']
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
      ['emplacement', 'emplacementphysique', 'location', 'localisation', 'adresse'],
      ['emplacement', 'localisation']
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
  defaultWarehouseId?: string
): ParsedImportRow[] {
  if (!mapping.mainReference || rawRows.length === 0) {
    return [];
  }

  const isCatalogOnlyMode = mode === 'CATALOG_IMPORT' || mode === 'CATALOG_UPDATE';
  const isStockMode = mode === 'STOCK_IMPORT' || mode === 'INITIAL_IMPORT';
  const fallbackWh =
    (defaultWarehouseId ? warehouses.find((w) => w.id === defaultWarehouseId) : undefined) ||
    warehouses.find((w) => w.isDefault) ||
    warehouses[0];

  // Track references and brands seen in this file
  const seenCompositeKeysInFile = new Set<string>();
  const seenRefsInFile = new Set<string>();

  return rawRows.map((raw, idx) => {
    const rowIndex = idx + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Brand (parsed early to allow multi-brand grouping with reference)
    const rawBrand = mapping.brand ? raw[mapping.brand] ?? raw[mapping.brand.trim()] : '';
    const brand = String(rawBrand || '').trim();

    // Reference (Pivot unique)
    const rawRef = raw[mapping.mainReference] ?? raw[mapping.mainReference.trim()];
    const mainReference = String(rawRef || '').trim();
    if (!mainReference) {
      errors.push('Référence obligatoire manquante');
    } else {
      const refKey = mainReference.toLowerCase();
      const compositeKey = `${refKey}:::${brand.toLowerCase()}`;
      if (seenCompositeKeysInFile.has(compositeKey)) {
        warnings.push(
          `Ligne additionnelle pour la marque "${brand}" sur la référence "${mainReference}" (stocks et emplacements cumulés)`
        );
      } else if (seenRefsInFile.has(refKey)) {
        warnings.push(`Marque "${brand}" associée à la référence "${mainReference}"`);
      }
      seenCompositeKeysInFile.add(compositeKey);
      seenRefsInFile.add(refKey);
    }

    // Duplicate check in existing catalog (searches by mainReference or cross-references)
    const existingInCatalog = articles.find(
      (a) =>
        a.mainReference.toLowerCase().trim() === mainReference.toLowerCase().trim() ||
        a.equivalentReferences?.some((eq) => eq.toLowerCase().trim() === mainReference.toLowerCase().trim())
    );
    const isDuplicateInCatalog = !!existingInCatalog;

    // Equivalent references (cross-references)
    let equivalentReferences: string[] | undefined = undefined;
    let hasEquivalents = false;
    if (mapping.equivalentReferences) {
      const rawEq = raw[mapping.equivalentReferences] ?? raw[mapping.equivalentReferences.trim()];
      if (rawEq !== undefined && rawEq !== null && String(rawEq).trim() !== '') {
        hasEquivalents = true;
        equivalentReferences = String(rawEq)
          .split(/[,;\/|]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    // Description
    let description: string | undefined = undefined;
    let hasDescription = false;
    if (mapping.description) {
      const rawDesc = raw[mapping.description] ?? raw[mapping.description.trim()];
      if (rawDesc !== undefined && rawDesc !== null && String(rawDesc).trim() !== '') {
        hasDescription = true;
        description = String(rawDesc).trim();
      }
    }

    // Designation
    const rawDesig = mapping.designation
      ? raw[mapping.designation] ?? raw[mapping.designation.trim()]
      : '';
    const trimmedDesig = String(rawDesig || '').trim();
    const hasDesignation = trimmedDesig.length > 0;

    let designation = trimmedDesig;
    if (!designation) {
      if (existingInCatalog?.designation) {
        designation = existingInCatalog.designation;
      } else if (isCatalogOnlyMode) {
        errors.push('Désignation obligatoire manquante pour cette nouvelle référence du catalogue');
      } else {
        // In Stock Import mode, designation is not a column in the stock template
        designation = description || (mainReference ? `Pièce Réf. ${mainReference}` : '');
      }
    }

    // Invoice number (Numéro de facture de commande)
    let invoiceNumber: string | undefined = undefined;
    let hasInvoiceNumber = false;
    if (mapping.invoiceNumber) {
      const rawInv = raw[mapping.invoiceNumber] ?? raw[mapping.invoiceNumber.trim()];
      if (rawInv !== undefined && rawInv !== null && String(rawInv).trim() !== '') {
        hasInvoiceNumber = true;
        invoiceNumber = String(rawInv).trim();
      }
    }

    if (isDuplicateInCatalog && existingInCatalog) {
      const existingBrands = [
        existingInCatalog.brand,
        ...(existingInCatalog.brandOffers?.map((b) => b.brand) || []),
      ]
        .filter(Boolean)
        .map((b) => b.toLowerCase().trim());

      const hasExactBrand = existingBrands.includes(brand.toLowerCase().trim());
      if (isCatalogOnlyMode) {
        warnings.push(
          `Mise à jour non-destructive des informations catalogue pour la référence ${existingInCatalog.mainReference}`
        );
      } else if (isStockMode) {
        if (hasExactBrand) {
          warnings.push(
            `Mise à jour du stock et des tarifs pour la marque "${brand}" sur ${existingInCatalog.mainReference}`
          );
        } else {
          warnings.push(
            `Nouvelle marque "${brand}" ajoutée avec son stock et ses prix à la référence ${existingInCatalog.mainReference}`
          );
        }
      } else if (mode === 'PRICING_UPDATE') {
        warnings.push(`Mise à jour tarifaire de la marque "${brand}" sur la pièce ${existingInCatalog.mainReference}`);
      }
    }

    // Category
    let category: ArticleCategory = existingInCatalog?.category || 'Filtration';
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
      : '';
    const hasQuantity = rawQtyVal !== null && rawQtyVal !== undefined && String(rawQtyVal).trim() !== '';
    const parsedQty = parseCleanQuantity(rawQtyVal);
    if (!parsedQty.isValid) {
      errors.push(`Quantité invalide ("${rawQtyVal}") : doit être un entier positif ou zéro`);
    }
    const initialQuantity = parsedQty.qty;

    // Purchase Price
    const rawPAVal = mapping.purchasePrice
      ? raw[mapping.purchasePrice] ?? raw[mapping.purchasePrice.trim()]
      : '';
    const hasPurchasePrice = rawPAVal !== null && rawPAVal !== undefined && String(rawPAVal).trim() !== '';
    const parsedPA = parseCleanPrice(rawPAVal);
    if (!parsedPA.isValid) {
      errors.push(`Prix d'achat unitaire invalide ("${rawPAVal}") : doit être un nombre positif`);
    }
    const purchasePrice = parsedPA.price;

    // Sale Price
    const rawPVVal = mapping.salePrice
      ? raw[mapping.salePrice] ?? raw[mapping.salePrice.trim()]
      : '';
    const hasSalePrice = rawPVVal !== null && rawPVVal !== undefined && String(rawPVVal).trim() !== '';
    const parsedPV = parseCleanPrice(rawPVVal);
    if (!parsedPV.isValid) {
      errors.push(`Prix de vente unitaire invalide ("${rawPVVal}") : doit être un nombre positif`);
    }
    const salePrice = parsedPV.price;

    if (purchasePrice > 0 && salePrice > 0 && salePrice < purchasePrice) {
      warnings.push(
        `Prix de vente (${salePrice.toLocaleString()} FCFA) inférieur au prix d'achat (${purchasePrice.toLocaleString()} FCFA)`
      );
    }

    // Warehouse matching from file column or default Magasin (boutique)
    let warehouseId = fallbackWh?.id || defaultWarehouseId || 'mag_principal';
    let warehouseName = fallbackWh?.name || 'Magasin';
    if (!isCatalogOnlyMode && mapping.warehouse) {
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
          warnings.push(`Dépôt "${rawWh}" non reconnu, affecté par défaut au dépôt "${warehouseName}"`);
        }
      }
    }

    // Physical location (Emplacement) — always preceded by the relative warehouse name
    const rack = mapping.rack ? String(raw[mapping.rack] ?? raw[mapping.rack.trim()] ?? '').trim() : undefined;
    const shelf = mapping.shelf ? String(raw[mapping.shelf] ?? raw[mapping.shelf.trim()] ?? '').trim() : undefined;
    const bin = mapping.bin ? String(raw[mapping.bin] ?? raw[mapping.bin.trim()] ?? '').trim() : undefined;

    let rawLocationStr = mapping.physicalLocation
      ? String(raw[mapping.physicalLocation] ?? raw[mapping.physicalLocation.trim()] ?? '').trim()
      : '';

    if (!rawLocationStr && (rack || shelf || bin)) {
      const parts: string[] = [];
      if (rack) parts.push(`Rayonnage ${rack}`);
      if (shelf) parts.push(`Étagère ${shelf}`);
      if (bin) parts.push(`Case ${bin}`);
      rawLocationStr = parts.join(' / ');
    }

    const hasLocation = rawLocationStr.length > 0 && rawLocationStr !== 'Non renseigné';
    const physicalLocation = hasLocation
      ? prefixLocationWithWarehouse(rawLocationStr, warehouseName)
      : existingInCatalog?.defaultLocation && existingInCatalog.defaultLocation !== 'Non renseigné'
      ? prefixLocationWithWarehouse(existingInCatalog.defaultLocation, warehouseName)
      : 'Non renseigné';

    // Min threshold
    let minStockThreshold = existingInCatalog?.minStockThreshold ?? 2;
    let hasMinThreshold = false;
    if (mapping.minStockThreshold) {
      const rawMin = raw[mapping.minStockThreshold] ?? raw[mapping.minStockThreshold.trim()];
      if (rawMin !== undefined && rawMin !== null && String(rawMin).trim() !== '') {
        const parsedMin = parseCleanQuantity(rawMin);
        if (parsedMin.isValid) {
          minStockThreshold = parsedMin.qty;
          hasMinThreshold = true;
        }
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
      description,
      brand,
      equivalentReferences,
      category,
      initialQuantity,
      purchasePrice,
      salePrice,
      invoiceNumber,
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
      hasDesignation,
      hasDescription,
      hasEquivalents,
      hasMinThreshold,
      hasQuantity,
      hasPurchasePrice,
      hasSalePrice,
      hasLocation,
      hasInvoiceNumber,
      status,
      errors,
      warnings,
      isDuplicateInCatalog,
      existingArticleId: existingInCatalog?.id,
    };
  });
}

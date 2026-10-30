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
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function parseRawSis2Text(rawText: string): Record<string, any>[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results: Record<string, any>[] = [];

  // Regex pattern matching Caterpillar Part Numbers
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

    let qty = 1;
    const qtyMatch = line.match(/(?:qty|qte|x|\b)\s*:?\s*(\d+)\b/i);
    if (qtyMatch && parseInt(qtyMatch[1], 10) > 0 && parseInt(qtyMatch[1], 10) <= 1000) {
      qty = parseInt(qtyMatch[1], 10);
    }

    let category: ArticleCategory = 'Moteur & Refroidissement';
    const lowerLine = line.toLowerCase();
    if (
      lowerLine.includes('filter') ||
      lowerLine.includes('filtre') ||
      formattedPartNum.startsWith('1R') ||
      lowerLine.includes('element') ||
      lowerLine.includes('separator')
    ) {
      category = 'Filtration';
    } else if (
      lowerLine.includes('injector') ||
      lowerLine.includes('injecteur') ||
      lowerLine.includes('pump') ||
      lowerLine.includes('fuel') ||
      lowerLine.includes('carburant')
    ) {
      category = 'Système Injection & Carburant';
    } else if (
      lowerLine.includes('hydraul') ||
      lowerLine.includes('cylinder') ||
      lowerLine.includes('vérin') ||
      lowerLine.includes('seal') ||
      lowerLine.includes('joint')
    ) {
      category = 'Hydraulique & Vérins';
    } else if (
      lowerLine.includes('tooth') ||
      lowerLine.includes('dent') ||
      lowerLine.includes('blade') ||
      lowerLine.includes('lame') ||
      lowerLine.includes('cutting') ||
      formattedPartNum.startsWith('1U') ||
      formattedPartNum.startsWith('9W')
    ) {
      category = 'Outils d’Attaque au Sol (Dents/Lames)';
    } else if (
      lowerLine.includes('roller') ||
      lowerLine.includes('galet') ||
      lowerLine.includes('idler') ||
      lowerLine.includes('sprocket') ||
      lowerLine.includes('barbotin') ||
      lowerLine.includes('track') ||
      lowerLine.includes('chenille')
    ) {
      category = 'Train de Roulement & Chenilles';
    } else if (
      lowerLine.includes('starter') ||
      lowerLine.includes('démarreur') ||
      lowerLine.includes('alt') ||
      lowerLine.includes('lamp') ||
      lowerLine.includes('switch') ||
      lowerLine.includes('sensor')
    ) {
      category = 'Électricité & Démarreurs';
    } else if (
      lowerLine.includes('disc') ||
      lowerLine.includes('brake') ||
      lowerLine.includes('frein') ||
      lowerLine.includes('transmission')
    ) {
      category = 'Transmission & Ponts';
    }

    results.push({
      'Référence': formattedPartNum,
      'Désignation': desc,
      'Équivalences': `Extraction SIS 2.0 (OEM CAT ${formattedPartNum})`,
      'Marque': 'Caterpillar',
      'Catégorie': category,
      'Quantité initiale': qty,
      'Prix d\'achat': 28000,
      'Prix de vente': 42000,
      'Fournisseur habituel': 'Sodimate BTP Dakar (CAT Dealer)',
      'Magasin': 'Entrepôt Central Dakar Port',
      'Emplacement physique': 'Section Caterpillar SIS 2.0',
      'Rayonnage': 'CAT',
      'Étagère': '01',
      'Case': '01',
      'Seuil minimum': 2,
      'Code-barres': `CAT${formattedPartNum.replace(/[^A-Z0-9]/gi, '')}`,
      'URL Image': '',
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
        warnings.push(`Ligne complémentaire pour la marque "${brand}" sur la référence "${mainReference}" : les quantités seront cumulées sur la même pièce sans doublon`);
      } else if (seenRefsInFile.has(refKey)) {
        warnings.push(`Variable marque "${brand}" rattachée à la référence unique "${mainReference}"`);
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

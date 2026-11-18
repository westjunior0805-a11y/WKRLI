import { Article, WarehouseStock } from '../types';

/**
 * Technical Exact & Scoped Search Engine for EquipStock Pro (Caterpillar SIS 2.0 style)
 *
 * Option 1: Strict Technical Search (Zero typo approximation / Zero false-positive part numbers)
 * - Insensitive to accents (é -> e, è -> e) and case
 * - Insensitive to punctuation inside part references (1R-0716 === 1R0716, P55.1313 === P551313)
 * - Multi-word strict AND logic (every word typed must genuinely exist in the item)
 * - Ranked by industrial priority:
 *     100 = Exact Reference / Equivalent match
 *      95 = Reference starts with query
 *      90 = Reference contains / ends with query
 *      85 = Exact word or word-prefix match in Designation / Machine Model
 *      75 = Substring match in Designation / Brand / Location / Invoice
 *
 * Option 2: Targeted Search Scope ('ALL' | 'REF' | 'DESIGNATION' | 'MACHINE' | 'LOCATION')
 */

export type SearchTargetScope = 'ALL' | 'REF' | 'DESIGNATION' | 'MACHINE' | 'LOCATION';

export interface SearchScopeOption {
  id: SearchTargetScope;
  label: string;
  shortLabel: string;
  placeholder: string;
}

export const SEARCH_SCOPE_OPTIONS: SearchScopeOption[] = [
  {
    id: 'ALL',
    label: 'Tout (Réf, Désignation, Engin)',
    shortLabel: 'Tout',
    placeholder: 'Recherche exacte : Réf (1R-0716 ou 1R0716), équivalence (P551313), désignation, engin (336D)...',
  },
  {
    id: 'REF',
    label: 'Réf. & Équivalences uniquement',
    shortLabel: 'Réf. / Équiv.',
    placeholder: 'Rechercher uniquement par N° de Référence ou Équivalence (ex: 1R-0716, 0716, P551313)...',
  },
  {
    id: 'DESIGNATION',
    label: 'Désignation & Marque',
    shortLabel: 'Désignation',
    placeholder: 'Rechercher uniquement dans la Désignation, Description ou Marque (ex: filtre huile, joint)...',
  },
  {
    id: 'MACHINE',
    label: 'Engin / Modèle (Where Used SIS)',
    shortLabel: 'Engin / Préfixe',
    placeholder: 'Rechercher par Modèle d’engin, Préfixe série ou Famille (ex: 336D, D8R, JWR, 24M)...',
  },
  {
    id: 'LOCATION',
    label: 'Emplacement & N° Facture',
    shortLabel: 'Emplacement / Facture',
    placeholder: 'Rechercher par Emplacement magasin (ex: A-12, Rayon B) ou N° de Facture fournisseur...',
  },
];

export function normalizeText(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function normalizeAlphanumeric(str: string | undefined | null): string {
  if (!str) return '';
  return normalizeText(str).replace(/[^a-z0-9]/g, '');
}

interface PreparedField {
  norm: string;
  /** Individual words split by whitespace/delimiters */
  words: string[];
  /** Individual words stripped of hyphens/dots/slashes (e.g. "1r-0716" -> "1r0716") */
  alnumWords: string[];
  /** Priority weight for ranking (e.g. 1.0 for general fields, 1.2 for primary references) */
  weight: number;
}

function prepareField(rawVal: string | number | undefined | null, weight = 1.0): PreparedField | null {
  if (rawVal === undefined || rawVal === null) return null;
  const raw = String(rawVal).trim();
  if (!raw) return null;
  const norm = normalizeText(raw);
  if (!norm) return null;

  // Split by whitespace and common list delimiters, keeping hyphenated references together first
  const rawTokens = norm.split(/[\s,;|•()[\]]+/).filter(Boolean);
  const words = norm.split(/[\s,;|•/\\()[\]\-_.:]+/).filter(Boolean);
  const alnumWords = rawTokens
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);

  // If the entire field looks like a single reference with spaces (e.g. "1R 0716"), also include full alnum if short
  if (rawTokens.length <= 3 && /\d/.test(norm)) {
    const fullAlnum = norm.replace(/[^a-z0-9]/g, '');
    if (fullAlnum && !alnumWords.includes(fullAlnum)) {
      alnumWords.push(fullAlnum);
    }
  }

  return { norm, words, alnumWords, weight };
}

/**
 * Strictly scores a single query token against prepared fields.
 * Never matches approximate typos or scattered subsequences.
 * Returns 0 if no exact/substring/reference match is found.
 */
function scoreTokenStrict(
  normToken: string,
  alnumToken: string,
  fields: PreparedField[]
): number {
  let bestScore = 0;

  for (const field of fields) {
    const w = field.weight;

    // 1. Exact full field or exact reference code match (with or without hyphens/dots)
    if (
      field.norm === normToken ||
      (alnumToken.length >= 2 && field.alnumWords.some((aw) => aw === alnumToken))
    ) {
      bestScore = Math.max(bestScore, Math.round(100 * w));
      continue;
    }

    // 2. Reference code or field starts with token (e.g. "1R07" matches "1R-0716")
    if (
      field.norm.startsWith(normToken) ||
      (alnumToken.length >= 2 && field.alnumWords.some((aw) => aw.startsWith(alnumToken)))
    ) {
      bestScore = Math.max(bestScore, Math.round(94 * w));
      continue;
    }

    // 3. Exact word match or word prefix match inside field
    let matchedWord = false;
    for (const word of field.words) {
      if (word === normToken) {
        bestScore = Math.max(bestScore, Math.round(90 * w));
        matchedWord = true;
        break;
      } else if (word.startsWith(normToken)) {
        bestScore = Math.max(bestScore, Math.round(85 * w));
        matchedWord = true;
      }
    }
    if (matchedWord) continue;

    // 4. Contiguous substring inside reference code (e.g. "0716" inside "1R-0716") or text field
    if (
      field.norm.includes(normToken) ||
      (alnumToken.length >= 2 && field.alnumWords.some((aw) => aw.includes(alnumToken)))
    ) {
      bestScore = Math.max(bestScore, Math.round(78 * w));
    }
  }

  return bestScore;
}

/**
 * Computes a strict technical relevance score for a query against a list of text fields.
 * Returns 0 if any word in the query does not match.
 */
export function fuzzyScore(
  query: string,
  fields: Array<string | number | undefined | null>
): number {
  const trimmed = query.trim();
  if (!trimmed) return 1;

  const rawTokens = trimmed.split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return 1;

  const preparedFields: PreparedField[] = [];
  fields.forEach((f, idx) => {
    // Give slightly higher weight to the first field (typically mainReference or code)
    const weight = idx === 0 ? 1.15 : 1.0;
    const pf = prepareField(f, weight);
    if (pf) preparedFields.push(pf);
  });

  if (preparedFields.length === 0) return 0;

  let totalScore = 0;

  for (const rawToken of rawTokens) {
    const normToken = normalizeText(rawToken);
    const alnumToken = normalizeAlphanumeric(rawToken);
    if (!normToken && !alnumToken) continue;

    const tokenScore = scoreTokenStrict(normToken, alnumToken, preparedFields);
    if (tokenScore === 0) {
      return 0;
    }
    totalScore += tokenScore;
  }

  return totalScore / rawTokens.length;
}

/**
 * Boolean helper: returns true if `query` strictly matches `fields`.
 */
export function fuzzyMatch(
  query: string,
  fields: Array<string | number | undefined | null>
): boolean {
  return fuzzyScore(query, fields) > 0;
}

/**
 * Filters and ranks an array of items using Strict Technical Search.
 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getSearchableFields: (item: T) => Array<string | number | undefined | null>,
  preserveOrder = false
): T[] {
  const trimmed = query.trim();
  if (!trimmed) return items;

  const scored: Array<{ item: T; score: number; index: number }> = [];

  items.forEach((item, index) => {
    const score = fuzzyScore(trimmed, getSearchableFields(item));
    if (score > 0) {
      scored.push({ item, score, index });
    }
  });

  if (!preserveOrder) {
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });
  }

  return scored.map((entry) => entry.item);
}

/**
 * Scores an Article according to the selected SearchTargetScope (Option 1 + Option 2).
 * Prioritizes exact and prefix matches on mainReference & equivalentReferences when scope is 'ALL' or 'REF'.
 */
export function scoreArticleByScope(
  article: Article,
  query: string,
  scope: SearchTargetScope = 'ALL',
  articleStocks: WarehouseStock[] = []
): number {
  const trimmed = query.trim();
  if (!trimmed) return 1;

  const rawTokens = trimmed.split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return 1;

  const preparedFields: PreparedField[] = [];
  const addField = (val: string | number | undefined | null, weight: number) => {
    const pf = prepareField(val, weight);
    if (pf) preparedFields.push(pf);
  };

  if (scope === 'ALL' || scope === 'REF') {
    addField(article.mainReference, 1.35);
    (article.equivalentReferences || []).forEach((eq) => addField(eq, 1.25));
    (article.brandOffers || []).forEach((bo) => addField(bo.brandReference, 1.2));
  }

  if (scope === 'ALL' || scope === 'DESIGNATION') {
    addField(article.designation, 1.1);
    addField(article.description, 1.0);
    addField(article.notes, 0.95);
    addField(article.category, 1.0);
    addField(article.brand, 1.05);
    (article.brandOffers || []).forEach((bo) => {
      addField(bo.brand, 1.05);
      addField(bo.preferredSupplier, 0.95);
    });
  }

  if (scope === 'ALL' || scope === 'MACHINE') {
    (article.machineApplications || []).forEach((m) => {
      addField(m.model, 1.15);
      addField(m.serialPrefix, 1.15);
      addField(m.productFamily, 1.0);
      addField(m.subFamily, 1.0);
      addField(m.system, 0.95);
      addField(m.notes, 0.9);
    });
    (article.compatibleMachines || []).forEach((cm) => addField(cm, 1.1));
  }

  if (scope === 'ALL' || scope === 'LOCATION') {
    addField(article.defaultLocation, 1.0);
    addField(article.rack, 1.0);
    addField(article.shelf, 1.0);
    addField(article.bin, 1.0);
    addField(article.invoiceNumber, 1.0);
    (article.brandOffers || []).forEach((bo) => {
      addField(bo.location, 1.0);
      (bo.locations || []).forEach((loc) => addField(loc, 1.0));
      addField(bo.invoiceNumber, 1.0);
      (bo.invoiceNumbers || []).forEach((inv) => addField(inv, 1.0));
    });
    articleStocks.forEach((s) => {
      addField(s.shelfLocation, 1.0);
      addField(s.invoiceNumber, 1.0);
      if (s.brandLocations) {
        Object.values(s.brandLocations).forEach((loc) => addField(loc, 1.0));
      }
      if (s.brandInvoices) {
        Object.values(s.brandInvoices).forEach((inv) => addField(inv, 1.0));
      }
    });
  }

  if (preparedFields.length === 0) return 0;

  let totalScore = 0;

  for (const rawToken of rawTokens) {
    const normToken = normalizeText(rawToken);
    const alnumToken = normalizeAlphanumeric(rawToken);
    if (!normToken && !alnumToken) continue;

    const tokenScore = scoreTokenStrict(normToken, alnumToken, preparedFields);
    if (tokenScore === 0) {
      return 0;
    }
    totalScore += tokenScore;
  }

  return totalScore / rawTokens.length;
}

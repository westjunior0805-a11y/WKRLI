import { Article, Customer, WarehouseStock } from '../types';
import { scoreArticleByScope } from './fuzzySearch';

export interface StockVoiceVocabulary {
  articles: Article[];
  stocksByArticleId: Map<string, WarehouseStock[]>;
  /** Compacted alphanumeric reference -> original display reference (e.g. "1R0750" -> "1R-0750") */
  references: Array<{ compact: string; display: string }>;
  /** Unique meaningful words from ALL searchable fields (designations, descriptions, brands, categories, machines, locations) */
  words: Array<{
    display: string;
    normalized: string;
    phonetic: string;
    frequency: number;
  }>;
  /** Meaningful 2-word technical phrases from designations/descriptions (e.g. "joint spi", "filtre huile") */
  bigrams: Array<{
    display: string;
    normalized: string;
    joinedNormalized: string;
    joinedPhonetic: string;
  }>;
  /** Customer names (normalized) to avoid over-correcting customer searches */
  customerWords: Set<string>;
}

export interface VoiceMatchResolution {
  resolvedText: string;
  rawText: string;
  wasCorrected: boolean;
  matchedFromStock: boolean;
}

const FRENCH_STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'au', 'aux',
  'et', 'ou', 'en', 'sur', 'pour', 'par', 'avec', 'sans', 'dans', 'a',
  'ce', 'cet', 'cette', 'ces', 'mon', 'ton', 'son', 'je', 'tu', 'il',
  'veux', 'cherche', 'trouve', 'piece', 'pieces', 'article', 'articles',
  'stock', 'donne', 'moi',
]);

/**
 * Known French STT confusions in heavy-equipment / automotive spare parts workshops.
 * Values are preferred when the target term exists in the user's stock.
 */
const WORKSHOP_HOMOPHONES: Record<string, string[]> = {
  croix: ['courroie', 'courroies', 'croisillon'],
  crois: ['courroie', 'courroies', 'croisillon'],
  quoi: ['courroie'],
  courroi: ['courroie'],
  courroies: ['courroie'],
  fil: ['filtre', 'filtres'],
  fils: ['filtre', 'filtres'],
  philtre: ['filtre'],
  philtres: ['filtre'],
  filtrer: ['filtre'],
  join: ['joint', 'joints'],
  joins: ['joint', 'joints'],
  juin: ['joint', 'joints'],
  spy: ['spi'],
  speed: ['spi'],
  spie: ['spi'],
  spi: ['spi'],
  durites: ['durite'],
  rite: ['durite'],
  roulant: ['roulement'],
  roulements: ['roulement'],
  poulet: ['poulie'],
  poulies: ['poulie'],
  verre: ['verin'],
  verrin: ['verin'],
  verrins: ['verin'],
  verins: ['verin'],
  classe: ['culasse'],
  bouger: ['bougie', 'bougies'],
  bougies: ['bougie'],
  injecter: ['injecteur', 'injecteurs'],
  alterner: ['alternateur'],
  demarrer: ['demarreur'],
  flexibles: ['flexible'],
  crepe: ['crepine'],
  rotules: ['rotule'],
  galets: ['galet'],
  soupapes: ['soupape'],
  segments: ['segment'],
  pistons: ['piston'],
  bielles: ['bielle'],
  plaquettes: ['plaquette'],
  disques: ['disque'],
  capteurs: ['capteur'],
  relai: ['relais'],
  silence: ['silentbloc'],
  silent: ['silentbloc'],
  etriers: ['etrier'],
  moyeux: ['moyeu'],
  ecrous: ['ecrou'],
  boulons: ['boulon'],
  rondelles: ['rondelle'],
  raccords: ['raccord'],
  colliers: ['collier'],
  pompes: ['pompe'],
  joints: ['joint'],
  filtres: ['filtre'],
  huiles: ['huile'],
  gazole: ['gasoil'],
  gazoil: ['gasoil'],
  diesel: ['gasoil', 'diesel'],
  caterpillar: ['cat', 'caterpillar'],
};

const SPOKEN_DIGITS: Record<string, string> = {
  zero: '0',
  un: '1',
  une: '1',
  deux: '2',
  trois: '3',
  quatre: '4',
  cinq: '5',
  six: '6',
  sept: '7',
  huit: '8',
  neuf: '9',
};

export function stripDiacritics(input: string): string {
  return String(input ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function compactRef(input: string): string {
  return stripDiacritics(input).replace(/[^a-z0-9]/g, '').toUpperCase();
}

/**
 * Lightweight French phonetic encoder tuned for spare-part terms.
 */
export function frenchPhoneticKey(raw: string): string {
  let s = stripDiacritics(raw).replace(/[^a-z0-9]/g, '');
  if (!s) return '';

  s = s.replace(/ph/g, 'f');
  s = s.replace(/ch|sh/g, 'S');
  s = s.replace(/h/g, '');

  s = s.replace(/eaux?/g, 'o');
  s = s.replace(/aux?/g, 'o');
  s = s.replace(/oie?s?$/g, 'wa');
  s = s.replace(/oi[xs]?$/g, 'wa');
  s = s.replace(/oi|oy/g, 'wa');
  s = s.replace(/ou/g, 'u');
  s = s.replace(/qu|ck/g, 'k');
  s = s.replace(/c(?=[eiy])/g, 's');
  s = s.replace(/c/g, 'k');
  s = s.replace(/gu(?=[eiy])/g, 'g');
  s = s.replace(/g(?=[eiy])/g, 'j');
  s = s.replace(/gn/g, 'n');
  s = s.replace(/tion/g, 'sj3');
  s = s.replace(/(?:ain|aim|ein|eim|in|im|yn|ym)(?![aeiouy])/g, '1');
  s = s.replace(/(?:an|am|en|em)(?![aeiouy])/g, '2');
  s = s.replace(/(?:on|om)(?![aeiouy])/g, '3');
  s = s.replace(/ai|ei/g, 'e');
  s = s.replace(/y/g, 'i');
  s = s.replace(/z/g, 's');

  if (s.length > 3) {
    s = s.replace(/(?:er|ez|et|es)$/, 'e');
    s = s.replace(/[sxtde]+$/, '');
  }

  s = s.replace(/(.)\1+/g, '$1');

  return s;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Builds a complete index of ALL searchable fields in the user's stock
 * (aligned 1:1 with the written search engine `scoreArticleByScope`).
 */
export function buildStockVoiceVocabulary(
  articles: Article[],
  stocks: WarehouseStock[] = [],
  customers: Customer[] = []
): StockVoiceVocabulary {
  const refMap = new Map<string, string>();
  const wordMap = new Map<
    string,
    { display: string; normalized: string; phonetic: string; frequency: number }
  >();
  const bigramMap = new Map<
    string,
    { display: string; normalized: string; joinedNormalized: string; joinedPhonetic: string }
  >();
  const customerWords = new Set<string>();
  const stocksByArticleId = new Map<string, WarehouseStock[]>();

  for (const s of stocks) {
    const arr = stocksByArticleId.get(s.articleId);
    if (arr) arr.push(s);
    else stocksByArticleId.set(s.articleId, [s]);
  }

  const addWord = (rawWord: unknown) => {
    if (rawWord === undefined || rawWord === null) return;
    const cleanDisplay = String(rawWord).replace(/^[^a-zA-Z0-9À-ÿ]+|[^a-zA-Z0-9À-ÿ]+$/g, '');
    if (cleanDisplay.length < 2) return;
    const normalized = stripDiacritics(cleanDisplay);
    if (normalized.length < 2 || FRENCH_STOP_WORDS.has(normalized)) return;

    const existing = wordMap.get(normalized);
    if (existing) {
      existing.frequency += 1;
    } else {
      wordMap.set(normalized, {
        display: cleanDisplay.toLowerCase(),
        normalized,
        phonetic: frenchPhoneticKey(normalized),
        frequency: 1,
      });
    }
  };

  const indexTextField = (raw: unknown, extractBigrams = false) => {
    if (raw === undefined || raw === null) return;
    const str = String(raw).trim();
    if (!str) return;
    const tokens = str
      .split(/[\s/,;()&|•]+/)
      .map((t) => t.replace(/^[^a-zA-Z0-9À-ÿ-]+|[^a-zA-Z0-9À-ÿ-]+$/g, ''))
      .filter((t) => t.length >= 2);

    for (const t of tokens) {
      addWord(t);
    }

    if (extractBigrams) {
      for (let i = 0; i < tokens.length - 1; i++) {
        const w1 = stripDiacritics(tokens[i]);
        const w2 = stripDiacritics(tokens[i + 1]);
        if (w1.length < 2 || w2.length < 2) continue;
        const normalized = `${w1} ${w2}`;
        if (!bigramMap.has(normalized)) {
          const joined = `${w1}${w2}`;
          bigramMap.set(normalized, {
            display: `${tokens[i].toLowerCase()} ${tokens[i + 1].toLowerCase()}`,
            normalized,
            joinedNormalized: joined,
            joinedPhonetic: frenchPhoneticKey(joined),
          });
        }
      }
    }
  };

  const activeArticles = articles.filter((a) => a.status !== 'archived');

  for (const art of activeArticles) {
    if (art.mainReference) {
      const c = compactRef(String(art.mainReference));
      if (c.length >= 2 && !refMap.has(c)) {
        refMap.set(c, String(art.mainReference).trim());
      }
    }
    if (Array.isArray(art.equivalentReferences)) {
      for (const eq of art.equivalentReferences) {
        const c = compactRef(String(eq));
        if (c.length >= 2 && !refMap.has(c)) {
          refMap.set(c, String(eq).trim());
        }
      }
    }
    if (Array.isArray(art.brandOffers)) {
      for (const bo of art.brandOffers) {
        if (bo.brandReference) {
          const c = compactRef(String(bo.brandReference));
          if (c.length >= 2 && !refMap.has(c)) {
            refMap.set(c, String(bo.brandReference).trim());
          }
        }
        indexTextField(bo.brand);
        indexTextField(bo.preferredSupplier);
        indexTextField(bo.location);
      }
    }

    indexTextField(art.designation, true);
    indexTextField(art.description, true);
    indexTextField(art.notes);
    indexTextField(art.category);
    indexTextField(art.brand);
    indexTextField(art.defaultLocation);

    if (Array.isArray(art.compatibleMachines)) {
      for (const cm of art.compatibleMachines) indexTextField(cm);
    }
    if (Array.isArray(art.machineApplications)) {
      for (const m of art.machineApplications) {
        indexTextField(m.model);
        indexTextField(m.serialPrefix);
        indexTextField(m.productFamily);
        indexTextField(m.subFamily);
        indexTextField(m.system);
      }
    }
  }

  for (const cust of customers) {
    if (cust.name) {
      for (const w of String(cust.name).split(/[\s/,;()]+/)) {
        const n = stripDiacritics(w).replace(/[^a-z0-9]/g, '');
        if (n.length >= 2) customerWords.add(n);
      }
    }
  }

  return {
    articles: activeArticles,
    stocksByArticleId,
    references: Array.from(refMap.entries()).map(([compact, display]) => ({ compact, display })),
    words: Array.from(wordMap.values()),
    bigrams: Array.from(bigramMap.values()),
    customerWords,
  };
}

/**
 * Tests whether a query produces real hits using the EXACT same search engine
 * as written search (`scoreArticleByScope` across ALL fields: Ref, Designation,
 * Brand, Category, Description, Machine, Location) OR matches a registered customer.
 */
function countWrittenSearchHits(query: string, vocab: StockVoiceVocabulary): number {
  const trimmed = query.trim();
  if (!trimmed) return 0;

  let hits = 0;
  for (const art of vocab.articles) {
    const artStocks = vocab.stocksByArticleId.get(art.id) || [];
    if (scoreArticleByScope(art, trimmed, 'ALL', artStocks) > 0) {
      hits += 1;
      if (hits >= 5) return hits; // Early exit — we know it's a genuine match
    }
  }

  if (hits === 0) {
    const normTokens = stripDiacritics(trimmed)
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !FRENCH_STOP_WORDS.has(t));
    if (normTokens.length > 0 && normTokens.every((t) => vocab.customerWords.has(t))) {
      return 1;
    }
  }

  return hits;
}

/**
 * Tries to match a PURE dictated part code (must contain digits and look like a code,
 * never a normal descriptive word like "filtre" or "courroie") against real stock references.
 */
function matchSpokenReference(text: string, vocab: StockVoiceVocabulary): string | null {
  if (vocab.references.length === 0) return null;

  const tokens = stripDiacritics(text)
    .replace(/\b(?:tiret|trait d['’]union)\b/g, '-')
    .split(/\s+/)
    .filter(Boolean);

  // Only treat as a reference if tokens are short code-like chunks (not a descriptive sentence)
  if (tokens.some((t) => t.length > 6 && !/\d/.test(t))) {
    return null;
  }

  const converted = tokens.map((t) => SPOKEN_DIGITS[t] ?? t);
  const joined = converted.join('').replace(/[^a-z0-9]/gi, '').toUpperCase();

  if (!/\d/.test(joined) || joined.length < 3 || joined.length > 20) {
    return null;
  }

  // 1. Exact compact reference match
  const exact = vocab.references.find((r) => r.compact === joined);
  if (exact) return exact.display;

  // 2. Unique partial match for >= 4 chars
  if (joined.length >= 4) {
    const partialMatches = vocab.references.filter((r) => r.compact.includes(joined));
    if (partialMatches.length === 1) {
      return partialMatches[0].display;
    }
  }

  // 3. 1-char fuzzy tolerance for >= 5 chars (e.g. "1ER0719" -> "1R-0719")
  if (joined.length >= 5) {
    let bestRef: { display: string; dist: number } | null = null;
    for (const ref of vocab.references) {
      if (Math.abs(ref.compact.length - joined.length) > 1) continue;
      const dist = levenshtein(joined, ref.compact);
      if (dist <= 1 && (!bestRef || dist < bestRef.dist)) {
        bestRef = { display: ref.display, dist };
      }
    }
    if (bestRef) return bestRef.display;
  }

  return null;
}

/**
 * Finds the best stock word matching a misheard French token using:
 * 1) Workshop homophone table verified against real stock
 * 2) French phonetic + orthographic similarity against every word in stock
 */
function findBestStockWord(token: string, vocab: StockVoiceVocabulary): string | null {
  const norm = stripDiacritics(token).replace(/[^a-z0-9]/g, '');
  if (norm.length < 2 || FRENCH_STOP_WORDS.has(norm)) return null;

  if (vocab.customerWords.has(norm)) return null;
  const exactWord = vocab.words.find((w) => w.normalized === norm);
  if (exactWord) return null;

  // 1. Curated workshop homophones (e.g. "croix" -> "courroie") present in stock
  const homophoneCandidates = WORKSHOP_HOMOPHONES[norm];
  if (homophoneCandidates) {
    for (const target of homophoneCandidates) {
      const inStock = vocab.words.find(
        (w) => w.normalized === target || w.normalized.startsWith(target)
      );
      if (inStock) {
        return inStock.display;
      }
    }
  }

  // 2. Phonetic + orthographic scoring against every word across designations, brands, categories, machines
  const spokenPhon = frenchPhoneticKey(norm);
  if (spokenPhon.length < 2) return null;

  let bestWord: { display: string; score: number } | null = null;

  for (const w of vocab.words) {
    if (w.phonetic.length < 2) continue;
    if (Math.abs(w.phonetic.length - spokenPhon.length) > 2) continue;

    const phonSim = similarity(spokenPhon, w.phonetic);
    if (phonSim < 0.68) continue;

    const orthoSim = similarity(norm, w.normalized);
    const sameInitial = spokenPhon[0] === w.phonetic[0] ? 0.08 : 0;
    const freqBonus = Math.min(0.03, Math.log10(w.frequency + 1) * 0.02);

    const score = phonSim * 0.72 + orthoSim * 0.28 + sameInitial + freqBonus;
    const threshold = norm.length <= 4 ? 0.78 : 0.73;

    if (score >= threshold && (!bestWord || score > bestWord.score)) {
      bestWord = { display: w.display, score };
    }
  }

  if (bestWord) {
    return bestWord.display;
  }

  // Fallback for well-known workshop homophone even on an empty/new catalog
  if (homophoneCandidates && homophoneCandidates.length > 0 && norm === 'croix') {
    return homophoneCandidates[0];
  }

  return null;
}

/**
 * Resolves Web Speech API alternatives using the EXACT same search engine as written search.
 * - Any word or phrase that matches stock (designation, brand, category, machine, location, or reference)
 *   is written immediately — identically to typing it manually!
 * - Only when the spoken primary transcript finds 0 matches do we check alternatives #2..#5,
 *   strip French filler prepositions (e.g. "filtre à huile" -> "filtre huile"),
 *   or apply French phonetic matching against stock (e.g. "croix" -> "courroie").
 * - Never returns an empty string if the user actually spoke.
 */
export function resolveVoiceTranscriptAgainstStock(
  alternatives: string[],
  vocab: StockVoiceVocabulary,
  isFinal: boolean
): VoiceMatchResolution {
  const cleanedAlts = alternatives.map((a) => a.trim()).filter(Boolean);
  const primary = cleanedAlts[0] || '';

  if (!primary) {
    return { resolvedText: '', rawText: '', wasCorrected: false, matchedFromStock: false };
  }

  // Step 1: Test all top-5 alternatives against the EXACT written search engine (`scoreArticleByScope`).
  // If alternative #0 ("filtre", "courroie", "336D", "1R0719") already matches stock, use it as-is!
  // If alternative #0 ("croix") has 0 hits but alternative #1 ("courroie") has hits, pick alternative #1!
  for (let i = 0; i < cleanedAlts.length; i++) {
    const alt = cleanedAlts[i];

    // If it's a spoken alphanumeric reference code (contains digits), check canonical stock reference formatting
    const refMatch = matchSpokenReference(alt, vocab);
    if (refMatch) {
      return {
        resolvedText: refMatch,
        rawText: primary,
        wasCorrected: stripDiacritics(refMatch) !== stripDiacritics(primary),
        matchedFromStock: true,
      };
    }

    if (countWrittenSearchHits(alt, vocab) > 0) {
      return {
        resolvedText: alt,
        rawText: primary,
        wasCorrected: i > 0 && stripDiacritics(alt) !== stripDiacritics(primary),
        matchedFromStock: true,
      };
    }
  }

  // While user is still speaking (interim), always show the primary spoken words immediately
  // so the search bar reacts in real time just like typing.
  if (!isFinal) {
    return {
      resolvedText: primary,
      rawText: primary,
      wasCorrected: false,
      matchedFromStock: false,
    };
  }

  // Step 2: Natural spoken French helper — e.g. user says "filtre à huile" or "filtre de gasoil",
  // while catalog designation says "Filtre huile" or "Filtre gasoil".
  const rawTokens = primary.split(/\s+/).filter(Boolean);
  if (rawTokens.length >= 2) {
    const strippedFiller = rawTokens
      .filter((t) => !FRENCH_STOP_WORDS.has(stripDiacritics(t)))
      .join(' ');
    if (strippedFiller && strippedFiller !== primary && countWrittenSearchHits(strippedFiller, vocab) > 0) {
      return {
        resolvedText: strippedFiller,
        rawText: primary,
        wasCorrected: true,
        matchedFromStock: true,
      };
    }
  }

  // Step 3: Joined 2-word mis-segmentation (e.g. "du rite" -> "durite", "silence bloc" -> "silentbloc", "joint speed" -> "joint spi")
  if (rawTokens.length === 2) {
    const joined = stripDiacritics(rawTokens.join('')).replace(/[^a-z0-9]/g, '');
    const joinedPhon = frenchPhoneticKey(joined);

    for (const w of vocab.words) {
      if (
        w.normalized === joined ||
        (joinedPhon.length >= 4 && similarity(joinedPhon, w.phonetic) >= 0.85)
      ) {
        return {
          resolvedText: w.display,
          rawText: primary,
          wasCorrected: stripDiacritics(w.display) !== stripDiacritics(primary),
          matchedFromStock: true,
        };
      }
    }

    let bestBigram: { display: string; score: number } | null = null;
    for (const bg of vocab.bigrams) {
      const phonSim = similarity(joinedPhon, bg.joinedPhonetic);
      const orthoSim = similarity(joined, bg.joinedNormalized);
      const score = phonSim * 0.75 + orthoSim * 0.25;
      if (score >= 0.8 && (!bestBigram || score > bestBigram.score)) {
        bestBigram = { display: bg.display, score };
      }
    }
    if (bestBigram) {
      return {
        resolvedText: bestBigram.display,
        rawText: primary,
        wasCorrected: stripDiacritics(bestBigram.display) !== stripDiacritics(primary),
        matchedFromStock: true,
      };
    }
  }

  // Step 4: Token-by-token phonetic matching against ALL stock words (designations, brands, categories, machines)
  let anyCorrected = false;
  const resolvedTokens = rawTokens
    .filter((tok) => rawTokens.length === 1 || !FRENCH_STOP_WORDS.has(stripDiacritics(tok)))
    .map((tok) => {
      const matched = findBestStockWord(tok, vocab);
      if (matched) {
        anyCorrected = true;
        return matched;
      }
      return tok;
    });

  if (anyCorrected && resolvedTokens.length > 0) {
    const resolvedText = resolvedTokens.join(' ');
    return {
      resolvedText,
      rawText: primary,
      wasCorrected: stripDiacritics(resolvedText) !== stripDiacritics(primary),
      matchedFromStock: true,
    };
  }

  // Step 5: Always fall back to the exact spoken text — never leave the search bar blank!
  return {
    resolvedText: primary,
    rawText: primary,
    wasCorrected: false,
    matchedFromStock: false,
  };
}

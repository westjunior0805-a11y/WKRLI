import { Article, Customer } from '../types';

export interface StockVoiceVocabulary {
  /** Compacted alphanumeric reference -> original display reference (e.g. "1R0750" -> "1R-0750") */
  references: Array<{ compact: string; display: string }>;
  /** Unique meaningful words from designations, brands, and categories */
  words: Array<{
    display: string;
    normalized: string;
    phonetic: string;
    frequency: number;
  }>;
  /** Meaningful 2-word technical phrases from designations (e.g. "joint spi", "filtre huile") */
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
 * Values are preferred ONLY when the target term actually exists in the user's stock
 * (or closely matches a stock word).
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
  flexible: ['flexible', 'flexibles'],
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
  bloc: ['silentbloc', 'bloc'],
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
  komatsu: ['komatsu'],
  perkins: ['perkins'],
  cummins: ['cummins'],
  donaldson: ['donaldson'],
  fleetguard: ['fleetguard'],
  baldwin: ['baldwin'],
  mann: ['mann'],
  bosch: ['bosch'],
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
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function compactRef(input: string): string {
  return stripDiacritics(input).replace(/[^a-z0-9]/g, '').toUpperCase();
}

/**
 * Lightweight French phonetic encoder tuned for spare-part terms.
 * Examples:
 * - "croix" -> "krwa", "courroie" -> "kurwa" (edit distance 1 -> 0.80 similarity!)
 * - "philtre" -> "filtr", "filtre" -> "filtr" (1.00!)
 * - "verrin" -> "ver1", "vérin" -> "ver1" (1.00!)
 * - "joint spy" -> "jw1spi", "joint spi" -> "jw1spi" (1.00!)
 */
export function frenchPhoneticKey(raw: string): string {
  let s = stripDiacritics(raw).replace(/[^a-z0-9]/g, '');
  if (!s) return '';

  // Remove silent 'h' except in 'ch' / 'ph' / 'sh'
  s = s.replace(/ph/g, 'f');
  s = s.replace(/ch|sh/g, 'S');
  s = s.replace(/h/g, '');

  // Nasal & vowel clusters
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

  // Silent French word endings (only on longer words)
  if (s.length > 3) {
    s = s.replace(/(?:er|ez|et|es)$/, 'e');
    s = s.replace(/[sxtde]+$/, '');
  }

  // Collapse consecutive duplicate characters (e.g. "rr" -> "r", "ll" -> "l")
  s = s.replace(/(.)\1+/g, '$1');

  return s;
}

/**
 * Standard Levenshtein edit distance.
 */
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
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
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
 * Builds a fast in-memory phonetic index of the user's real stock catalog.
 */
export function buildStockVoiceVocabulary(
  articles: Article[],
  customers: Customer[] = []
): StockVoiceVocabulary {
  const refMap = new Map<string, string>();
  const wordMap = new Map<string, { display: string; normalized: string; phonetic: string; frequency: number }>();
  const bigramMap = new Map<
    string,
    { display: string; normalized: string; joinedNormalized: string; joinedPhonetic: string }
  >();
  const customerWords = new Set<string>();

  const addWord = (rawWord: string) => {
    const cleanDisplay = rawWord.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
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

  for (const art of articles) {
    if (art.mainReference) {
      const c = compactRef(art.mainReference);
      if (c.length >= 2 && !refMap.has(c)) {
        refMap.set(c, art.mainReference.trim());
      }
    }
    if (Array.isArray(art.equivalentReferences)) {
      for (const eq of art.equivalentReferences) {
        const c = compactRef(eq);
        if (c.length >= 2 && !refMap.has(c)) {
          refMap.set(c, eq.trim());
        }
      }
    }

    if (art.brand) {
      for (const w of art.brand.split(/[\s/,;()]+/)) addWord(w);
    }
    if (Array.isArray(art.brandOffers)) {
      for (const bo of art.brandOffers) {
        if (bo.brand) {
          for (const w of bo.brand.split(/[\s/,;()]+/)) addWord(w);
        }
      }
    }
    if (art.category) {
      for (const w of art.category.split(/[\s/,;&()]+/)) addWord(w);
    }

    if (art.designation) {
      const tokens = art.designation
        .split(/[\s/,;()]+/)
        .map((t) => t.replace(/^[^\p{L}\p{N}-]+|[^\p{L}\p{N}-]+$/gu, ''))
        .filter((t) => t.length >= 2);

      for (const t of tokens) {
        addWord(t);
      }

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
  }

  for (const cust of customers) {
    if (cust.name) {
      for (const w of cust.name.split(/[\s/,;()]+/)) {
        const n = stripDiacritics(w).replace(/[^a-z0-9]/g, '');
        if (n.length >= 2) customerWords.add(n);
      }
    }
  }

  return {
    references: Array.from(refMap.entries()).map(([compact, display]) => ({ compact, display })),
    words: Array.from(wordMap.values()),
    bigrams: Array.from(bigramMap.values()),
    customerWords,
  };
}

/**
 * Checks whether a candidate string already matches something directly in stock or customers.
 */
function hasDirectStockHit(candidate: string, vocab: StockVoiceVocabulary): boolean {
  const norm = stripDiacritics(candidate).trim();
  if (!norm) return false;

  const compact = compactRef(norm);
  if (compact.length >= 3 && vocab.references.some((r) => r.compact.includes(compact))) {
    return true;
  }

  const tokens = norm.split(/\s+/).filter((t) => t.length >= 2 && !FRENCH_STOP_WORDS.has(t));
  if (tokens.length === 0) return false;

  return tokens.every(
    (tok) =>
      vocab.words.some((w) => w.normalized === tok || (tok.length >= 4 && w.normalized.startsWith(tok))) ||
      vocab.customerWords.has(tok)
  );
}

/**
 * Tries to match a spoken alphanumeric code against real stock references.
 */
function matchSpokenReference(text: string, vocab: StockVoiceVocabulary): string | null {
  if (vocab.references.length === 0) return null;

  // Convert French spoken digits inside reference-like utterances (e.g. "un r 07 50" -> "1 r 07 50")
  const tokens = stripDiacritics(text)
    .replace(/\b(?:tiret|trait d['’]union)\b/g, '-')
    .split(/\s+/)
    .filter(Boolean);

  const converted = tokens.map((t) => SPOKEN_DIGITS[t] ?? t);
  const joined = converted.join('').replace(/[^a-z0-9]/gi, '').toUpperCase();

  // Only treat as a reference if it contains at least one digit and is at least 3 chars long
  if (!/\d/.test(joined) || joined.length < 3 || joined.length > 20) {
    return null;
  }

  // 1. Exact compact reference match
  const exact = vocab.references.find((r) => r.compact === joined);
  if (exact) return exact.display;

  // 2. Prefix/contains match for partial spoken reference (e.g. "0750" -> "1R-0750" if unique)
  if (joined.length >= 4) {
    const partialMatches = vocab.references.filter((r) => r.compact.includes(joined));
    if (partialMatches.length === 1) {
      return partialMatches[0].display;
    }
  }

  // 3. Fuzzy reference match (1-char tolerance for codes >= 5 chars, e.g. "1ER0750" -> "1R-0750")
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
 * 2) French phonetic similarity + orthographic similarity + initial consonant bonus
 */
function findBestStockWord(token: string, vocab: StockVoiceVocabulary): string | null {
  const norm = stripDiacritics(token).replace(/[^a-z0-9]/g, '');
  if (norm.length < 2 || FRENCH_STOP_WORDS.has(norm)) return null;

  // Never override exact stock words or known customer names
  if (vocab.customerWords.has(norm)) return null;
  const exactWord = vocab.words.find((w) => w.normalized === norm);
  if (exactWord) return null;

  // 1. Check curated workshop homophones (e.g. "croix" -> "courroie") ONLY if present in stock
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

  // 2. Phonetic + orthographic scoring against every word in the user's real stock
  const spokenPhon = frenchPhoneticKey(norm);
  if (spokenPhon.length < 2) return null;

  let bestWord: { display: string; score: number } | null = null;

  for (const w of vocab.words) {
    if (w.phonetic.length < 2) continue;
    // Skip very dissimilar lengths
    if (Math.abs(w.phonetic.length - spokenPhon.length) > 2) continue;

    const phonSim = similarity(spokenPhon, w.phonetic);
    if (phonSim < 0.68) continue;

    const orthoSim = similarity(norm, w.normalized);
    const sameInitial = spokenPhon[0] === w.phonetic[0] ? 0.08 : 0;
    const freqBonus = Math.min(0.03, Math.log10(w.frequency + 1) * 0.02);

    const score = phonSim * 0.72 + orthoSim * 0.28 + sameInitial + freqBonus;

    // Require strong overall match so unrelated words aren't distorted
    const threshold = norm.length <= 4 ? 0.78 : 0.73;
    if (score >= threshold && (!bestWord || score > bestWord.score)) {
      bestWord = { display: w.display, score };
    }
  }

  if (bestWord) {
    return bestWord.display;
  }

  // 3. Fallback to curated homophone even if stock is still empty/small
  //    (e.g. user says "croix" in an industrial spare-parts app -> "courroie")
  if (homophoneCandidates && homophoneCandidates.length > 0 && norm === 'croix') {
    return homophoneCandidates[0];
  }

  return null;
}

/**
 * Resolves Web Speech API alternatives against the live stock catalog.
 * Returns the closest matching reference, phrase, or stock keyword.
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

  // Step 1: Check all speech recognition alternatives (top 5) for an exact/direct match in stock!
  // Often Web Speech puts "croix" at #0 and "courroie" at #1 or #2.
  for (let i = 0; i < cleanedAlts.length; i++) {
    const alt = cleanedAlts[i];
    const refMatch = matchSpokenReference(alt, vocab);
    if (refMatch) {
      return {
        resolvedText: refMatch,
        rawText: primary,
        wasCorrected: stripDiacritics(refMatch) !== stripDiacritics(primary),
        matchedFromStock: true,
      };
    }

    if (hasDirectStockHit(alt, vocab)) {
      return {
        resolvedText: alt,
        rawText: primary,
        wasCorrected: i > 0 && stripDiacritics(alt) !== stripDiacritics(primary),
        matchedFromStock: true,
      };
    }
  }

  // While still speaking (interim), avoid aggressive phonetic rewrites to prevent flickering
  if (!isFinal) {
    return {
      resolvedText: primary,
      rawText: primary,
      wasCorrected: false,
      matchedFromStock: false,
    };
  }

  // Step 2: Check if joined 2-word mis-segmentation matches a stock word or bigram
  // Example: "du rite" -> "durite", "silence bloc" -> "silentbloc", "joint speed" -> "joint spi"
  const rawTokens = primary.split(/\s+/).filter(Boolean);
  if (rawTokens.length === 2) {
    const joined = stripDiacritics(rawTokens.join('')).replace(/[^a-z0-9]/g, '');
    const joinedPhon = frenchPhoneticKey(joined);

    // Check against single compound stock words (e.g. "durite", "silentbloc")
    for (const w of vocab.words) {
      if (w.normalized === joined || (joinedPhon.length >= 4 && similarity(joinedPhon, w.phonetic) >= 0.85)) {
        return {
          resolvedText: w.display,
          rawText: primary,
          wasCorrected: stripDiacritics(w.display) !== stripDiacritics(primary),
          matchedFromStock: true,
        };
      }
    }

    // Check against stock bigrams (e.g. "joint spi")
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

  // Step 3: Token-by-token phonetic matching against stock vocabulary
  let anyCorrected = false;
  const resolvedTokens = rawTokens.map((tok) => {
    const matched = findBestStockWord(tok, vocab);
    if (matched) {
      anyCorrected = true;
      return matched;
    }
    return tok;
  });

  if (anyCorrected) {
    const resolvedText = resolvedTokens.join(' ');
    return {
      resolvedText,
      rawText: primary,
      wasCorrected: stripDiacritics(resolvedText) !== stripDiacritics(primary),
      matchedFromStock: true,
    };
  }

  return {
    resolvedText: primary,
    rawText: primary,
    wasCorrected: false,
    matchedFromStock: false,
  };
}

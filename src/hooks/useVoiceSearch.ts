import { useState, useRef, useEffect, useCallback } from 'react';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [altIndex: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Cleans up speech recognition transcripts for spare-part search:
 * - Removes trailing sentence punctuation added by STT engines (., !, ?)
 * - Converts spoken "tiret" between reference chunks into "-"
 * - Compacts pure alphanumeric part codes (e.g. "1 r - 07 16" -> "1R-0716")
 *   while leaving natural French phrases ("filtre à huile") untouched.
 */
export function normalizeSpokenSearchQuery(raw: string): string {
  let text = raw.trim().replace(/[.!?,;]+$/g, '').trim();
  if (!text) return '';

  // Replace spoken "tiret" or "trait d'union" with hyphen when surrounded by alphanumeric chars
  text = text.replace(/\b([a-z0-9]+)\s+(?:tiret|trait d['’]union)\s+([a-z0-9]+)/gi, '$1-$2');

  // If the transcript contains ONLY short tokens of digits/letters/hyphens (a dictated part code like "1 r 07 16" or "1r - 0716")
  const tokens = text.split(/\s+/);
  const looksLikeDictatedPartCode =
    tokens.length >= 2 &&
    tokens.every((t) => /^[a-z0-9-]+$/i.test(t)) &&
    tokens.some((t) => /\d/.test(t)) &&
    tokens.every((t) => t.length <= 5) &&
    !/^(le|la|de|du|un|une|et|en|au|pour|sur|par)$/i.test(tokens[0]);

  if (looksLikeDictatedPartCode) {
    return text.replace(/\s*-\s*/g, '-').replace(/\s+/g, '').toUpperCase();
  }

  // Also tidy spaces around hyphens in mixed text (e.g. "filtre 1R - 0716")
  text = text.replace(/([a-z0-9])\s*-\s*([a-z0-9])/gi, '$1-$2');

  return text;
}

export interface UseVoiceSearchOptions {
  onResult: (transcript: string, isFinal: boolean, alternatives: string[]) => void;
  lang?: string;
}

export function useVoiceSearch({ onResult, lang = 'fr-FR' }: UseVoiceSearchOptions) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onResultRef = useRef(onResult);
  const errorTimerRef = useRef<number | null>(null);

  const isSupported = Boolean(getSpeechRecognitionCtor());

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const showTransientError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimerRef.current) {
      window.clearTimeout(errorTimerRef.current);
    }
    errorTimerRef.current = window.setTimeout(() => {
      setError(null);
      errorTimerRef.current = null;
    }, 4500);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore if already stopped
      }
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      showTransientError(
        'Recherche vocale non prise en charge par ce navigateur (utilisez Chrome, Edge ou Safari).'
      );
      return;
    }

    // Stop any previous instance cleanly
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }

    try {
      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let prefix = '';
        let hasFinal = false;
        const lastIndex = event.results.length - 1;

        for (let i = 0; i < lastIndex; i++) {
          const res = event.results[i];
          if (res && res[0]) {
            prefix += res[0].transcript;
            if (res.isFinal) hasFinal = true;
          }
        }

        const lastRes = event.results[lastIndex];
        const alternatives: string[] = [];
        if (lastRes) {
          if (lastRes.isFinal) hasFinal = true;
          const altCount = Math.min(lastRes.length || 1, 5);
          for (let a = 0; a < altCount; a++) {
            const alt = lastRes[a];
            if (alt?.transcript) {
              const cleaned = normalizeSpokenSearchQuery(prefix + alt.transcript);
              if (cleaned && !alternatives.includes(cleaned)) {
                alternatives.push(cleaned);
              }
            }
          }
        }

        if (alternatives.length > 0) {
          onResultRef.current(alternatives[0], hasFinal, alternatives);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        setIsListening(false);
        switch (event.error) {
          case 'not-allowed':
          case 'service-not-allowed':
            showTransientError('Accès au microphone refusé. Autorisez le micro dans votre navigateur.');
            break;
          case 'audio-capture':
            showTransientError('Aucun microphone détecté sur cet appareil.');
            break;
          case 'no-speech':
            showTransientError('Aucune voix détectée. Cliquez et parlez près du micro.');
            break;
          case 'network':
            showTransientError('Connexion réseau requise pour la reconnaissance vocale.');
            break;
          case 'aborted':
            break;
          default:
            showTransientError('Erreur lors de la capture vocale. Réessayez.');
            break;
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      showTransientError('Impossible de démarrer le microphone.');
    }
  }, [lang, showTransientError]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
        recognitionRef.current = null;
      }
      if (errorTimerRef.current) {
        window.clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    error,
    startListening,
    stopListening,
    toggleListening,
    clearError: () => setError(null),
  };
}

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square } from 'lucide-react';
import { useVoiceSearch } from '../../hooks/useVoiceSearch';
import { useStock } from '../../context/StockContext';
import {
  buildStockVoiceVocabulary,
  resolveVoiceTranscriptAgainstStock,
} from '../../utils/voiceStockMatcher';

export interface VoiceSearchButtonProps {
  onTranscript: (text: string, isFinal: boolean) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export const VoiceSearchButton: React.FC<VoiceSearchButtonProps> = ({
  onTranscript,
  size = 'sm',
  className = '',
}) => {
  const { articles, customers } = useStock();
  const [correctionNotice, setCorrectionNotice] = useState<{
    raw: string;
    resolved: string;
  } | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const vocabulary = useMemo(
    () => buildStockVoiceVocabulary(articles, customers),
    [articles, customers]
  );

  const clearCorrectionNotice = useCallback(() => {
    setCorrectionNotice(null);
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const handleVoiceResult = useCallback(
    (_transcript: string, isFinal: boolean, alternatives: string[]) => {
      const resolution = resolveVoiceTranscriptAgainstStock(alternatives, vocabulary, isFinal);
      if (!resolution.resolvedText) return;

      onTranscript(resolution.resolvedText, isFinal);

      if (isFinal && resolution.wasCorrected) {
        setCorrectionNotice({
          raw: resolution.rawText,
          resolved: resolution.resolvedText,
        });
        if (noticeTimerRef.current) {
          window.clearTimeout(noticeTimerRef.current);
        }
        noticeTimerRef.current = window.setTimeout(() => {
          setCorrectionNotice(null);
          noticeTimerRef.current = null;
        }, 4000);
      }
    },
    [onTranscript, vocabulary]
  );

  const { isSupported, isListening, error, toggleListening, clearError } = useVoiceSearch({
    onResult: handleVoiceResult,
    lang: 'fr-FR',
  });

  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          clearCorrectionNotice();
          toggleListening();
        }}
        title={
          isListening
            ? 'Arrêter la recherche vocale'
            : isSupported
            ? 'Recherche vocale intelligente (adaptée au stock)'
            : 'Recherche vocale non prise en charge sur ce navigateur'
        }
        aria-label={isListening ? 'Arrêter la recherche vocale' : 'Lancer la recherche vocale'}
        aria-pressed={isListening}
        className={`inline-flex items-center gap-1 transition-colors cursor-pointer border-0! ${
          size === 'md' ? 'p-1.5' : 'p-1'
        } ${
          isListening
            ? 'bg-rose-600! text-white! px-2 animate-pulse'
            : 'bg-transparent! text-[#595959] hover:text-[#111111] dark:text-slate-300 dark:hover:text-white'
        }`}
      >
        {isListening ? (
          <>
            <Square className="w-3 h-3 fill-current" />
            <span className="text-[11px] font-bold leading-none whitespace-nowrap">Écoute…</span>
          </>
        ) : (
          <Mic className={`${iconSize} stroke-[2.25]`} />
        )}
      </button>

      {correctionNotice && !error && !isListening && (
        <div
          role="status"
          className="absolute right-0 top-full mt-2 z-50 min-w-[210px] max-w-[280px] px-3 py-2 bg-[#111111] text-white text-[11px] leading-snug shadow-lg border-l-[3px] border-[#FFCD11] flex items-center justify-between gap-2.5"
        >
          <span className="truncate">
            <span className="text-white/60 line-through mr-1.5">{correctionNotice.raw}</span>
            <span className="text-[#FFCD11] font-mono font-bold">→ {correctionNotice.resolved}</span>
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTranscript(correctionNotice.raw, true);
              clearCorrectionNotice();
            }}
            className="text-[10px] font-mono underline text-white/75 hover:text-white bg-transparent! border-0! p-0! shrink-0 cursor-pointer"
            title="Revenir au texte brut dicté"
          >
            Brut
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          onClick={clearError}
          className="absolute right-0 top-full mt-2 z-50 w-64 px-3 py-2 bg-[#111111] text-white text-[11px] leading-snug shadow-lg border-l-[3px] border-rose-500 cursor-pointer"
        >
          {error}
        </div>
      )}
    </div>
  );
};

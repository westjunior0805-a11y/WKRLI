import React from 'react';
import { Search, X } from 'lucide-react';
import { VoiceSearchButton } from './VoiceSearchButton';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  rightSlot?: React.ReactNode;
  ariaLabel?: string;
  enableVoice?: boolean;
}

export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  placeholder = 'Rechercher...',
  className = '',
  inputClassName = '',
  autoFocus = false,
  onKeyDown,
  inputRef,
  rightSlot,
  ariaLabel = 'Champ de recherche',
  enableVoice = true,
}) => {
  const rightPaddingClass = rightSlot
    ? 'pr-28'
    : value && enableVoice
    ? 'pr-20'
    : enableVoice || value
    ? 'pr-12'
    : 'pr-4';

  return (
    <div className={`relative w-full ${className}`}>
      <Search
        className="w-4 h-4 text-[#595959] dark:text-slate-400 absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        data-search-input="true"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`search-input-prominent w-full pl-8 ${rightPaddingClass} py-2.5 text-sm font-medium bg-transparent text-[#111111] dark:text-slate-100 border-0 border-b-2 border-[#CCCCCC] dark:border-slate-600 focus:outline-none focus:border-[#FFCD11] transition-colors ${inputClassName}`}
      />
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-1 text-[#595959] hover:text-[#111111] dark:text-slate-300 dark:hover:text-white cursor-pointer border-0! bg-transparent!"
            title="Effacer la recherche"
            aria-label="Effacer la recherche"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {enableVoice && (
          <VoiceSearchButton
            size="sm"
            onTranscript={(text) => {
              onChange(text);
              inputRef?.current?.focus();
            }}
          />
        )}
        {rightSlot}
      </div>
    </div>
  );
};

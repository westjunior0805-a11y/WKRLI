import React from 'react';
import { Search, X } from 'lucide-react';

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
}) => {
  return (
    <div className={`relative w-full ${className}`}>
      <Search
        className="w-4 h-4 text-[#1B1B1B] dark:text-slate-100 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.25]"
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
        className={`search-input-prominent w-full pl-10 ${
          rightSlot ? 'pr-24' : value ? 'pr-9' : 'pr-4'
        } py-2.5 text-sm font-medium bg-white dark:bg-slate-900 text-[#1B1B1B] dark:text-slate-100 border-[1.5px] border-[#374151] dark:border-slate-400 rounded-md focus:outline-none focus:border-[#1B1B1B] dark:focus:border-white transition-colors ${inputClassName}`}
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-1 text-[#4B5563] hover:text-[#1B1B1B] dark:text-slate-300 dark:hover:text-white rounded cursor-pointer border-0! bg-transparent!"
            title="Effacer la recherche"
            aria-label="Effacer la recherche"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {rightSlot}
      </div>
    </div>
  );
};

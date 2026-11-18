import React, { useState, useEffect } from 'react';

export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | undefined | null;
  onChange: (value: number) => void;
  allowEmpty?: boolean;
  min?: number;
  max?: number;
}

/**
 * NumericInput:
 * Champ numérique ergonomique où le zéro est virtuel/fictif :
 * - Si la valeur est 0, le champ affiche placeholder="0" et peut être totalement vidé (chaîne vide).
 * - Quand l'utilisateur efface ou tape un nombre, le champ réagit sans bloquer ni réinsérer brutalement "0".
 * - À la perte du focus (onBlur), si le champ est vide, il se normalise proprement (à min || 0).
 */
export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  min,
  max,
  className = '',
  placeholder = '0',
  ...rest
}) => {
  // Convert initial/incoming numeric value to display string: empty string if 0, else string number
  const [textValue, setTextValue] = useState<string>(() => {
    if (value === undefined || value === null || value === 0) return '';
    return String(value);
  });

  // Sync external value changes when not actively typing or if external value deviates
  useEffect(() => {
    const num = parseFloat(textValue);
    const effectiveNum = isNaN(num) ? 0 : num;
    if (value !== effectiveNum) {
      if (value === undefined || value === null || value === 0) {
        setTextValue('');
      } else {
        setTextValue(String(value));
      }
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow empty string so user can freely backspace / clear the field
    if (raw === '') {
      setTextValue('');
      onChange(min !== undefined && min > 0 ? min : 0);
      return;
    }

    // Only allow numbers, optional decimal point/comma
    const sanitized = raw.replace(',', '.');
    if (!/^-?\d*\.?\d*$/.test(sanitized)) {
      return;
    }

    setTextValue(raw);
    const parsed = parseFloat(sanitized);
    if (!isNaN(parsed)) {
      let finalVal = parsed;
      if (max !== undefined && finalVal > max) finalVal = max;
      onChange(finalVal);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (textValue.trim() === '') {
      const defaultVal = min !== undefined && min > 0 ? min : 0;
      onChange(defaultVal);
      if (defaultVal > 0) {
        setTextValue(String(defaultVal));
      } else {
        setTextValue('');
      }
    } else {
      const parsed = parseFloat(textValue.replace(',', '.'));
      if (isNaN(parsed)) {
        const defaultVal = min !== undefined && min > 0 ? min : 0;
        onChange(defaultVal);
        setTextValue(defaultVal > 0 ? String(defaultVal) : '');
      } else {
        let normalized = parsed;
        if (min !== undefined && normalized < min) normalized = min;
        if (max !== undefined && normalized > max) normalized = max;
        onChange(normalized);
        setTextValue(normalized === 0 ? '' : String(normalized));
      }
    }
    rest.onBlur?.(e);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={textValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      {...rest}
    />
  );
};

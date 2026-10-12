import { useId } from 'react';
import { TYPE_OPTIONS, type VocabularyType } from '../../lib/vocabulary';

export interface TypePickerProps {
  value: VocabularyType | '';
  onChange: (type: VocabularyType) => void;
  error?: string;
}

/** Tipo de vocabulario (obligatorio, spec vocabulary-curation): botones de opción, usables con flechas. */
export function TypePicker({ value, onChange, error }: TypePickerProps) {
  const name = useId();
  const errorId = useId();
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1.5 text-sm font-medium text-neutral-800">
        Tipo<span className="ml-0.5 text-red-600" aria-hidden>*</span>
        {" "}<span className="sr-only">(obligatorio)</span>
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {TYPE_OPTIONS.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={[
                'flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-sm transition-colors',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600',
                checked ? 'border-brand-600 bg-brand-100 text-brand-900' : 'border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50',
                error && !checked ? 'border-red-400' : '',
              ].join(' ')}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="font-medium">{option.label}</span>
              <span className={`text-xs ${checked ? 'text-brand-900/70' : 'text-neutral-500'}`}>{option.example}</span>
            </label>
          );
        })}
      </div>
      {error && <p id={errorId} className="mt-1.5 text-sm text-red-700">{error}</p>}
    </fieldset>
  );
}

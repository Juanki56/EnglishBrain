import { type SelectHTMLAttributes, useId } from 'react';
import { CONTROL_CLASSES, controlState, describedBy, Field } from './Field';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  options: Array<{ value: string; label: string }>;
  hint?: string;
  error?: string;
  id?: string;
}

export function Select({ label, options, hint, error, required, id, className = '', ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <Field id={selectId} label={label} required={required} hint={hint} error={error}>
      <select
        id={selectId}
        required={required}
        className={`${CONTROL_CLASSES} h-10 ${controlState(error)} ${className}`}
        {...describedBy(selectId, error, hint)}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </Field>
  );
}

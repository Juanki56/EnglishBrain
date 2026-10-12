import { type InputHTMLAttributes, useId } from 'react';
import { CONTROL_CLASSES, controlState, describedBy, Field } from './Field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
}

export function Input({ label, hint, error, required, id, className = '', ref, ...props }: InputProps & { ref?: React.Ref<HTMLInputElement> }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field id={inputId} label={label} required={required} hint={hint} error={error}>
      <input
        id={inputId}
        ref={ref}
        required={required}
        className={`${CONTROL_CLASSES} h-10 ${controlState(error)} ${className}`}
        {...describedBy(inputId, error, hint)}
        {...props}
      />
    </Field>
  );
}

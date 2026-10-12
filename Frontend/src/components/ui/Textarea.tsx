import { type TextareaHTMLAttributes, useId } from 'react';
import { CONTROL_CLASSES, controlState, describedBy, Field } from './Field';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
}

export function Textarea({
  label,
  hint,
  error,
  required,
  id,
  rows = 4,
  className = '',
  ref,
  ...props
}: TextareaProps & { ref?: React.Ref<HTMLTextAreaElement> }) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  return (
    <Field id={textareaId} label={label} required={required} hint={hint} error={error}>
      <textarea
        id={textareaId}
        ref={ref}
        rows={rows}
        required={required}
        className={`${CONTROL_CLASSES} resize-y py-2 leading-relaxed ${controlState(error)} ${className}`}
        {...describedBy(textareaId, error, hint)}
        {...props}
      />
    </Field>
  );
}

import type { ReactNode } from 'react';

export interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  /** Ayuda bajo el campo cuando no hay error. */
  hint?: string;
  /** Mensaje de error (p. ej. el `details[].message` del Backend). */
  error?: string;
  children: ReactNode;
}

/** Etiqueta, asterisco de obligatorio, ayuda y error comunes a Input y Textarea. */
export function Field({ id, label, required, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-neutral-800">
        {label}
        {required && (
          <>
            <span className="ml-0.5 text-red-600" aria-hidden>*</span>
            {" "}<span className="sr-only">(obligatorio)</span>
          </>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-700">{error}</p>
      ) : (
        hint && <p id={`${id}-hint`} className="text-sm text-neutral-500">{hint}</p>
      )}
    </div>
  );
}

/** Atributos de accesibilidad que conectan el control con su ayuda o error. */
export function describedBy(id: string, error?: string, hint?: string) {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}

export const CONTROL_CLASSES = [
  'w-full rounded-lg border bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400',
  'focus:outline-2 focus:outline-offset-0 disabled:bg-neutral-100 disabled:text-neutral-500',
].join(' ');

export const controlState = (error?: string) =>
  error ? 'border-red-500 focus:outline-red-500' : 'border-neutral-300 focus:border-brand-600 focus:outline-brand-600';

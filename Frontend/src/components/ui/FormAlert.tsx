import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';

/** Mensaje general de un formulario (no ligado a un campo concreto). */
export function FormAlert({ variant = 'error', children }: { variant?: 'error' | 'success'; children: ReactNode }) {
  const error = variant === 'error';
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${
        error ? 'border-red-200 bg-red-50 text-red-800' : 'border-brand-200 bg-brand-50 text-brand-900'
      }`}
    >
      {error ? <AlertCircle size={18} className="mt-px shrink-0" aria-hidden /> : <CheckCircle2 size={18} className="mt-px shrink-0" aria-hidden />}
      <div className="flex-1">{children}</div>
    </div>
  );
}

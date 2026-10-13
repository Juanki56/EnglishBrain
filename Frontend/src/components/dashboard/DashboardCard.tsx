import type { ReactNode } from 'react';
import { Button } from '../ui/Button';

/**
 * Tarjeta del Panel con título y sus estados de carga y error: si un bloque
 * falla, el resto del Panel sigue funcionando y este ofrece reintentar.
 */
export function DashboardCard({
  title,
  action,
  loading = false,
  error = '',
  onRetry,
  className = '',
  children,
}: {
  title: string;
  /** Enlace o botón a la derecha del título. */
  action?: ReactNode;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section aria-label={title} className={`rounded-2xl border border-neutral-200 bg-white px-6 py-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-700">{title}</h2>
        {action}
      </div>
      {error ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-red-700">No se pudo cargar: {error}</p>
          {onRetry && <Button variant="secondary" onClick={onRetry}>Reintentar</Button>}
        </div>
      ) : loading ? (
        <p role="status" className="text-sm text-neutral-500">Cargando…</p>
      ) : (
        children
      )}
    </section>
  );
}

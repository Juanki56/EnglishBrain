import { Loader2 } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { serverWake } from '../../lib/serverWake';

/**
 * Franja «Despertando el servidor…» (spec public-hosting). Se monta una vez en
 * App y queda por encima de todo, también de la sesión Anki a pantalla completa.
 */
export function ServerWakeNotice() {
  const waking = useSyncExternalStore(serverWake.subscribe, serverWake.isWaking);

  if (!waking) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center">
      <p
        role="status"
        aria-label="Despertando el servidor"
        className="flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-900 shadow-sm"
      >
        <Loader2 size={16} className="animate-spin" aria-hidden />
        Despertando el servidor… la primera carga puede tardar hasta un minuto.
      </p>
    </div>
  );
}

import { PartyPopper } from 'lucide-react';
import type { Grade } from '../../hooks/useAnkiKeyboard';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import { GRADES } from './types';

/** Resumen de fin de sesión (spec srs-review): tarjetas repasadas y distribución de calificaciones. */
export function SessionSummary({
  grades,
  remaining,
  onContinue,
  onExit,
}: {
  grades: Grade[];
  /** Tarjetas vencidas que no entraron en esta tanda. */
  remaining: number;
  onContinue: () => void;
  onExit: () => void;
}) {
  const counts = GRADES.map((g) => ({ ...g, count: grades.filter((x) => x === g.grade).length }));
  const max = Math.max(1, ...counts.map((c) => c.count));

  return (
    <section aria-label="Resumen de la sesión" className="mx-auto flex max-w-lg flex-col items-center gap-6 text-center">
      <PartyPopper className="text-brand-600" size={44} aria-hidden />
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">¡Sesión terminada!</h2>
        <p className="mt-2 text-lg text-neutral-600">
          {grades.length === 1 ? 'Repasaste 1 tarjeta.' : `Repasaste ${grades.length} tarjetas.`}
        </p>
      </div>

      <ul aria-label="Calificaciones" className="flex w-full flex-col gap-2">
        {counts.map((c) => (
          <li key={c.grade} className="flex items-center gap-3 text-sm">
            <span className="w-20 text-right font-medium text-neutral-700">{c.label}</span>
            <span className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
              <span className={`block h-full rounded-full ${c.bar}`} style={{ width: `${(c.count / max) * 100}%` }} />
            </span>
            <span className="w-8 text-left tabular-nums text-neutral-900">{c.count}</span>
          </li>
        ))}
      </ul>

      <div className="flex gap-3">
        {remaining > 0 && (
          <Button variant="secondary" onClick={onContinue}>Seguir con {remaining} más</Button>
        )}
        <Button onClick={onExit}>
          Volver al panel <span className="ml-1 flex items-center opacity-90" aria-hidden><Kbd>Esc</Kbd></span>
        </Button>
      </div>
    </section>
  );
}

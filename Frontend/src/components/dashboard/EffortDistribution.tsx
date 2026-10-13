import { type Effort, percent } from './types';

/**
 * Distribución de esfuerzo de los últimos 30 días (spec dashboard): registros
 * creados, repasos y check-ins por habilidad, destacando la principal.
 */
export function EffortDistribution({ data }: { data: Effort }) {
  const top = data.skills.find((s) => s.skill === data.top);

  if (!top) {
    return <p className="text-sm text-neutral-600">Aún no hay actividad en los últimos 30 días. Repasa, graba o escribe algo y aquí verás en qué te enfocas.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-600">
        Tu foco: <strong className="font-semibold text-brand-900">{top.label}</strong>
      </p>
      <ul className="flex flex-col gap-2.5">
        {data.skills.map((s) => (
          <li key={s.skill} aria-label={`${s.label}: ${percent(s.share)}`} className="flex flex-col gap-1 text-sm">
            <span className="flex justify-between">
              <span className={s.skill === data.top ? 'font-medium text-neutral-900' : 'text-neutral-700'}>{s.label}</span>
              <span className="tabular-nums text-neutral-600">{percent(s.share)}</span>
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
              <span
                className={`block h-full rounded-full ${s.skill === data.top ? 'bg-brand-600' : 'bg-brand-200'}`}
                style={{ width: percent(s.share).replace(' ', '') }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

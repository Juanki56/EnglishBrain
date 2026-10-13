import { Flame } from 'lucide-react';
import type { Streak } from './types';

// Las fechas llegan como día local del perfil ("2026-10-12"): se formatean en UTC
// para que la zona del navegador no las mueva al día anterior.
const dayFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const formatDay = (date: string) => dayFormat.format(new Date(`${date}T00:00:00Z`));

/** Intensidad de la celda según las actividades del día (clases explícitas para Tailwind). */
function intensity(count: number) {
  if (count === 0) return 'bg-neutral-100';
  if (count === 1) return 'bg-brand-100';
  if (count <= 3) return 'bg-brand-200';
  if (count <= 6) return 'bg-brand-600/60';
  return 'bg-brand-600';
}

const activities = (count: number) => (count === 1 ? '1 actividad' : `${count} actividades`);

/**
 * Racha activa y mapa de calor de 30 días estilo GitHub (spec habit-tracking):
 * cada celda es un día y se oscurece con la cantidad de actividad.
 */
export function StreakHeatmap({ data }: { data: Streak }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <Flame className={data.streak > 0 ? 'text-amber-500' : 'text-neutral-300'} size={30} aria-hidden />
        <p className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tabular-nums tracking-tight" data-testid="streak">{data.streak}</span>
          <span className="text-sm text-neutral-600">{data.streak === 1 ? 'día seguido' : 'días seguidos'}</span>
        </p>
      </div>
      {!data.today_active && (
        <p className="text-xs text-neutral-500">
          {data.streak > 0 ? 'Haz algo hoy para no perder la racha.' : 'Repasa, añade una palabra o marca un hábito para empezar tu racha.'}
        </p>
      )}

      <ol aria-label="Actividad de los últimos 30 días" className="grid grid-cols-10 gap-1.5">
        {data.heatmap.map(({ date, count }) => {
          const isToday = date === data.today;
          const label = `${formatDay(date)}${isToday ? ' (hoy)' : ''}: ${activities(count)}`;
          return (
            <li
              key={date}
              aria-label={label}
              title={label}
              className={`aspect-square rounded-[4px] ${intensity(count)} ${isToday ? 'ring-2 ring-brand-600 ring-offset-1' : ''}`}
            />
          );
        })}
      </ol>
      <div className="flex items-center justify-end gap-1.5 text-xs text-neutral-500" aria-hidden>
        Menos
        {[0, 1, 2, 4, 7].map((n) => <span key={n} className={`size-3 rounded-[3px] ${intensity(n)}`} />)}
        Más
      </div>
    </div>
  );
}

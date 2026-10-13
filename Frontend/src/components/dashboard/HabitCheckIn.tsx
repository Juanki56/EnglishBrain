import { Check } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../hooks/useToast';
import { generalMessage } from '../../lib/api';
import type { Habit, TodayHabits } from './types';

export const HABITS: Array<{ habit: Habit; label: string }> = [
  { habit: 'reading_listening', label: 'Hoy consumí contenido (Reading / Listening)' },
  { habit: 'speaking', label: 'Hoy practiqué conversación (Speaking)' },
  { habit: 'writing', label: 'Hoy redacté algo (Writing)' },
];

/**
 * Check-in diario (spec habit-tracking): tres casillas que se guardan al
 * instante. `onToggle` avisa al Panel para encender o apagar la celda de hoy
 * sin recargar; si el Backend falla, la casilla vuelve a su estado.
 */
export function HabitCheckIn({
  data,
  onChange,
  onToggle,
}: {
  data: TodayHabits;
  onChange: (data: TodayHabits) => void;
  onToggle: (checked: boolean) => void;
}) {
  const api = useApi();
  const toast = useToast();

  async function toggle(habit: Habit, checked: boolean) {
    const previous = data;
    onChange({ ...data, habits: { ...data.habits, [habit]: checked } });
    onToggle(checked);
    try {
      onChange(await api.put<TodayHabits>('/api/habits/today', { [habit]: checked }));
    } catch (error) {
      onChange(previous);
      onToggle(!checked);
      toast.show(`No se guardó el check-in (${generalMessage(error)}).`, { variant: 'error' });
    }
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">Check-in de hoy</legend>
      {HABITS.map(({ habit, label }) => {
        const checked = data.habits[habit];
        return (
          <label
            key={habit}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-brand-600 ${
              checked ? 'border-brand-200 bg-brand-50 text-brand-900' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => void toggle(habit, e.target.checked)} />
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-300 bg-white'}`}
              aria-hidden
            >
              {checked && <Check size={14} strokeWidth={3} />}
            </span>
            {label}
          </label>
        );
      })}
    </fieldset>
  );
}

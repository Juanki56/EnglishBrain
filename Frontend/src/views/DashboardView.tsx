import { AlertTriangle, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router';
import { DashboardCard } from '../components/dashboard/DashboardCard';
import { EffortDistribution } from '../components/dashboard/EffortDistribution';
import { HabitCheckIn } from '../components/dashboard/HabitCheckIn';
import { RecentWords } from '../components/dashboard/RecentWords';
import { StreakHeatmap } from '../components/dashboard/StreakHeatmap';
import { TodayQueue } from '../components/dashboard/TodayQueue';
import type { Effort, Overview, Streak, TodayHabits } from '../components/dashboard/types';
import { VocabularyBar } from '../components/dashboard/VocabularyBar';
import { useResource } from '../hooks/useResource';

/**
 * Suma o resta una actividad a hoy en el mapa de calor y ajusta la racha:
 * así la celda de hoy se enciende al marcar un check-in, sin recargar.
 */
export function applyTodayActivity(data: Streak, delta: 1 | -1): Streak {
  const heatmap = data.heatmap.map((day) => (day.date === data.today ? { ...day, count: Math.max(0, day.count + delta) } : day));
  const todayActive = (heatmap.find((day) => day.date === data.today)?.count ?? 0) > 0;
  const streak = data.streak + (todayActive === data.today_active ? 0 : todayActive ? 1 : -1);
  return { ...data, heatmap, today_active: todayActive, streak: Math.max(0, streak) };
}

/**
 * Panel (spec dashboard): tres columnas de escritorio. Métricas a la izquierda,
 * la cola del día en el centro y, a la derecha, lo último añadido a mano y el
 * check-in de hábitos. Cada bloque carga por su cuenta: si uno falla, el resto sigue.
 */
export function DashboardView() {
  const overview = useResource<Overview>('/api/stats/overview');
  const streak = useResource<Streak>('/api/stats/streak');
  const effort = useResource<Effort>('/api/stats/effort');
  const habits = useResource<TodayHabits>('/api/habits/today');

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-100 text-brand-900">
          <LayoutDashboard size={22} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Panel</h1>
          <p className="text-sm text-neutral-600">Tu racha, el estado de tu vocabulario y lo que te toca repasar hoy.</p>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] items-start gap-6">
        {/* Columna 1: métricas */}
        <div className="flex flex-col gap-6">
          <DashboardCard title="Racha" loading={streak.loading} error={streak.error} onRetry={streak.reload}>
            {streak.data && <StreakHeatmap data={streak.data} />}
          </DashboardCard>
          <DashboardCard title="Vocabulario" loading={overview.loading} error={overview.error} onRetry={overview.reload}>
            {overview.data && <VocabularyBar vocabulary={overview.data.vocabulary} />}
          </DashboardCard>
          <DashboardCard
            title="Errores críticos"
            loading={overview.loading}
            error={overview.error}
            onRetry={overview.reload}
            action={<Link to="/errors" className="text-xs font-medium text-brand-600 hover:underline">Ver el muro</Link>}
          >
            {overview.data && (
              <p className="flex items-center gap-3">
                <AlertTriangle className={overview.data.critical_errors > 0 ? 'text-red-600' : 'text-neutral-300'} size={28} aria-hidden />
                <span className="text-4xl font-semibold tabular-nums tracking-tight" data-testid="critical-errors">{overview.data.critical_errors}</span>
                <span className="text-sm text-neutral-600">{overview.data.critical_errors === 1 ? 'error sin superar' : 'errores sin superar'}</span>
              </p>
            )}
          </DashboardCard>
          <DashboardCard title="Esfuerzo en 30 días" loading={effort.loading} error={effort.error} onRetry={effort.reload}>
            {effort.data && <EffortDistribution data={effort.data} />}
          </DashboardCard>
        </div>

        {/* Columna 2: cola del día */}
        <DashboardCard title="Hoy" loading={overview.loading} error={overview.error} onRetry={overview.reload}>
          {overview.data && <TodayQueue dueCount={overview.data.due_count} />}
        </DashboardCard>

        {/* Columna 3: accesos rápidos y check-in */}
        <div className="flex flex-col gap-6">
          <DashboardCard title="Check-in de hoy" loading={habits.loading} error={habits.error} onRetry={habits.reload}>
            {habits.data && (
              <HabitCheckIn
                data={habits.data}
                onChange={habits.setData}
                onToggle={(checked) => streak.setData((data) => data && applyTodayActivity(data, checked ? 1 : -1))}
              />
            )}
          </DashboardCard>
          <RecentWords />
        </div>
      </div>
    </div>
  );
}

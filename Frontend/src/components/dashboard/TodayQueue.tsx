import { Brain, PartyPopper } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../ui/Button';

/**
 * Carga de trabajo del día (spec dashboard): cuántos registros vencen hoy y el
 * botón que abre la sesión Anki a pantalla completa. Sin vencidos, el botón se
 * deshabilita y se felicita al usuario.
 */
export function TodayQueue({ dueCount }: { dueCount: number }) {
  const navigate = useNavigate();

  function startReview() {
    // El clic es el gesto que exige la Fullscreen API; la sesión empieza directamente.
    document.documentElement.requestFullscreen?.().catch(() => {});
    navigate('/review', { state: { start: true } });
  }

  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-900">
        {dueCount > 0 ? <Brain size={32} aria-hidden /> : <PartyPopper size={32} aria-hidden />}
      </span>
      <div className="flex flex-col gap-2">
        <p className="text-2xl font-semibold tracking-tight text-neutral-900">
          {dueCount === 1 ? 'Tienes 1 término vencido para hoy' : `Tienes ${dueCount} términos vencidos para hoy`}
        </p>
        <p className="text-sm text-neutral-600">
          {dueCount > 0
            ? 'Palabras, errores, audios, textos y retos de escucha que toca repasar.'
            : '¡Felicidades, estás al día! Vuelve mañana o añade palabras nuevas.'}
        </p>
      </div>
      <Button onClick={startReview} disabled={dueCount === 0} className="h-12 px-8 text-base" icon={<Brain size={18} aria-hidden />}>
        Empezar repaso
      </Button>
    </div>
  );
}

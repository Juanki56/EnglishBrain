import { Brain, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { CardFace } from '../components/anki/CardFace';
import { SessionSummary } from '../components/anki/SessionSummary';
import { GRADES, ITEM_TYPE_LABELS, type QueueCard } from '../components/anki/types';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { Kbd } from '../components/ui/Kbd';
import { type Grade, useAnkiKeyboard } from '../hooks/useAnkiKeyboard';
import { useApi } from '../hooks/useApi';
import { useHotkeys } from '../hooks/useHotkeys';
import { useToast } from '../hooks/useToast';
import { generalMessage } from '../lib/api';

/** Tarjetas por tanda (la cola puede tener cientos tras unas vacaciones). */
export const BATCH_SIZE = 100;

type Phase = 'loading' | 'error' | 'intro' | 'session' | 'done';

const enterFullscreen = () => {
  document.documentElement.requestFullscreen?.().catch(() => {});
};
const exitFullscreen = () => {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
};

/**
 * Sesión Anki (spec srs-review): pantalla completa, minimalista y operable
 * solo con el teclado. Espacio voltea, 1–4 califica, Esc sale.
 * Calificar "Otra vez" (1) devuelve la tarjeta al final de la sesión.
 * Cada calificación se guarda en segundo plano para no frenar el ritmo.
 */
export function AnkiSessionView() {
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState('');
  const [queue, setQueue] = useState<QueueCard[]>([]);
  const [dueTotal, setDueTotal] = useState(0);
  const [batchSize, setBatchSize] = useState(0);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [flipped, setFlipped] = useState(false);

  const load = useCallback(
    async (thenStart: boolean) => {
      setPhase('loading');
      try {
        const page = await api.get<{ items: QueueCard[]; total: number }>('/api/srs/queue', { query: { limit: BATCH_SIZE } });
        setQueue(page.items);
        setDueTotal(page.total);
        setBatchSize(page.items.length);
        setFlipped(false);
        setPhase(thenStart && page.items.length > 0 ? 'session' : 'intro');
      } catch (error) {
        setLoadError(generalMessage(error));
        setPhase('error');
      }
    },
    [api],
  );

  // Desde el botón del Panel la sesión empieza directamente (sin la pantalla de inicio).
  const startNow = Boolean((location.state as { start?: boolean } | null)?.start);

  useEffect(() => {
    void load(startNow);
    return exitFullscreen;
  }, [load, startNow]);

  function start() {
    if (queue.length === 0) return;
    enterFullscreen();
    setGrades([]);
    setPhase('session');
  }

  function exit() {
    exitFullscreen();
    navigate('/');
  }

  function grade(value: Grade) {
    const card = queue[0];
    if (!card) return;
    const next = value === 1 ? [...queue.slice(1), card] : queue.slice(1);
    setQueue(next);
    setGrades((list) => [...list, value]);
    setFlipped(false);
    if (next.length === 0) setPhase('done');

    api.post('/api/srs/review', { item_type: card.item_type, item_id: card.item_id, grade: value }).catch((error) => {
      // Si no se guardó, la tarjeta vuelve a la sesión para no perder el repaso.
      toast.show(`No se guardó la calificación (${generalMessage(error)}). La tarjeta vuelve a la cola.`, { variant: 'error' });
      setGrades((list) => list.slice(0, -1));
      setQueue((list) => [...list, card]);
      setPhase((current) => (current === 'done' ? 'session' : current));
    });
  }

  useAnkiKeyboard({ flipped, onFlip: () => setFlipped(true), onGrade: grade, onExit: exit, enabled: phase === 'session' });
  useHotkeys(
    { Enter: () => (phase === 'intro' ? start() : exit()), Escape: exit },
    { enabled: phase === 'intro' || phase === 'done' || phase === 'error' },
  );

  const card = queue[0];
  const reviewed = grades.length;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-neutral-50">
      <header className="flex items-center justify-between gap-6 border-b border-neutral-200 bg-white px-8 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-100 text-brand-900">
            <Brain size={20} aria-hidden />
          </span>
          <h1 className="text-lg font-semibold">Repasar</h1>
        </div>
        {phase === 'session' && (
          <div className="flex flex-1 items-center gap-4" aria-label="Progreso de la sesión">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
              <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${(reviewed / (reviewed + queue.length)) * 100}%` }} />
            </div>
            <p className="text-sm tabular-nums text-neutral-600">
              {reviewed} repasadas · quedan {queue.length}
            </p>
          </div>
        )}
        <Button variant="ghost" onClick={exit} icon={<X size={16} aria-hidden />}>
          Salir <span className="ml-1 flex items-center text-neutral-500" aria-hidden><Kbd>Esc</Kbd></span>
        </Button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 py-10">
        {phase === 'loading' && <p role="status" className="text-neutral-500">Preparando tus tarjetas…</p>}

        {phase === 'error' && (
          <div className="flex max-w-md flex-col gap-4">
            <FormAlert>{loadError}</FormAlert>
            <Button onClick={() => void load(false)}>Reintentar</Button>
          </div>
        )}

        {phase === 'intro' && (
          <section aria-label="Inicio de la sesión" className="flex max-w-lg flex-col items-center gap-5 text-center">
            {queue.length === 0 ? (
              <>
                <p className="text-5xl" aria-hidden>🎉</p>
                <h2 className="text-3xl font-semibold tracking-tight">¡Estás al día!</h2>
                <p className="text-lg text-neutral-600">No tienes tarjetas pendientes. Vuelve más tarde o añade palabras nuevas.</p>
                <Button onClick={exit}>Volver al panel</Button>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-semibold tracking-tight">
                  {dueTotal === 1 ? 'Tienes 1 tarjeta para repasar' : `Tienes ${dueTotal} tarjetas para repasar`}
                </h2>
                {dueTotal > batchSize && <p className="text-neutral-600">Empezamos con las {batchSize} más atrasadas.</p>}
                <ul className="flex flex-col gap-1 text-sm text-neutral-600">
                  <li><Kbd>Espacio</Kbd> voltea la tarjeta</li>
                  <li><Kbd>1</Kbd> <Kbd>2</Kbd> <Kbd>3</Kbd> <Kbd>4</Kbd> califican: Otra vez, Difícil, Bien, Fácil</li>
                  <li><Kbd>Esc</Kbd> sale (lo repasado ya queda guardado)</li>
                </ul>
                <Button onClick={start} className="h-12 px-8 text-base">
                  Empezar <span className="ml-1 flex items-center opacity-90" aria-hidden><Kbd>Enter</Kbd></span>
                </Button>
              </>
            )}
          </section>
        )}

        {phase === 'session' && card && (
          <article aria-label="Tarjeta" className="flex w-full max-w-3xl flex-col gap-8">
            <div className="rounded-3xl border border-neutral-200 bg-white px-12 py-12 shadow-sm">
              <p className="mb-8 text-center">
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">{ITEM_TYPE_LABELS[card.item_type]}</span>
              </p>
              <CardFace key={`${card.item_type}:${card.item_id}:${reviewed}`} card={card} flipped={flipped} />
            </div>

            {!flipped ? (
              <Button variant="secondary" onClick={() => setFlipped(true)} className="mx-auto h-12 px-8 text-base">
                Mostrar respuesta <span className="ml-1 flex items-center text-neutral-500" aria-hidden><Kbd>Espacio</Kbd></span>
              </Button>
            ) : (
              <div role="group" aria-label="Califica la tarjeta" className="grid grid-cols-4 gap-3">
                {GRADES.map((g) => (
                  <button
                    key={g.grade}
                    type="button"
                    onClick={() => grade(g.grade)}
                    aria-keyshortcuts={String(g.grade)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-4 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${g.className}`}
                  >
                    <span className="text-base font-semibold">{g.label}</span>
                    <span className="text-xs opacity-80">{g.hint}</span>
                    <span className="mt-1" aria-hidden><Kbd>{g.grade}</Kbd></span>
                  </button>
                ))}
              </div>
            )}
          </article>
        )}

        {phase === 'done' && (
          <SessionSummary grades={grades} remaining={Math.max(0, dueTotal - batchSize)} onContinue={() => void load(true)} onExit={exit} />
        )}
      </main>
    </div>
  );
}

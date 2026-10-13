import { ExternalLink } from 'lucide-react';
import { formatSeconds } from '../../hooks/useRecorder';
import { typeLabel, type VocabularyType } from '../../lib/vocabulary';
import { AudioPlayer } from '../speaking/AudioPlayer';
import { HighlightedContext } from '../vocabulary/HighlightedContext';
import type { QueueCard } from './types';

const str = (value: unknown) => (typeof value === 'string' ? value : '');

/**
 * Anverso y reverso de cada tipo de tarjeta (spec srs-review "Presentación por
 * tipo de registro"). El reverso solo se muestra tras voltear con Espacio.
 */
export function CardFace({ card, flipped }: { card: QueueCard; flipped: boolean }) {
  const { front, back } = card;

  switch (card.item_type) {
    case 'vocabulary':
      return (
        <>
          <Front prompt="¿Qué significa?">
            <p className="text-5xl font-semibold tracking-tight break-words">{str(front.word)}</p>
            {str(front.context_sentence) && (
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-neutral-600">
                <HighlightedContext text={str(front.context_sentence)} term={str(front.word)} />
              </p>
            )}
          </Front>
          {flipped && (
            <Back>
              <p className="text-3xl font-semibold text-brand-900">{str(back.translation)}</p>
              {str(back.definition) && <p className="mt-3 text-lg text-neutral-700">{str(back.definition)}</p>}
              {str(back.type) && <p className="mt-3 text-sm text-neutral-500">{typeLabel(str(back.type) as VocabularyType)}</p>}
            </Back>
          )}
        </>
      );

    case 'fossilized_error':
      return (
        <>
          <Front prompt="¿Cómo se dice correctamente?">
            <p className="text-4xl font-semibold tracking-tight text-red-800 line-through decoration-red-400/60">{str(front.incorrect_phrase)}</p>
          </Front>
          {flipped && (
            <Back>
              <p className="text-3xl font-semibold text-brand-900">{str(back.correct_phrase)}</p>
              {str(back.notes) && <p className="mt-3 text-lg text-neutral-700">📝 {str(back.notes)}</p>}
            </Back>
          )}
        </>
      );

    case 'speaking':
      return (
        <>
          <Front prompt="Escúchate: ¿cómo fue tu fluidez? Fíjate en muletillas, pronunciación y ritmo.">
            <p className="text-4xl font-semibold tracking-tight">{str(front.title)}</p>
            <p className="mt-2 text-neutral-500">{formatSeconds(Number(front.duration_seconds ?? 0))}</p>
            <div className="mt-6 flex justify-center">
              <AudioPlayer speakingId={card.item_id} title={str(front.title)} />
            </div>
          </Front>
          {flipped && (
            <Back>
              <p className="text-lg text-neutral-700">Califica tu fluidez: 1 si te costó mucho, 4 si sonaste natural.</p>
            </Back>
          )}
        </>
      );

    case 'writing':
      return (
        <>
          <Front prompt="Vuelve a leer tu texto: ¿lo escribirías mejor hoy?">
            <p className="text-4xl font-semibold tracking-tight">{str(front.title)}</p>
          </Front>
          {flipped && (
            <Back>
              <p className="mx-auto max-w-2xl text-left font-serif text-lg leading-relaxed whitespace-pre-wrap text-neutral-900">{str(back.content)}</p>
              <a
                href={`/writing?id=${card.item_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
              >
                Añadir una versión corregida <ExternalLink size={14} aria-hidden /><span className="sr-only">(se abre en otra pestaña)</span>
              </a>
            </Back>
          )}
        </>
      );

    case 'listening':
      return (
        <>
          <Front prompt="Vuelve a escucharlo: ¿entiendes ahora lo que antes se te escapaba?">
            <p className="text-4xl font-semibold tracking-tight">{str(front.title)}</p>
            <a
              href={str(front.open_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              <ExternalLink size={16} aria-hidden /> Escuchar<span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          </Front>
          {flipped && (
            <Back>
              <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Tu transcripción</p>
              <p className="mx-auto mt-2 max-w-2xl text-lg leading-relaxed whitespace-pre-wrap text-neutral-900">{str(back.transcription)}</p>
            </Back>
          )}
        </>
      );
  }
}

function Front({ prompt, children }: { prompt: string; children: React.ReactNode }) {
  return (
    <section aria-label="Anverso" className="text-center">
      <p className="mb-6 text-sm text-neutral-500">{prompt}</p>
      {children}
    </section>
  );
}

function Back({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="Reverso" className="mt-10 border-t border-neutral-200 pt-10 text-center">
      {children}
    </section>
  );
}

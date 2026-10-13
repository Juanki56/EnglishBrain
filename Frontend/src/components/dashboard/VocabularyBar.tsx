import { Link } from 'react-router';
import type { Overview } from './types';

const SEGMENTS = [
  { key: 'learning', label: 'Learning', className: 'bg-learning' },
  { key: 'reviewing', label: 'Reviewing', className: 'bg-reviewing' },
  { key: 'mastered', label: 'Mastered', className: 'bg-mastered' },
] as const;

/**
 * Contador general de vocabulario (spec dashboard): total de términos curados
 * y barra segmentada roja / amarilla / verde. Los pendientes del Inbox no cuentan.
 */
export function VocabularyBar({ vocabulary }: { vocabulary: Overview['vocabulary'] }) {
  const { total, pending_curation: pending } = vocabulary;
  const share = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums tracking-tight" data-testid="vocabulary-total">{total}</span>
        <span className="text-sm text-neutral-600">{total === 1 ? 'término curado' : 'términos curados'}</span>
      </p>

      <div
        role="img"
        aria-label={SEGMENTS.map((s) => `${s.label} ${share(vocabulary[s.key])} %`).join(', ')}
        className="flex h-3 overflow-hidden rounded-full bg-neutral-100"
      >
        {SEGMENTS.map((s) =>
          vocabulary[s.key] > 0 ? (
            <span key={s.key} data-segment={s.key} className={`h-full ${s.className}`} style={{ width: `${share(vocabulary[s.key])}%` }} />
          ) : null,
        )}
      </div>

      <ul className="grid grid-cols-3 gap-2 text-xs">
        {SEGMENTS.map((s) => (
          <li key={s.key} className="flex flex-col">
            <span className="flex items-center gap-1.5 text-neutral-600">
              <span className={`size-2 rounded-full ${s.className}`} aria-hidden />
              {s.label}
            </span>
            <span className="text-sm font-medium tabular-nums text-neutral-900">
              {vocabulary[s.key]} <span className="font-normal text-neutral-500">· {share(vocabulary[s.key])} %</span>
            </span>
          </li>
        ))}
      </ul>

      {pending > 0 && (
        <Link to="/inbox" className="text-sm font-medium text-brand-600 hover:underline">
          {pending === 1 ? '1 palabra por curar en el Inbox' : `${pending} palabras por curar en el Inbox`}
        </Link>
      )}
    </div>
  );
}

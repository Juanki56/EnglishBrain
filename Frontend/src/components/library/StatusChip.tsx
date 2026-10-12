import type { VocabularyStatus } from '../../lib/vocabulary';

const STYLES: Record<VocabularyStatus, { label: string; className: string }> = {
  pending_curation: { label: 'Por curar', className: 'bg-neutral-100 text-neutral-700' },
  learning: { label: 'Learning', className: 'bg-red-50 text-red-700' },
  reviewing: { label: 'Reviewing', className: 'bg-amber-50 text-amber-800' },
  mastered: { label: 'Mastered', className: 'bg-green-50 text-green-800' },
};

/** Estado de retención con los colores del Panel: rojo, amarillo y verde. */
export function StatusChip({ status }: { status: VocabularyStatus }) {
  const style = STYLES[status];
  const dot = { pending_curation: 'bg-neutral-400', learning: 'bg-learning', reviewing: 'bg-reviewing', mastered: 'bg-mastered' }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}>
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden />
      {style.label}
    </span>
  );
}

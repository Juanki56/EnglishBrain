import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useResource } from '../../hooks/useResource';
import type { Page, VocabularyItem } from '../../lib/vocabulary';
import { EditWordModal } from '../library/EditWordModal';
import { StatusChip } from '../library/StatusChip';
import { DashboardCard } from './DashboardCard';

export const RECENT_LIMIT = 5;

/**
 * Historial reciente (spec dashboard): los 5 últimos términos añadidos a mano,
 * del más reciente al más antiguo. Un clic abre la edición sin salir del Panel.
 */
export function RecentWords() {
  const { data, setData, error, loading, reload } = useResource<Page<VocabularyItem>>('/api/vocabulary', {
    source: 'manual',
    limit: RECENT_LIMIT,
  });
  const [editing, setEditing] = useState<VocabularyItem | null>(null);

  function saved(item: VocabularyItem) {
    setData((page) => page && { ...page, items: page.items.map((w) => (w.id === item.id ? item : w)) });
    setEditing(null);
  }

  return (
    <DashboardCard
      title="Añadidas a mano"
      loading={loading}
      error={error}
      onRetry={reload}
      action={<Link to="/words/new" className="text-xs font-medium text-brand-600 hover:underline">Nueva palabra</Link>}
    >
      {data && data.items.length === 0 ? (
        <p className="text-sm text-neutral-600">Aún no has añadido palabras a mano. Las que crees en «Nueva palabra» aparecerán aquí.</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {data?.items.map((word) => (
            <li key={word.id}>
              <button
                type="button"
                onClick={() => setEditing(word)}
                aria-label={`Editar «${word.word}»`}
                className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-900">{word.word}</span>
                  <span className="block truncate text-xs text-neutral-500">{word.translation}</span>
                </span>
                <StatusChip status={word.status} />
                <Pencil size={14} className="text-neutral-400 group-hover:text-neutral-700" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && <EditWordModal item={editing} onClose={() => setEditing(null)} onSaved={saved} />}
    </DashboardCard>
  );
}

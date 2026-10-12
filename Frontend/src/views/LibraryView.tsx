import { AlertTriangle, BookText, ExternalLink, Headphones, Library, Mic, PenLine, Pencil, Search, Trash2 } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EditWordModal } from '../components/library/EditWordModal';
import { StatusChip } from '../components/library/StatusChip';
import { AudioPlayer } from '../components/speaking/AudioPlayer';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { SrsToggle } from '../components/ui/SrsToggle';
import { type Column, Table } from '../components/ui/Table';
import { useApi } from '../hooks/useApi';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { formatSeconds } from '../hooks/useRecorder';
import { useToast } from '../hooks/useToast';
import { generalMessage } from '../lib/api';
import { formatTimestamp } from '../lib/text';
import { domainOf, TYPE_OPTIONS, typeLabel, type VocabularyItem } from '../lib/vocabulary';

/**
 * Biblioteca (spec study-library): todos los registros por categoría, con
 * búsqueda, filtros y el interruptor del Modo Archivo en cada fila.
 * La pestaña y los filtros van en la URL (?tab=writing&srs=archived…).
 */
type TabKey = 'vocabulary' | 'errors' | 'speaking' | 'writing' | 'listening';
type SrsFilter = '' | 'active' | 'archived';

// Filas tal como las devuelven los listados del Backend (campos usados aquí).
type Row = { id: string; is_active_srs: boolean; created_at: string } & Record<string, unknown>;

interface TabConfig {
  key: TabKey;
  label: string;
  icon: ReactNode;
  /** Ruta del listado y del borrado (DELETE ruta/:id). */
  path: string;
  /** Texto que identifica la fila en botones y avisos. */
  name: (row: Row) => string;
  /** Columnas propias de la categoría (antes de "Repasos" y las acciones). */
  columns: Column<Row>[];
  /** Enlace a la pantalla de la sección para ver o editar el registro. */
  openHref?: (row: Row) => string;
  searchHint: string;
  empty: string;
}

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
const date = (row: Row) => dateFormat.format(new Date(row.created_at));
const text = (row: Row, key: string) => String(row[key] ?? '');
const PAGE_SIZE = 50;

/** Parámetros del listado; tipo y estado solo existen en vocabulario. */
const listQuery = (tab: TabKey, f: { q: string; srs: SrsFilter; type: string; status: string }, offset: number) => ({
  q: f.q,
  srs: f.srs || undefined,
  type: tab === 'vocabulary' ? f.type || undefined : undefined,
  status: tab === 'vocabulary' ? f.status || undefined : undefined,
  limit: PAGE_SIZE,
  offset,
});

const TABS: TabConfig[] = [
  {
    key: 'vocabulary', label: 'Vocabulario', icon: <BookText size={16} aria-hidden />, path: '/api/vocabulary',
    name: (r) => text(r, 'word'), searchHint: 'Buscar palabra, contexto o traducción…', empty: 'No hay palabras con estos filtros.',
    columns: [
      { key: 'word', header: 'Palabra', render: (r) => (
        <div>
          <p className="font-medium text-neutral-900">{text(r, 'word')}</p>
          <p className="text-xs text-neutral-500">{typeLabel(r.type as VocabularyItem['type'])}</p>
        </div>
      ) },
      { key: 'translation', header: 'Traducción', render: (r) =>
        r.translation ? text(r, 'translation') : <Link to="/inbox" className="text-sm font-medium text-brand-600 hover:underline">Curar en el Inbox</Link> },
      { key: 'status', header: 'Estado', render: (r) => <StatusChip status={r.status as VocabularyItem['status']} /> },
    ],
  },
  {
    key: 'errors', label: 'Errores', icon: <AlertTriangle size={16} aria-hidden />, path: '/api/errors',
    name: (r) => text(r, 'incorrect_phrase'), openHref: () => '/errors', searchHint: 'Buscar frase o nota…', empty: 'No hay errores con estos filtros.',
    columns: [
      { key: 'incorrect_phrase', header: 'Lo que dije', render: (r) => <span className="line-through decoration-red-400/70">{text(r, 'incorrect_phrase')}</span> },
      { key: 'correct_phrase', header: 'Cómo se dice', render: (r) => <span className="font-medium text-brand-900">{text(r, 'correct_phrase')}</span> },
      { key: 'is_resolved', header: 'Estado', render: (r) => (r.is_resolved ? 'Superado' : 'Activo') },
    ],
  },
  {
    key: 'speaking', label: 'Speaking', icon: <Mic size={16} aria-hidden />, path: '/api/speaking',
    name: (r) => text(r, 'title'), openHref: () => '/speaking', searchHint: 'Buscar por título…', empty: 'No hay monólogos con estos filtros.',
    columns: [
      { key: 'title', header: 'Título', render: (r) => <span className="font-medium">{text(r, 'title')}</span> },
      { key: 'duration_seconds', header: 'Duración', render: (r) => formatSeconds(Number(r.duration_seconds)) },
      { key: 'created_at', header: 'Grabado', render: date },
      { key: 'listen', header: 'Audio', render: (r) => <AudioPlayer speakingId={r.id} title={text(r, 'title')} /> },
    ],
  },
  {
    key: 'writing', label: 'Writing', icon: <PenLine size={16} aria-hidden />, path: '/api/writing',
    name: (r) => text(r, 'title'), openHref: (r) => `/writing?id=${r.id}`, searchHint: 'Buscar por título…', empty: 'No hay textos con estos filtros.',
    columns: [
      { key: 'title', header: 'Título', render: (r) => (
        <div className="max-w-md">
          <p className="font-medium">{text(r, 'title')}</p>
          <p className="truncate text-xs text-neutral-500">{text(r, 'excerpt')}</p>
        </div>
      ) },
      { key: 'version_count', header: 'Versiones' },
      { key: 'created_at', header: 'Empezado', render: date },
    ],
  },
  {
    key: 'listening', label: 'Listening', icon: <Headphones size={16} aria-hidden />, path: '/api/listening',
    name: (r) => text(r, 'title'), openHref: () => '/listening', searchHint: 'Buscar en título o transcripción…', empty: 'No hay retos con estos filtros.',
    columns: [
      { key: 'title', header: 'Título', render: (r) => <span className="font-medium">{text(r, 'title')}</span> },
      { key: 'url', header: 'Origen', render: (r) => (
        <a href={text(r, 'open_url')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
          {domainOf(text(r, 'url')) ?? 'enlace'}{r.start_seconds != null && ` · ${formatTimestamp(Number(r.start_seconds))}`}
          <ExternalLink size={12} aria-hidden /><span className="sr-only">(se abre en otra pestaña)</span>
        </a>
      ) },
      { key: 'created_at', header: 'Guardado', render: date },
    ],
  },
];

const SRS_FILTERS: Array<{ value: SrsFilter; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'active', label: 'En repasos' },
  { value: 'archived', label: 'Archivo' },
];

export function LibraryView() {
  const api = useApi();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get('tab')) ?? TABS[0]!;
  const srs = (params.get('srs') ?? '') as SrsFilter;
  const type = params.get('type') ?? '';
  const status = params.get('status') ?? '';
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim());

  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [editing, setEditing] = useState<VocabularyItem | null>(null);

  const isVocabulary = tab.key === 'vocabulary';

  useEffect(() => {
    let current = true;
    setRows(null);
    setLoadError('');
    api
      .get<{ items: Row[]; total: number }>(tab.path, { query: listQuery(tab.key, { q, srs, type, status }, 0) })
      .then((page) => {
        if (!current) return;
        setRows(page.items);
        setTotal(page.total);
      })
      .catch((error) => current && setLoadError(generalMessage(error)));
    return () => {
      current = false;
    };
  }, [api, tab.key, tab.path, q, srs, type, status]);

  /** Cambia un parámetro de la URL; cambiar de pestaña limpia los filtros propios de vocabulario. */
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'tab') {
      next.delete('type');
      next.delete('status');
    }
    setParams(next, { replace: key !== 'tab' });
  }

  async function loadMore() {
    if (!rows) return;
    setLoadingMore(true);
    try {
      const page = await api.get<{ items: Row[]; total: number }>(tab.path, { query: listQuery(tab.key, { q, srs, type, status }, rows.length) });
      setRows([...rows, ...page.items]);
      setTotal(page.total);
    } catch (error) {
      toast.show(generalMessage(error), { variant: 'error' });
    } finally {
      setLoadingMore(false);
    }
  }

  /** Interruptor del Modo Archivo: cambia al instante y se revierte si el Backend falla. */
  async function toggleSrs(row: Row, active: boolean) {
    const setActive = (value: boolean) =>
      setRows((list) => list?.map((r) => (r.id === row.id ? { ...r, is_active_srs: value } : r)) ?? list);
    setActive(active);
    try {
      await api.patch(`/api/items/${tab.key}/${row.id}/srs-toggle`, { is_active_srs: active });
      toast.show(active ? `«${tab.name(row)}» vuelve a tus repasos` : `«${tab.name(row)}» archivado: no aparecerá en los repasos`);
    } catch (error) {
      setActive(!active);
      toast.show(`No se pudo cambiar: ${generalMessage(error)}`, { variant: 'error' });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api.delete(`${tab.path}/${deleting.id}`);
      toast.show(`«${tab.name(deleting)}» borrado`);
      setRows((list) => list?.filter((r) => r.id !== deleting.id) ?? list);
      setTotal((n) => n - 1);
    } catch (error) {
      toast.show(generalMessage(error), { variant: 'error' });
    } finally {
      setDeleting(null);
    }
  }

  const columns: Column<Row>[] = [
    ...tab.columns,
    {
      key: 'srs', header: 'Repasos', render: (r) => (
        <SrsToggle compact checked={r.is_active_srs} onChange={(value) => void toggleSrs(r, value)} label={`Repasos de «${tab.name(r)}»`} />
      ),
    },
    {
      key: 'actions', header: '', className: 'text-right', render: (r) => (
        <div className="flex justify-end gap-1">
          {isVocabulary && (
            <Button size="sm" variant="ghost" aria-label={`Editar «${tab.name(r)}»`} icon={<Pencil size={14} aria-hidden />}
              onClick={() => setEditing(r as unknown as VocabularyItem)} />
          )}
          {tab.openHref && (
            <Link
              to={tab.openHref(r)}
              aria-label={`Abrir «${tab.name(r)}»`}
              className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              Abrir
            </Link>
          )}
          <Button size="sm" variant="ghost" aria-label={`Borrar «${tab.name(r)}»`} icon={<Trash2 size={14} aria-hidden />}
            onClick={() => setDeleting(r)} className="text-red-700 hover:bg-red-50" />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-100 text-brand-900">
          <Library size={22} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Biblioteca</h1>
          <p className="text-sm text-neutral-600">Todo lo que has guardado. Apaga «Repasos» para dejar algo solo como archivo de consulta.</p>
        </div>
      </header>

      <div role="tablist" aria-label="Categorías" className="flex gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tab.key}
            onClick={() => setParam('tab', t.key === 'vocabulary' ? '' : t.key)}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              t.key === tab.key ? 'border-brand-600 text-brand-900' : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="relative w-80">
          <span className="sr-only">Buscar en {tab.label}</span>
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab.searchHint}
            className="h-10 w-full rounded-lg border border-neutral-300 bg-white pr-3 pl-9 text-sm focus:border-brand-600 focus:outline-2 focus:outline-brand-600"
          />
        </label>
        <div role="group" aria-label="Filtrar por repasos" className="inline-flex h-10 items-center rounded-lg border border-neutral-200 bg-white p-0.5">
          {SRS_FILTERS.map((option) => (
            <button
              key={option.value || 'all'}
              type="button"
              aria-pressed={srs === option.value}
              onClick={() => setParam('srs', option.value)}
              className={`h-full rounded-md px-3 text-sm font-medium transition-colors ${
                srs === option.value ? 'bg-brand-100 text-brand-900' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {isVocabulary && (
          <>
            <div className="w-48">
              <Select label="Tipo" value={type} onChange={(e) => setParam('type', e.target.value)}
                options={[{ value: '', label: 'Todos' }, ...TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]} />
            </div>
            <div className="w-48">
              <Select label="Estado" value={status} onChange={(e) => setParam('status', e.target.value)}
                options={[
                  { value: '', label: 'Todos' },
                  { value: 'pending_curation', label: 'Por curar' },
                  { value: 'learning', label: 'Learning' },
                  { value: 'reviewing', label: 'Reviewing' },
                  { value: 'mastered', label: 'Mastered' },
                ]} />
            </div>
          </>
        )}
      </div>

      {loadError && <FormAlert>{loadError}</FormAlert>}
      {!rows && !loadError && <p className="text-sm text-neutral-500">Cargando…</p>}
      {rows && (
        <>
          <p className="text-sm text-neutral-500" aria-live="polite">{total === 1 ? '1 registro' : `${total} registros`}</p>
          <Table caption={tab.label} columns={columns} rows={rows} rowKey={(r) => r.id} emptyMessage={q || srs || type || status ? tab.empty : 'Todavía no has guardado nada aquí.'} />
          {rows.length < total && (
            <Button variant="secondary" onClick={loadMore} loading={loadingMore} className="self-center">Cargar más</Button>
          )}
        </>
      )}

      {editing && (
        <EditWordModal
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setRows((list) => list?.map((r) => (r.id === updated.id ? (updated as unknown as Row) : r)) ?? list);
            setEditing(null);
          }}
        />
      )}

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="¿Borrar este registro?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDelete}>Borrar</Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Se borrará «{deleting && tab.name(deleting)}»{tab.key === 'speaking' ? ' y su audio' : ''}{tab.key === 'writing' ? ' con todas sus versiones' : ''}. No se puede deshacer.
          {' '}Si solo quieres que deje de aparecer en los repasos, apaga «Repasos».
        </p>
      </Modal>
    </div>
  );
}

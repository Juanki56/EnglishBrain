import { AlertTriangle, Check, Pencil, RotateCcw, Search, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { ArchiveBadge } from '../components/ui/ArchiveBadge';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { Input } from '../components/ui/Input';
import { Kbd } from '../components/ui/Kbd';
import { Modal } from '../components/ui/Modal';
import { SrsToggle } from '../components/ui/SrsToggle';
import { Textarea } from '../components/ui/Textarea';
import { useApi } from '../hooks/useApi';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useHotkeys } from '../hooks/useHotkeys';
import { useToast } from '../hooks/useToast';
import { fieldErrors, generalMessage } from '../lib/api';

/** Error fosilizado tal como lo devuelve /api/errors. */
export interface FossilizedError {
  id: string;
  incorrect_phrase: string;
  correct_phrase: string;
  notes: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  is_active_srs: boolean;
  created_at: string;
}

type Filter = 'active' | 'resolved' | 'all';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'active', label: 'Activos' },
  { value: 'resolved', label: 'Superados' },
  { value: 'all', label: 'Todos' },
];

const PAGE_SIZE = 50;

const errorsQuery = (filter: Filter, q: string, offset: number) => ({
  status: filter === 'all' ? undefined : filter,
  q,
  limit: PAGE_SIZE,
  offset,
});
const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Muro de Errores Fosilizados (spec fossilized-errors): registro manual a dos
 * columnas (frase incorrecta | frase correcta nativa) con nota, y el muro con
 * filtro activos / superados.
 */
export function ErrorsView() {
  const api = useApi();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim());
  const [items, setItems] = useState<FossilizedError[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [editing, setEditing] = useState<FossilizedError | null>(null);
  const [deleting, setDeleting] = useState<FossilizedError | null>(null);

  useEffect(() => {
    let current = true;
    setItems(null);
    setLoadError('');
    api
      .get<{ items: FossilizedError[]; total: number }>('/api/errors', { query: errorsQuery(filter, q, 0) })
      .then((page) => {
        if (!current) return;
        setItems(page.items);
        setTotal(page.total);
      })
      .catch((error) => current && setLoadError(generalMessage(error)));
    return () => {
      current = false;
    };
  }, [api, filter, q]);

  async function loadMore() {
    if (!items) return;
    setLoadingMore(true);
    try {
      const page = await api.get<{ items: FossilizedError[]; total: number }>('/api/errors', { query: errorsQuery(filter, q, items.length) });
      setItems([...items, ...page.items]);
      setTotal(page.total);
    } catch (error) {
      toast.show(generalMessage(error), { variant: 'error' });
    } finally {
      setLoadingMore(false);
    }
  }

  /** ¿Debe verse este error con el filtro actual? */
  const fitsFilter = (error: FossilizedError) =>
    filter === 'all' || (filter === 'active' ? !error.is_resolved : error.is_resolved);

  function onCreated(created: FossilizedError) {
    if (filter !== 'resolved' && !q) {
      setItems((list) => (list ? [created, ...list] : [created]));
      setTotal((n) => n + 1);
    }
  }

  /** Actualiza un error en el muro, o lo quita si ya no encaja en el filtro (p. ej. superado en "Activos"). */
  function replace(updated: FossilizedError) {
    if (!items) return;
    if (fitsFilter(updated)) {
      setItems(items.map((e) => (e.id === updated.id ? updated : e)));
    } else {
      setItems(items.filter((e) => e.id !== updated.id));
      setTotal((n) => n - 1);
    }
  }

  async function toggleResolved(error: FossilizedError) {
    try {
      const updated = await api.patch<FossilizedError>(`/api/errors/${error.id}`, { is_resolved: !error.is_resolved });
      toast.show(updated.is_resolved ? '¡Error superado! Sigue en tus repasos mientras lo tengas activo.' : 'El error vuelve a estar activo');
      replace(updated);
    } catch (err) {
      toast.show(generalMessage(err), { variant: 'error' });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api.delete(`/api/errors/${deleting.id}`);
      toast.show('Error borrado del muro');
      setItems((list) => list?.filter((e) => e.id !== deleting.id) ?? list);
      setTotal((n) => n - 1);
    } catch (err) {
      toast.show(generalMessage(err), { variant: 'error' });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-100 text-brand-900">
          <AlertTriangle size={22} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Muro de Errores</h1>
          <p className="text-sm text-neutral-600">Los errores que repites, con su forma nativa y tu regla para no volver a cometerlos.</p>
        </div>
      </header>

      <NewErrorForm onCreated={onCreated} />

      <section aria-labelledby="wall-title" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 id="wall-title" className="text-lg font-semibold">Tu muro</h2>
            <div role="group" aria-label="Filtrar errores" className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5">
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={filter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                    filter === option.value ? 'bg-brand-100 text-brand-900' : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <label className="relative w-72">
            <span className="sr-only">Buscar en el muro</span>
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar frase o nota…"
              className="h-9 w-full rounded-lg border border-neutral-300 bg-white pr-3 pl-9 text-sm focus:border-brand-600 focus:outline-2 focus:outline-brand-600"
            />
          </label>
        </div>

        {loadError && <FormAlert>{loadError}</FormAlert>}
        {!items && !loadError && <p className="text-sm text-neutral-500">Cargando tu muro…</p>}
        {items && items.length === 0 && <EmptyWall filter={filter} searching={Boolean(q)} />}

        {items && items.length > 0 && (
          <>
            <p className="text-sm text-neutral-500">{total === 1 ? '1 error' : `${total} errores`}</p>
            <ul aria-label="Errores del muro" className="flex flex-col gap-3">
              {items.map((error) => (
                <ErrorCard
                  key={error.id}
                  error={error}
                  onToggleResolved={() => toggleResolved(error)}
                  onEdit={() => setEditing(error)}
                  onDelete={() => setDeleting(error)}
                />
              ))}
            </ul>
            {items.length < total && (
              <Button variant="secondary" onClick={loadMore} loading={loadingMore} className="self-center">
                Cargar más
              </Button>
            )}
          </>
        )}
      </section>

      {editing && <EditErrorModal error={editing} onClose={() => setEditing(null)} onSaved={(updated) => { replace(updated); setEditing(null); }} />}

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="¿Borrar este error?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDelete}>Borrar</Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Se borrará «{deleting?.incorrect_phrase}» del muro y de tus repasos. Si ya lo dominas, mejor márcalo como superado.
        </p>
      </Modal>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Formulario de registro a dos columnas
// -----------------------------------------------------------------------------

function NewErrorForm({ onCreated }: { onCreated: (error: FossilizedError) => void }) {
  const api = useApi();
  const toast = useToast();
  const incorrectRef = useRef<HTMLInputElement>(null);
  const [incorrect, setIncorrect] = useState('');
  const [correct, setCorrect] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (saving) return;
    const nextErrors: Record<string, string> = {};
    if (!incorrect.trim()) nextErrors.incorrect_phrase = 'La frase incorrecta es obligatoria';
    if (!correct.trim()) nextErrors.correct_phrase = 'La frase correcta es obligatoria';
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const created = await api.post<FossilizedError>('/api/errors', {
        incorrect_phrase: incorrect.trim(),
        correct_phrase: correct.trim(),
        notes: notes.trim() || null,
        is_active_srs: active,
      });
      toast.show('Error añadido al muro');
      onCreated(created);
      setIncorrect('');
      setCorrect('');
      setNotes('');
      incorrectRef.current?.focus();
    } catch (error) {
      const byField = fieldErrors(error);
      setErrors(byField);
      if (!Object.keys(byField).length) setFormError(generalMessage(error));
    } finally {
      setSaving(false);
    }
  }

  useHotkeys(
    { 'ctrl+Enter': () => void save(), 'meta+Enter': () => void save() },
    { allowInInputs: ['ctrl+Enter', 'meta+Enter'] },
  );

  return (
    <form onSubmit={save} noValidate aria-label="Registrar un error" className="flex flex-col gap-5 rounded-2xl border border-neutral-200 bg-white px-8 py-7">
      {formError && <FormAlert>{formError}</FormAlert>}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl bg-red-50/60 p-4">
          <Input
            ref={incorrectRef}
            label="❌ Frase incorrecta (lo que dije)"
            required
            value={incorrect}
            onChange={(e) => setIncorrect(e.target.value)}
            error={errors.incorrect_phrase}
            placeholder="I have a doubt"
          />
        </div>
        <div className="rounded-xl bg-brand-50 p-4">
          <Input
            label="✅ Frase correcta nativa"
            required
            value={correct}
            onChange={(e) => setCorrect(e.target.value)}
            error={errors.correct_phrase}
            placeholder="I have a question"
          />
        </div>
      </div>
      <Textarea
        label="Nota: tu regla para recordarlo"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        error={errors.notes}
        hint="Opcional. Por qué te equivocas, p. ej. «Dejar de traducir del español 'tener una duda'»."
      />
      <div className="flex items-end justify-between gap-6">
        <SrsToggle checked={active} onChange={setActive} />
        <Button type="submit" loading={saving} aria-keyshortcuts="Control+Enter">
          Añadir al muro
          <span className="ml-1 flex items-center gap-0.5 opacity-90" aria-hidden><Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd></span>
        </Button>
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Tarjeta de un error
// -----------------------------------------------------------------------------

function ErrorCard({
  error,
  onToggleResolved,
  onEdit,
  onDelete,
}: {
  error: FossilizedError;
  onToggleResolved: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      aria-label={error.incorrect_phrase}
      className={`overflow-hidden rounded-xl border bg-white ${error.is_resolved ? 'border-neutral-200 opacity-80' : 'border-neutral-200'}`}
    >
      <div className="grid grid-cols-2">
        <div className="bg-red-50/60 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Lo que dije</p>
          <p className="mt-1 text-base text-neutral-800 line-through decoration-red-400/70">{error.incorrect_phrase}</p>
        </div>
        <div className="bg-brand-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Cómo se dice</p>
          <p className="mt-1 text-base font-medium text-brand-900">{error.correct_phrase}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-neutral-100 px-5 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {error.notes ? <p className="truncate text-sm text-neutral-600">📝 {error.notes}</p> : <p className="text-sm text-neutral-400">Sin nota</p>}
          {error.is_resolved && error.resolved_at && (
            <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-900">
              Superado el {dateFormat.format(new Date(error.resolved_at))}
            </span>
          )}
          {!error.is_active_srs && <span className="shrink-0"><ArchiveBadge /></span>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant={error.is_resolved ? 'secondary' : 'primary'} onClick={onToggleResolved}
            icon={error.is_resolved ? <RotateCcw size={14} aria-hidden /> : <Check size={14} aria-hidden />}>
            {error.is_resolved ? 'Volver a activo' : 'Marcar como superado'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Editar «${error.incorrect_phrase}»`} icon={<Pencil size={14} aria-hidden />} />
          <Button size="sm" variant="ghost" onClick={onDelete} aria-label={`Borrar «${error.incorrect_phrase}»`} icon={<Trash2 size={14} aria-hidden />} className="text-red-700 hover:bg-red-50" />
        </div>
      </div>
    </li>
  );
}

function EmptyWall({ filter, searching }: { filter: Filter; searching: boolean }) {
  const text = searching
    ? 'Ningún error coincide con tu búsqueda.'
    : filter === 'resolved'
      ? 'Todavía no has superado ningún error. ¡Ya llegará!'
      : filter === 'active'
        ? 'No tienes errores activos. Cuando alguien te corrija, regístralo arriba.'
        : 'Tu muro está vacío. Cuando alguien te corrija, regístralo arriba.';
  return <p className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-600">{text}</p>;
}

// -----------------------------------------------------------------------------
// Edición
// -----------------------------------------------------------------------------

function EditErrorModal({ error, onClose, onSaved }: { error: FossilizedError; onClose: () => void; onSaved: (e: FossilizedError) => void }) {
  const api = useApi();
  const toast = useToast();
  const [incorrect, setIncorrect] = useState(error.incorrect_phrase);
  const [correct, setCorrect] = useState(error.correct_phrase);
  const [notes, setNotes] = useState(error.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setFormError('');
    try {
      const updated = await api.patch<FossilizedError>(`/api/errors/${error.id}`, {
        incorrect_phrase: incorrect.trim(),
        correct_phrase: correct.trim(),
        notes: notes.trim() || null,
      });
      toast.show('Error actualizado');
      onSaved(updated);
    } catch (err) {
      const byField = fieldErrors(err);
      setErrors(byField);
      if (!Object.keys(byField).length) setFormError(generalMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Editar error"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={saving}>Guardar</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        <Input label="Frase incorrecta" required value={incorrect} onChange={(e) => setIncorrect(e.target.value)} error={errors.incorrect_phrase} />
        <Input label="Frase correcta nativa" required value={correct} onChange={(e) => setCorrect(e.target.value)} error={errors.correct_phrase} />
        <Textarea label="Nota" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} error={errors.notes} />
      </div>
    </Modal>
  );
}

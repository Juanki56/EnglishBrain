import { PenLine, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArchiveBadge } from '../components/ui/ArchiveBadge';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { Input } from '../components/ui/Input';
import { Kbd } from '../components/ui/Kbd';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { SrsToggle } from '../components/ui/SrsToggle';
import { Textarea } from '../components/ui/Textarea';
import { useApi } from '../hooks/useApi';
import { useHotkeys } from '../hooks/useHotkeys';
import { useToast } from '../hooks/useToast';
import { fieldErrors, generalMessage } from '../lib/api';
import { wordCount } from '../lib/text';

interface WritingVersion {
  id: string;
  version_number: number;
  content: string;
  created_at: string;
}

interface WritingEntry {
  id: string;
  title: string;
  is_active_srs: boolean;
  created_at: string;
}

interface WritingListItem extends WritingEntry {
  version_count: number;
  latest_version_number: number;
  latest_version_at: string | null;
  excerpt: string;
}

interface WritingDetail extends WritingEntry {
  versions: WritingVersion[];
}

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Writing (spec writing-log): bitácora de textos escritos a mano con
 * historial de versiones corregidas. La versión 1 es el original y nunca se
 * modifica; la vista compara el original con la versión elegida.
 * La entrada abierta va en la URL (?id=…; ?new=1 para escribir una nueva).
 */
export function WritingView() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('id');
  const creating = params.get('new') === '1';
  const [items, setItems] = useState<WritingListItem[] | null>(null);
  const [loadError, setLoadError] = useState('');

  const loadList = useCallback(() => {
    api
      .get<{ items: WritingListItem[]; total: number }>('/api/writing', { query: { limit: 200 } })
      .then((page) => setItems(page.items))
      .catch((error) => setLoadError(generalMessage(error)));
  }, [api]);

  useEffect(loadList, [loadList]);

  const open = (id: string) => setParams({ id });
  const startNew = () => setParams({ new: '1' });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-100 text-brand-900">
            <PenLine size={22} aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Writing</h1>
            <p className="text-sm text-neutral-600">Escribe a mano y, más adelante, corrígete: verás cómo mejora tu escritura.</p>
          </div>
        </div>
        <Button icon={<Plus size={16} aria-hidden />} onClick={startNew}>Nuevo texto</Button>
      </header>

      <div className="grid grid-cols-[18rem_1fr] items-start gap-6">
        <nav aria-label="Tus textos" className="flex flex-col gap-2">
          {loadError && <FormAlert>{loadError}</FormAlert>}
          {!items && !loadError && <p className="text-sm text-neutral-500">Cargando tus textos…</p>}
          {items?.length === 0 && <p className="text-sm text-neutral-500">Todavía no has escrito ningún texto.</p>}
          {items?.map((item) => {
            const active = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => open(item.id)}
                className={[
                  'flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                  active ? 'border-brand-600 bg-brand-100' : 'border-neutral-200 bg-white hover:bg-neutral-50',
                ].join(' ')}
              >
                <span className={`truncate font-medium ${active ? 'text-brand-900' : 'text-neutral-900'}`}>{item.title}</span>
                <span className="line-clamp-2 text-sm text-neutral-600">{item.excerpt}</span>
                <span className="text-xs text-neutral-500">
                  {item.version_count === 1 ? '1 versión' : `${item.version_count} versiones`} · {dateFormat.format(new Date(item.created_at))}
                </span>
              </button>
            );
          })}
        </nav>

        <div>
          {creating ? (
            <NewEntryForm
              onCreated={(entry) => {
                loadList();
                open(entry.id);
              }}
            />
          ) : selectedId ? (
            <EntryDetail key={selectedId} id={selectedId} onChanged={loadList} onDeleted={() => { loadList(); setParams({}); }} />
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-8 py-16 text-center">
              <PenLine className="mx-auto mb-3 text-neutral-400" size={30} aria-hidden />
              <p className="font-medium text-neutral-800">Elige un texto de la lista o escribe uno nuevo</p>
              <p className="mt-1 text-sm text-neutral-600">Un párrafo, un correo de trabajo o un ensayo: escríbelo tú, sin ayuda.</p>
              <Button className="mt-5" icon={<Plus size={16} aria-hidden />} onClick={startNew}>Nuevo texto</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Nuevo texto
// -----------------------------------------------------------------------------

function NewEntryForm({ onCreated }: { onCreated: (entry: WritingDetail) => void }) {
  const api = useApi();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (saving) return;
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) nextErrors.title = 'El título es obligatorio';
    if (!content.trim()) nextErrors.content = 'El texto es obligatorio';
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const created = await api.post<WritingDetail>('/api/writing', { title: title.trim(), content, is_active_srs: active });
      toast.show(`«${created.title}» guardado`);
      onCreated(created);
    } catch (error) {
      const byField = fieldErrors(error);
      setErrors(byField);
      if (!Object.keys(byField).length) setFormError(generalMessage(error));
      setSaving(false);
    }
  }

  useHotkeys({ 'ctrl+Enter': () => void save(), 'meta+Enter': () => void save() }, { allowInInputs: ['ctrl+Enter', 'meta+Enter'] });

  return (
    <form onSubmit={save} noValidate aria-label="Nuevo texto" className="flex flex-col gap-5 rounded-2xl border border-neutral-200 bg-white px-8 py-7">
      <h2 className="text-lg font-semibold">Nuevo texto</h2>
      {formError && <FormAlert>{formError}</FormAlert>}
      <Input label="Título" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} placeholder="Email a un cliente" />
      <Textarea
        label="Tu texto"
        required
        rows={14}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        error={errors.content}
        hint={`${wordCount(content)} palabras. Escríbelo tú, sin traductor: es tu versión original.`}
        className="font-serif text-base"
      />
      <div className="flex items-end justify-between gap-6">
        <SrsToggle checked={active} onChange={setActive} />
        <Button type="submit" loading={saving} aria-keyshortcuts="Control+Enter">
          Guardar
          <span className="ml-1 flex items-center gap-0.5 opacity-90" aria-hidden><Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd></span>
        </Button>
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Detalle: comparación de versiones
// -----------------------------------------------------------------------------

function EntryDetail({ id, onChanged, onDeleted }: { id: string; onChanged: () => void; onDeleted: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [entry, setEntry] = useState<WritingDetail | null>(null);
  const [loadError, setLoadError] = useState('');
  const [compareWith, setCompareWith] = useState<number | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .get<WritingDetail>(`/api/writing/${id}`)
      .then((detail) => {
        setEntry(detail);
        setCompareWith(detail.versions.at(-1)?.version_number ?? 1);
      })
      .catch((error) => setLoadError(generalMessage(error)));
  }, [api, id]);

  if (loadError) return <FormAlert>{loadError}</FormAlert>;
  if (!entry) return <p className="text-sm text-neutral-500">Cargando el texto…</p>;

  const original = entry.versions[0];
  const latest = entry.versions.at(-1);
  const compared = entry.versions.find((v) => v.version_number === compareWith) ?? latest;

  async function confirmDelete() {
    try {
      await api.delete(`/api/writing/${id}`);
      toast.show(`«${entry!.title}» borrado`);
      onDeleted();
    } catch (error) {
      toast.show(generalMessage(error), { variant: 'error' });
      setDeleting(false);
    }
  }

  return (
    <article aria-label={entry.title} className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{entry.title}</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-neutral-500">
            {entry.versions.length === 1 ? '1 versión' : `${entry.versions.length} versiones`} · empezado el {dateFormat.format(new Date(entry.created_at))}
            {!entry.is_active_srs && <ArchiveBadge />}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button size="sm" variant="ghost" icon={<Pencil size={14} aria-hidden />} onClick={() => setRenaming(true)}>Cambiar título</Button>
          <Button size="sm" variant="ghost" icon={<Trash2 size={14} aria-hidden />} onClick={() => setDeleting(true)} className="text-red-700 hover:bg-red-50">Borrar</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <VersionPanel title="Original" version={original!} />
        {entry.versions.length > 1 ? (
          <div className="flex flex-col gap-2">
            <Select
              label="Comparar con"
              value={String(compared?.version_number)}
              onChange={(e) => setCompareWith(Number(e.target.value))}
              options={entry.versions.slice(1).map((v) => ({
                value: String(v.version_number),
                label: `Versión ${v.version_number} · ${dateTimeFormat.format(new Date(v.created_at))}${v === latest ? ' (la última)' : ''}`,
              }))}
            />
            <VersionPanel title={`Versión ${compared!.version_number}`} version={compared!} highlight />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-600">
            <p>Todavía no hay versiones corregidas.</p>
            <p className="mt-1">Cuando vuelvas a leerlo, ¿lo escribirías diferente?</p>
          </div>
        )}
      </div>

      {correcting ? (
        <CorrectionForm
          entryId={id}
          initial={latest?.content ?? ''}
          onCancel={() => setCorrecting(false)}
          onSaved={(version) => {
            setEntry({ ...entry, versions: [...entry.versions, version] });
            setCompareWith(version.version_number);
            setCorrecting(false);
            onChanged();
          }}
        />
      ) : (
        <Button variant="secondary" icon={<Plus size={16} aria-hidden />} onClick={() => setCorrecting(true)} className="self-start">
          Añadir versión corregida
        </Button>
      )}

      {renaming && (
        <RenameModal
          entry={entry}
          onClose={() => setRenaming(false)}
          onSaved={(title) => {
            setEntry({ ...entry, title });
            setRenaming(false);
            onChanged();
          }}
        />
      )}

      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        title="¿Borrar este texto?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(false)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDelete}>Borrar</Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">Se borrará «{entry.title}» con todas sus versiones. No se puede deshacer.</p>
      </Modal>
    </article>
  );
}

function VersionPanel({ title, version, highlight = false }: { title: string; version: WritingVersion; highlight?: boolean }) {
  return (
    <section
      aria-label={title}
      className={`flex min-h-64 flex-col rounded-xl border px-5 py-4 ${highlight ? 'border-brand-200 bg-brand-50' : 'border-neutral-200 bg-white'}`}
    >
      <header className="mb-3 flex items-baseline justify-between gap-3 text-xs text-neutral-500">
        <span className={`font-semibold uppercase tracking-wide ${highlight ? 'text-brand-700' : 'text-neutral-600'}`}>{title}</span>
        <span>{dateTimeFormat.format(new Date(version.created_at))} · {wordCount(version.content)} palabras</span>
      </header>
      <p className="font-serif text-base leading-relaxed whitespace-pre-wrap text-neutral-900">{version.content}</p>
    </section>
  );
}

function CorrectionForm({
  entryId,
  initial,
  onCancel,
  onSaved,
}: {
  entryId: string;
  initial: string;
  onCancel: () => void;
  onSaved: (version: WritingVersion) => void;
}) {
  const api = useApi();
  const toast = useToast();
  const [content, setContent] = useState(initial);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (saving) return;
    if (!content.trim()) {
      setError('El texto es obligatorio');
      return;
    }
    if (content.trim() === initial.trim()) {
      setError('Cambia algo del texto para guardar una versión nueva');
      return;
    }
    setSaving(true);
    try {
      const version = await api.post<WritingVersion>(`/api/writing/${entryId}/versions`, { content });
      toast.show(`Versión ${version.version_number} guardada`);
      onSaved(version);
    } catch (err) {
      setError(fieldErrors(err).content ?? generalMessage(err));
      setSaving(false);
    }
  }

  useHotkeys({ 'ctrl+Enter': () => void save(), 'meta+Enter': () => void save() }, { allowInInputs: ['ctrl+Enter', 'meta+Enter'] });

  return (
    <form onSubmit={save} noValidate aria-label="Nueva versión corregida" className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white px-6 py-5">
      <Textarea
        label="Versión corregida"
        required
        autoFocus
        rows={12}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        error={error}
        hint="Parte de tu última versión: corrige lo que hoy escribirías mejor. Las versiones anteriores no se modifican."
        className="font-serif text-base"
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={saving} aria-keyshortcuts="Control+Enter">
          Guardar versión
          <span className="ml-1 flex items-center gap-0.5 opacity-90" aria-hidden><Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd></span>
        </Button>
      </div>
    </form>
  );
}

function RenameModal({ entry, onClose, onSaved }: { entry: WritingDetail; onClose: () => void; onSaved: (title: string) => void }) {
  const api = useApi();
  const toast = useToast();
  const [title, setTitle] = useState(entry.title);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) {
      setError('El título es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.patch<WritingEntry>(`/api/writing/${entry.id}`, { title: title.trim() });
      toast.show('Título cambiado');
      onSaved(updated.title);
    } catch (err) {
      setError(fieldErrors(err).title ?? generalMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Cambiar título"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={saving}>Guardar</Button>
        </>
      }
    >
      <Input label="Título" required value={title} onChange={(e) => setTitle(e.target.value)} error={error} />
    </Modal>
  );
}

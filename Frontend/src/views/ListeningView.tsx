import { ExternalLink, Headphones, Pencil, Search, Trash2 } from 'lucide-react';
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
import { formatTimestamp, parseTimestamp } from '../lib/text';
import { domainOf } from '../lib/vocabulary';

export interface ListeningEntry {
  id: string;
  title: string;
  url: string;
  start_seconds: number | null;
  transcription: string;
  is_active_srs: boolean;
  created_at: string;
  open_url: string;
}

interface ChallengeFields {
  title: string;
  url: string;
  start: string;
  transcription: string;
}

const EMPTY: ChallengeFields = { title: '', url: '', start: '', transcription: '' };
const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });

/** Valida en el navegador y devuelve el cuerpo para la API, o los errores por campo. */
function toPayload(fields: ChallengeFields): { body?: Record<string, unknown>; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!fields.title.trim()) errors.title = 'El título es obligatorio';
  if (!fields.url.trim()) errors.url = 'La URL es obligatoria';
  else if (!/^https?:\/\/\S+$/i.test(fields.url.trim())) errors.url = 'La URL debe empezar por http:// o https://';
  if (!fields.transcription.trim()) errors.transcription = 'La transcripción es obligatoria';
  const start = parseTimestamp(fields.start);
  if (start === undefined) errors.start_seconds = 'Escribe el inicio como 1:32 (minutos:segundos) o en segundos';
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    body: { title: fields.title.trim(), url: fields.url.trim(), start_seconds: start, transcription: fields.transcription.trim() },
  };
}

/**
 * Listening (spec listening-log): retos de escucha con enlace, inicio
 * opcional y transcripción manual. "Escuchar" abre el recurso en una pestaña
 * nueva, en el segundo indicado cuando es YouTube.
 */
export function ListeningView() {
  const api = useApi();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim());
  const [items, setItems] = useState<ListeningEntry[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<ListeningEntry | null>(null);
  const [deleting, setDeleting] = useState<ListeningEntry | null>(null);

  useEffect(() => {
    let current = true;
    api
      .get<{ items: ListeningEntry[]; total: number }>('/api/listening', { query: { q, limit: 200 } })
      .then((page) => current && setItems(page.items))
      .catch((error) => current && setLoadError(generalMessage(error)));
    return () => {
      current = false;
    };
  }, [api, q]);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api.delete(`/api/listening/${deleting.id}`);
      toast.show(`«${deleting.title}» borrado`);
      setItems((list) => list?.filter((item) => item.id !== deleting.id) ?? list);
    } catch (error) {
      toast.show(generalMessage(error), { variant: 'error' });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-100 text-brand-900">
          <Headphones size={22} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Listening</h1>
          <p className="text-sm text-neutral-600">Guarda el fragmento que te costó entender y lo que lograste captar. Al repasarlo, comprobarás si tu oído mejoró.</p>
        </div>
      </header>

      <NewChallengeForm onCreated={(entry) => setItems((list) => [entry, ...(list ?? [])])} />

      <section aria-labelledby="challenges-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 id="challenges-title" className="text-lg font-semibold">Tus retos</h2>
          <label className="relative w-72">
            <span className="sr-only">Buscar retos</span>
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en título o transcripción…"
              className="h-9 w-full rounded-lg border border-neutral-300 bg-white pr-3 pl-9 text-sm focus:border-brand-600 focus:outline-2 focus:outline-brand-600"
            />
          </label>
        </div>

        {loadError && <FormAlert>{loadError}</FormAlert>}
        {!items && !loadError && <p className="text-sm text-neutral-500">Cargando tus retos…</p>}
        {items?.length === 0 && (
          <p className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-600">
            {q ? 'Ningún reto coincide con tu búsqueda.' : 'Aún no tienes retos de escucha. Añade arriba el primer fragmento que te cueste entender.'}
          </p>
        )}
        {items && items.length > 0 && (
          <ul aria-label="Retos de escucha" className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id} aria-label={item.title} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900">{item.title}</p>
                    <p className="text-sm text-neutral-500">
                      {domainOf(item.url) ?? item.url}
                      {item.start_seconds !== null && ` · desde ${formatTimestamp(item.start_seconds)}`} · {dateFormat.format(new Date(item.created_at))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!item.is_active_srs && <ArchiveBadge />}
                    <a
                      href={item.open_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Escuchar «${item.title}» (se abre en otra pestaña)`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
                    >
                      <ExternalLink size={14} aria-hidden /> Escuchar
                    </a>
                    <Button size="sm" variant="ghost" aria-label={`Editar «${item.title}»`} icon={<Pencil size={14} aria-hidden />} onClick={() => setEditing(item)} />
                    <Button size="sm" variant="ghost" aria-label={`Borrar «${item.title}»`} icon={<Trash2 size={14} aria-hidden />} onClick={() => setDeleting(item)} className="text-red-700 hover:bg-red-50" />
                  </div>
                </div>
                <blockquote className="rounded-lg bg-neutral-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-neutral-800">
                  {item.transcription}
                </blockquote>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <EditChallengeModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setItems((list) => list?.map((item) => (item.id === updated.id ? updated : item)) ?? list);
            setEditing(null);
          }}
        />
      )}

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="¿Borrar este reto?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDelete}>Borrar</Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">Se borrará «{deleting?.title}» con su transcripción. No se puede deshacer.</p>
      </Modal>
    </div>
  );
}

function ChallengeFieldsForm({
  fields,
  setFields,
  errors,
}: {
  fields: ChallengeFields;
  setFields: (fields: ChallengeFields) => void;
  errors: Record<string, string>;
}) {
  const set = (key: keyof ChallengeFields) => (e: { target: { value: string } }) => setFields({ ...fields, [key]: e.target.value });
  return (
    <>
      <div className="grid grid-cols-[1fr_1fr_10rem] gap-4">
        <Input label="Título" required value={fields.title} onChange={set('title')} error={errors.title} placeholder="BBC 6 Minute English" />
        <Input label="Enlace" required type="url" value={fields.url} onChange={set('url')} error={errors.url} placeholder="https://www.youtube.com/watch?v=…" />
        <Input label="Empieza en" value={fields.start} onChange={set('start')} error={errors.start_seconds} placeholder="1:32" hint="Opcional." />
      </div>
      <Textarea
        label="Tu transcripción"
        required
        rows={4}
        value={fields.transcription}
        onChange={set('transcription')}
        error={errors.transcription}
        hint="Escribe lo que lograste entender, aunque tenga huecos."
      />
    </>
  );
}

function NewChallengeForm({ onCreated }: { onCreated: (entry: ListeningEntry) => void }) {
  const api = useApi();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState<ChallengeFields>(EMPTY);
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (saving) return;
    const { body, errors: nextErrors } = toPayload(fields);
    setErrors(nextErrors);
    setFormError('');
    if (!body) return;

    setSaving(true);
    try {
      const created = await api.post<ListeningEntry>('/api/listening', { ...body, is_active_srs: active });
      toast.show(`Reto «${created.title}» guardado`);
      onCreated(created);
      setFields(EMPTY);
      formRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    } catch (error) {
      const byField = fieldErrors(error);
      setErrors(byField);
      if (!Object.keys(byField).length) setFormError(generalMessage(error));
    } finally {
      setSaving(false);
    }
  }

  useHotkeys({ 'ctrl+Enter': () => void save(), 'meta+Enter': () => void save() }, { allowInInputs: ['ctrl+Enter', 'meta+Enter'] });

  return (
    <form ref={formRef} onSubmit={save} noValidate aria-label="Nuevo reto de escucha" className="flex flex-col gap-5 rounded-2xl border border-neutral-200 bg-white px-8 py-7">
      {formError && <FormAlert>{formError}</FormAlert>}
      <ChallengeFieldsForm fields={fields} setFields={setFields} errors={errors} />
      <div className="flex items-end justify-between gap-6">
        <SrsToggle checked={active} onChange={setActive} />
        <Button type="submit" loading={saving} aria-keyshortcuts="Control+Enter">
          Guardar reto
          <span className="ml-1 flex items-center gap-0.5 opacity-90" aria-hidden><Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd></span>
        </Button>
      </div>
    </form>
  );
}

function EditChallengeModal({ entry, onClose, onSaved }: { entry: ListeningEntry; onClose: () => void; onSaved: (e: ListeningEntry) => void }) {
  const api = useApi();
  const toast = useToast();
  const [fields, setFields] = useState<ChallengeFields>({
    title: entry.title,
    url: entry.url,
    start: entry.start_seconds === null ? '' : formatTimestamp(entry.start_seconds),
    transcription: entry.transcription,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    const { body, errors: nextErrors } = toPayload(fields);
    setErrors(nextErrors);
    setFormError('');
    if (!body) return;
    setSaving(true);
    try {
      const updated = await api.patch<ListeningEntry>(`/api/listening/${entry.id}`, body);
      toast.show('Reto actualizado');
      onSaved(updated);
    } catch (error) {
      const byField = fieldErrors(error);
      setErrors(byField);
      if (!Object.keys(byField).length) setFormError(generalMessage(error));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Editar reto"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={saving}>Guardar</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        <ChallengeFieldsForm fields={fields} setFields={setFields} errors={errors} />
      </div>
    </Modal>
  );
}

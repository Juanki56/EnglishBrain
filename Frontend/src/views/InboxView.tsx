import { ExternalLink, Inbox, PlusCircle, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { Input } from '../components/ui/Input';
import { Kbd } from '../components/ui/Kbd';
import { Modal } from '../components/ui/Modal';
import { SrsToggle } from '../components/ui/SrsToggle';
import { Textarea } from '../components/ui/Textarea';
import { HighlightedContext } from '../components/vocabulary/HighlightedContext';
import { TypePicker } from '../components/vocabulary/TypePicker';
import { useApi } from '../hooks/useApi';
import { useHotkeys } from '../hooks/useHotkeys';
import { useToast } from '../hooks/useToast';
import { ApiError, fieldErrors, generalMessage } from '../lib/api';
import { domainOf, type Page, typeLabel, type VocabularyItem, type VocabularyType } from '../lib/vocabulary';

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Inbox (spec vocabulary-curation): las capturas de la extensión pendientes de
 * curar, del más antiguo al más reciente. Al elegir una, la pantalla se divide
 * en dos columnas; Ctrl+Enter guarda y pasa a la siguiente sin usar el ratón.
 */
export function InboxView() {
  const api = useApi();
  const [items, setItems] = useState<VocabularyItem[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Page<VocabularyItem>>('/api/vocabulary', { query: { status: 'pending_curation', limit: 200 } })
      .then((page) => {
        setItems(page.items);
        setSelectedId(page.items[0]?.id ?? null);
      })
      .catch((error) => setLoadError(generalMessage(error)));
  }, [api]);

  /** Quita una captura de la lista y selecciona la que ocupaba su lugar. */
  function removeAndAdvance(id: string) {
    if (!items) return;
    const index = items.findIndex((item) => item.id === id);
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    setSelectedId(next[Math.min(index, next.length - 1)]?.id ?? null);
  }

  const selected = items?.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-100 text-brand-900">
          <Inbox size={22} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          {items && items.length > 0 && (
            <p className="text-sm text-neutral-600">{items.length === 1 ? '1 palabra por curar' : `${items.length} palabras por curar`}</p>
          )}
        </div>
      </header>

      {loadError && <FormAlert>{loadError}</FormAlert>}
      {!items && !loadError && <p className="text-sm text-neutral-500">Cargando tus capturas…</p>}
      {items && items.length === 0 && <EmptyInbox />}

      {items && items.length > 0 && (
        <>
          <ul aria-label="Capturas por curar" className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto pr-1">
            {items.map((item) => {
              const active = item.id === selectedId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedId(item.id)}
                    className={[
                      'flex w-full flex-col rounded-lg border px-3 py-2 text-left transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                      active ? 'border-brand-600 bg-brand-100' : 'border-neutral-200 bg-white hover:bg-neutral-50',
                    ].join(' ')}
                  >
                    <span className={`truncate text-sm font-medium ${active ? 'text-brand-900' : 'text-neutral-900'}`}>{item.word}</span>
                    <span className="truncate text-xs text-neutral-500">
                      {domainOf(item.source_url) ?? 'Sin origen'} · {dateFormat.format(new Date(item.created_at))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected ? (
            <CurationPanel key={selected.id} item={selected} onDone={removeAndAdvance} />
          ) : (
            <p className="text-sm text-neutral-500">Elige una palabra de la lista para curarla.</p>
          )}
        </>
      )}
    </div>
  );
}

function EmptyInbox() {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-8 py-14 text-center">
      <Inbox className="mx-auto mb-3 text-neutral-400" size={32} aria-hidden />
      <p className="text-base font-medium text-neutral-800">No hay capturas por curar</p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-neutral-600">
        Cuando leas en inglés, selecciona una palabra y usa clic derecho → «Enviar a mi Cerebro de Inglés» (o <kbd className="font-semibold">Alt+S</kbd>).
        Aparecerá aquí con su párrafo de contexto.
      </p>
      <Link
        to="/words/new"
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
      >
        <PlusCircle size={16} aria-hidden /> Añadir una palabra a mano
      </Link>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Panel de curación a dos columnas
// -----------------------------------------------------------------------------

function CurationPanel({ item, onDone }: { item: VocabularyItem; onDone: (id: string) => void }) {
  const api = useApi();
  const toast = useToast();
  const [translation, setTranslation] = useState('');
  const [definition, setDefinition] = useState('');
  const [type, setType] = useState<VocabularyType>(item.type);
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const domain = domainOf(item.source_url);

  async function curate(event?: FormEvent) {
    event?.preventDefault();
    if (saving) return;
    setFormError('');
    if (!translation.trim()) {
      setErrors({ translation: 'La traducción es obligatoria' });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await api.patch(`/api/vocabulary/${item.id}/curate`, {
        translation: translation.trim(),
        definition: definition.trim() || null,
        type,
        is_active_srs: active,
      });
      toast.show(active ? `«${item.word}» lista para tus repasos` : `«${item.word}» guardada como archivo`);
      onDone(item.id);
    } catch (error) {
      setSaving(false);
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        toast.show(error.status === 409 ? `«${item.word}» ya estaba curada` : `«${item.word}» ya no existe`, { variant: 'info' });
        onDone(item.id);
        return;
      }
      const byField = fieldErrors(error);
      setErrors(byField);
      if (!Object.keys(byField).length) setFormError(generalMessage(error));
    }
  }

  async function discard() {
    setDiscarding(true);
    try {
      await api.delete(`/api/vocabulary/${item.id}`);
      toast.show(`Captura «${item.word}» descartada`);
      onDone(item.id);
    } catch (error) {
      setDiscarding(false);
      setConfirmDiscard(false);
      toast.show(generalMessage(error), { variant: 'error' });
    }
  }

  useHotkeys(
    { 'ctrl+Enter': () => void curate(), 'meta+Enter': () => void curate() },
    { allowInInputs: ['ctrl+Enter', 'meta+Enter'], enabled: !confirmDiscard },
  );

  return (
    <section aria-label={`Curar «${item.word}»`} className="grid grid-cols-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {/* Columna izquierda: lo capturado */}
      <div className="flex flex-col gap-5 border-r border-neutral-200 bg-neutral-50/60 px-8 py-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Palabra capturada</p>
          <h2 className="mt-1 text-4xl font-semibold tracking-tight break-words text-neutral-900">{item.word}</h2>
          <p className="mt-2 text-sm text-neutral-500">Tipo sugerido: {typeLabel(item.type)}</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Dónde la viste</p>
          {item.context_sentence ? (
            <blockquote className="rounded-xl border-l-4 border-brand-600 bg-white px-5 py-4 text-base leading-relaxed text-neutral-800">
              <HighlightedContext text={item.context_sentence} term={item.word} />
            </blockquote>
          ) : (
            <p className="text-sm text-neutral-500">Esta captura no trae párrafo de contexto.</p>
          )}
        </div>

        <div className="mt-auto flex items-center gap-2 text-sm text-neutral-600">
          {domain && item.source_url ? (
            <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700 hover:underline">
              {domain} <ExternalLink size={14} aria-hidden /><span className="sr-only">(se abre en otra pestaña)</span>
            </a>
          ) : (
            <span>Sin enlace de origen</span>
          )}
          <span aria-hidden>·</span>
          <span>capturada el {dateFormat.format(new Date(item.created_at))}</span>
        </div>
      </div>

      {/* Columna derecha: lo que rellena el usuario */}
      <form onSubmit={curate} noValidate className="flex flex-col gap-5 px-8 py-8">
        {formError && <FormAlert>{formError}</FormAlert>}
        <Input
          label="Traducción al español"
          required
          autoFocus
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          error={errors.translation}
          placeholder="afrontar algo difícil"
        />
        <Textarea
          label="Definición propia en inglés"
          rows={3}
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
          error={errors.definition}
          hint="Opcional. Explícala con tus palabras."
        />
        <TypePicker value={type} onChange={setType} error={errors.type} />
        <SrsToggle checked={active} onChange={setActive} />

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <Button variant="ghost" icon={<Trash2 size={16} aria-hidden />} onClick={() => setConfirmDiscard(true)} className="text-red-700 hover:bg-red-50">
            Descartar
          </Button>
          <Button type="submit" loading={saving} aria-keyshortcuts="Control+Enter">
            Guardar y siguiente
            <span className="ml-1 flex items-center gap-0.5 opacity-90" aria-hidden><Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd></span>
          </Button>
        </div>
      </form>

      <Modal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title={`¿Descartar «${item.word}»?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>Cancelar</Button>
            <Button variant="danger" onClick={discard} loading={discarding}>Descartar</Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">Se borrará esta captura del Inbox. No se puede deshacer.</p>
      </Modal>
    </section>
  );
}

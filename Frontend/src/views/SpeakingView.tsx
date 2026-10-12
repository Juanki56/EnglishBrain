import { Mic, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AudioPlayer } from '../components/speaking/AudioPlayer';
import { Recorder, type SpeakingEntry } from '../components/speaking/Recorder';
import { ArchiveBadge } from '../components/ui/ArchiveBadge';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { Modal } from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { formatSeconds } from '../hooks/useRecorder';
import { useToast } from '../hooks/useToast';
import { generalMessage } from '../lib/api';

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Speaking (spec speaking-log): grabar monólogos largos y volver a
 * escucharlos para auditar la propia fluidez.
 */
export function SpeakingView() {
  const api = useApi();
  const toast = useToast();
  const [items, setItems] = useState<SpeakingEntry[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [deleting, setDeleting] = useState<SpeakingEntry | null>(null);

  useEffect(() => {
    api
      .get<{ items: SpeakingEntry[]; total: number }>('/api/speaking', { query: { limit: 100 } })
      .then((page) => setItems(page.items))
      .catch((error) => setLoadError(generalMessage(error)));
  }, [api]);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api.delete(`/api/speaking/${deleting.id}`);
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
          <Mic size={22} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Speaking</h1>
          <p className="text-sm text-neutral-600">Graba un monólogo y vuelve a escucharte más adelante: notarás tus muletillas, tu pronunciación y tu ritmo.</p>
        </div>
      </header>

      <Recorder onUploaded={(entry) => setItems((list) => [entry, ...(list ?? [])])} />

      <section aria-labelledby="monologues-title" className="flex flex-col gap-3">
        <h2 id="monologues-title" className="text-lg font-semibold">Tus monólogos</h2>
        {loadError && <FormAlert>{loadError}</FormAlert>}
        {!items && !loadError && <p className="text-sm text-neutral-500">Cargando tus monólogos…</p>}
        {items && items.length === 0 && (
          <p className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-600">
            Aún no has grabado ningún monólogo. Elige una duración y pulsa «Grabar».
          </p>
        )}
        {items && items.length > 0 && (
          <ul aria-label="Monólogos guardados" className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id} aria-label={item.title} className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-neutral-900">{item.title}</p>
                  <p className="text-sm text-neutral-500">
                    {formatSeconds(item.duration_seconds)} · {dateFormat.format(new Date(item.created_at))}
                  </p>
                </div>
                {!item.is_active_srs && <ArchiveBadge />}
                <AudioPlayer speakingId={item.id} title={item.title} />
                <Button size="sm" variant="ghost" aria-label={`Borrar «${item.title}»`} icon={<Trash2 size={14} aria-hidden />} onClick={() => setDeleting(item)} className="text-red-700 hover:bg-red-50" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="¿Borrar este monólogo?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDelete}>Borrar</Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">Se borrará «{deleting?.title}» y su audio. No se puede deshacer.</p>
      </Modal>
    </div>
  );
}

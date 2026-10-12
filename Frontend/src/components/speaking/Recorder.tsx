import { Mic, Square, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';
import { formatSeconds, useRecorder } from '../../hooks/useRecorder';
import { useToast } from '../../hooks/useToast';
import { fieldErrors, generalMessage } from '../../lib/api';
import { Button } from '../ui/Button';
import { FormAlert } from '../ui/FormAlert';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SrsToggle } from '../ui/SrsToggle';
import { encodeRecordingToMp3 } from './encodeMp3';

export interface SpeakingEntry {
  id: string;
  title: string;
  duration_seconds: number;
  size_bytes: number | null;
  recording_limit_minutes: number | null;
  is_active_srs: boolean;
  due_at: string | null;
  created_at: string;
}

const LIMITS = [3, 5, 10] as const;
type Limit = (typeof LIMITS)[number];

/**
 * Grabación de un monólogo (spec speaking-log): elegir 3/5/10 min, grabar con
 * temporizador, convertir a MP3, escucharlo y decidir Subir o Descartar.
 * Nada sale del navegador hasta pulsar "Subir"; si la subida falla, el audio
 * sigue aquí para reintentar.
 */
export function Recorder({ onUploaded }: { onUploaded: (entry: SpeakingEntry) => void }) {
  const api = useApi();
  const toast = useToast();
  const [limit, setLimit] = useState<Limit>(5);
  const recorder = useRecorder({ limitSeconds: limit * 60 });
  const [mp3, setMp3] = useState<{ blob: Blob; url: string } | null>(null);
  const [encoding, setEncoding] = useState<number | null>(null);
  const [encodeError, setEncodeError] = useState('');
  const [title, setTitle] = useState('');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const { recording } = recorder;

  // Al terminar de grabar, se convierte a MP3 en el navegador.
  useEffect(() => {
    if (!recording) return;
    let current = true;
    setEncoding(0);
    setEncodeError('');
    encodeRecordingToMp3(recording.blob, (value) => current && setEncoding(value))
      .then((blob) => {
        if (current) setMp3({ blob, url: URL.createObjectURL(blob) });
      })
      .catch(() => current && setEncodeError('No se pudo preparar el audio. Vuelve a grabarlo.'))
      .finally(() => current && setEncoding(null));
    return () => {
      current = false;
    };
  }, [recording]);

  // Libera la memoria del audio de la previsualización.
  useEffect(() => () => { if (mp3) URL.revokeObjectURL(mp3.url); }, [mp3]);

  // Avisar antes de cerrar la pestaña con una grabación sin subir (spec: pérdida de pestaña).
  const unsaved = recorder.status === 'recording' || encoding !== null || mp3 !== null;
  useBeforeUnload(unsaved);

  function resetAll() {
    setMp3(null);
    setTitle('');
    setErrors({});
    setUploadError('');
    setEncodeError('');
    recorder.reset();
  }

  async function upload() {
    if (!mp3 || !recording || uploading) return;
    if (!title.trim()) {
      setErrors({ title: 'El título es obligatorio' });
      return;
    }
    setErrors({});
    setUploadError('');
    setUploading(true);
    const form = new FormData();
    form.append('audio', new File([mp3.blob], 'monologo.mp3', { type: 'audio/mpeg' }));
    form.append('title', title.trim());
    form.append('duration_seconds', String(recording.durationSeconds));
    form.append('recording_limit_minutes', String(limit));
    form.append('is_active_srs', String(active));
    try {
      const entry = await api.request<SpeakingEntry>('/api/speaking', { method: 'POST', formData: form });
      toast.show(`«${entry.title}» guardado`);
      onUploaded(entry);
      resetAll();
    } catch (error) {
      const byField = fieldErrors(error);
      setErrors(byField);
      setUploadError(Object.keys(byField).length ? 'Revisa los datos y vuelve a intentarlo.' : generalMessage(error));
    } finally {
      setUploading(false);
    }
  }

  const progress = recorder.elapsed / (limit * 60);

  return (
    <section aria-label="Grabar un monólogo" className="rounded-2xl border border-neutral-200 bg-white px-8 py-7">
      {/* 1 · Elegir duración y grabar */}
      {!recording && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-neutral-800">Duración máxima</span>
            <div role="group" aria-label="Duración máxima" className="inline-flex rounded-lg border border-neutral-200 p-0.5">
              {LIMITS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={limit === minutes}
                  disabled={recorder.status === 'recording'}
                  onClick={() => setLimit(minutes)}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                    limit === minutes ? 'bg-brand-100 text-brand-900' : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6">
            {recorder.status === 'recording' ? (
              <Button variant="danger" onClick={recorder.stop} icon={<Square size={16} aria-hidden />} className="h-12 px-6">
                Detener
              </Button>
            ) : (
              <Button
                onClick={() => void recorder.start()}
                loading={recorder.status === 'requesting'}
                disabled={recorder.status === 'unsupported'}
                icon={<Mic size={18} aria-hidden />}
                className="h-12 px-6"
              >
                Grabar
              </Button>
            )}
            <div className="flex-1">
              <div className="flex items-baseline justify-between text-sm">
                <span role="timer" aria-label="Tiempo grabado" className={`font-mono text-2xl font-semibold ${recorder.status === 'recording' ? 'text-red-600' : 'text-neutral-400'}`}>
                  {formatSeconds(recorder.elapsed)}
                </span>
                <span className="text-neutral-500">de {limit}:00</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
                <div className="h-full rounded-full bg-red-500 transition-[width]" style={{ width: `${Math.min(100, progress * 100)}%` }} />
              </div>
              {recorder.status === 'recording' && (
                <p className="mt-2 flex items-center gap-2 text-sm text-red-700">
                  <span className="size-2 animate-pulse rounded-full bg-red-600" aria-hidden /> Grabando… se detendrá sola a los {limit} minutos.
                </p>
              )}
            </div>
          </div>

          {recorder.status === 'denied' && (
            <FormAlert>
              El navegador no tiene permiso para usar el micrófono. Pulsa el icono del candado junto a la dirección,
              permite el micrófono y vuelve a pulsar «Grabar».
            </FormAlert>
          )}
          {recorder.status === 'unsupported' && <FormAlert>Este navegador no puede grabar audio. Usa Chrome o Edge actualizados.</FormAlert>}
          {recorder.status === 'error' && <FormAlert>No se pudo acceder al micrófono. Comprueba que esté conectado y vuelve a intentarlo.</FormAlert>}
        </div>
      )}

      {/* 2 · Preparando el MP3 */}
      {recording && encoding !== null && (
        <div role="status" className="flex flex-col gap-2">
          <p className="text-sm font-medium text-neutral-800">Preparando tu audio… {Math.round(encoding * 100)} %</p>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
            <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${encoding * 100}%` }} />
          </div>
        </div>
      )}
      {recording && encodeError && (
        <div className="flex flex-col gap-4">
          <FormAlert>{encodeError}</FormAlert>
          <Button variant="secondary" onClick={resetAll} className="self-start">Grabar de nuevo</Button>
        </div>
      )}

      {/* 3 · Escuchar, titular y decidir */}
      {recording && mp3 && (
        <form
          onSubmit={(e) => { e.preventDefault(); void upload(); }}
          noValidate
          className="flex flex-col gap-5"
        >
          <div className="flex items-center gap-4">
            <audio controls src={mp3.url} aria-label="Escuchar tu grabación antes de subirla" className="h-10 flex-1" />
            <span className="text-sm text-neutral-600">{formatSeconds(recording.durationSeconds)}</span>
          </div>
          <p className="text-sm text-neutral-500">El audio todavía está solo en tu navegador. Escúchalo y decide si lo subes.</p>
          {uploadError && <FormAlert>{uploadError}</FormAlert>}
          <Input
            label="Título"
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            placeholder="Mi opinión sobre la inteligencia artificial"
          />
          {(errors.audio || errors.duration_seconds) && <FormAlert>{errors.audio ?? errors.duration_seconds}</FormAlert>}
          <SrsToggle checked={active} onChange={setActive} />
          <div className="flex justify-between gap-3">
            <Button variant="ghost" onClick={() => setConfirmDiscard(true)} className="text-red-700 hover:bg-red-50">Descartar</Button>
            <Button type="submit" loading={uploading} icon={<Upload size={16} aria-hidden />}>
              {uploadError ? 'Reintentar subida' : 'Subir'}
            </Button>
          </div>
        </form>
      )}

      <Modal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="¿Descartar la grabación?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>Seguir con ella</Button>
            <Button variant="danger" onClick={() => { setConfirmDiscard(false); resetAll(); }}>Descartar</Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">Se borrará del navegador y no se guardará nada.</p>
      </Modal>
    </section>
  );
}

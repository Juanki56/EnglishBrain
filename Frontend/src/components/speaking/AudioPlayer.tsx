import { Play } from 'lucide-react';
import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { generalMessage } from '../../lib/api';
import { Button } from '../ui/Button';

/**
 * Reproductor de un monólogo guardado (design D6). El audio es privado: al
 * pulsar "Escuchar" se pide un enlace firmado de 5 minutos al Backend. Si el
 * enlace caduca, el siguiente clic pide uno nuevo.
 */
export function AudioPlayer({ speakingId, title }: { speakingId: string; title: string }) {
  const api = useApi();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const signed = await api.get<{ url: string; expires_at: string }>(`/api/speaking/${speakingId}/audio-url`);
      setUrl(signed.url);
    } catch (err) {
      setError(generalMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (url) {
    return (
      <audio
        controls
        autoPlay
        src={url}
        aria-label={`Reproductor de «${title}»`}
        onError={() => setUrl(null)}
        className="h-9 w-80"
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" icon={<Play size={14} aria-hidden />} onClick={load} loading={loading} aria-label={`Escuchar «${title}»`}>
        Escuchar
      </Button>
      {error && <span role="alert" className="text-sm text-red-700">{error}</span>}
    </div>
  );
}

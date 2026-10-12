import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Grabación con el micrófono del navegador (spec speaking-log): límite de
 * duración con parada automática y manejo del permiso denegado.
 * El audio queda en memoria (buffer local) hasta que se sube o se descarta.
 */
export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'stopped' | 'denied' | 'unsupported' | 'error';

export interface Recording {
  blob: Blob;
  durationSeconds: number;
}

const isSupported = () =>
  typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

export function useRecorder({ limitSeconds }: { limitSeconds: number }) {
  const [status, setStatus] = useState<RecorderStatus>(() => (isSupported() ? 'idle' : 'unsupported'));
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState<Recording | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorder.current?.state === 'recording') mediaRecorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (!isSupported()) {
      setStatus('unsupported');
      return;
    }
    setStatus('requesting');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = (error as DOMException).name;
      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error');
      return;
    }

    const recorder = new MediaRecorder(stream.current);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const seconds = Math.round((Date.now() - startedAt.current) / 1000);
      cleanup();
      setRecording({
        blob: new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }),
        durationSeconds: Math.max(1, Math.min(limitSeconds, seconds)),
      });
      setStatus('stopped');
    };

    mediaRecorder.current = recorder;
    recorder.start(1000);
    startedAt.current = Date.now();
    setElapsed(0);
    setRecording(null);
    setStatus('recording');
    timer.current = setInterval(() => {
      const seconds = (Date.now() - startedAt.current) / 1000;
      setElapsed(Math.min(seconds, limitSeconds));
      if (seconds >= limitSeconds) stop();
    }, 200);
  }, [cleanup, limitSeconds, stop]);

  /** Olvida la grabación y vuelve al estado inicial. */
  const reset = useCallback(() => {
    setRecording(null);
    setElapsed(0);
    setStatus(isSupported() ? 'idle' : 'unsupported');
  }, []);

  // Al salir de la pantalla se suelta el micrófono.
  useEffect(() => () => {
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.onstop = null;
      mediaRecorder.current.stop();
    }
    cleanup();
  }, [cleanup]);

  return { status, elapsed, recording, start, stop, reset };
}

/** "125" → "2:05". */
export const formatSeconds = (seconds: number) => {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

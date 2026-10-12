import { encodePcmToMp3, mixToMono } from './mp3';

/**
 * Convierte la grabación del navegador (WebM/Opus) a MP3: la decodifica con
 * AudioContext, la mezcla a mono y la codifica en un Web Worker.
 */
export async function encodeRecordingToMp3(recording: Blob, onProgress?: (value: number) => void): Promise<Blob> {
  const context = new AudioContext();
  let samples: Float32Array;
  let sampleRate: number;
  try {
    const audio = await context.decodeAudioData(await recording.arrayBuffer());
    samples = mixToMono(Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i)));
    sampleRate = audio.sampleRate;
  } finally {
    void context.close();
  }

  if (typeof Worker === 'undefined') return encodePcmToMp3(samples, sampleRate, { onProgress });

  return new Promise<Blob>((resolve, reject) => {
    const worker = new Worker(new URL('./mp3.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ type: 'progress' | 'done' | 'error'; value?: number; blob?: Blob; message?: string }>) => {
      const message = event.data;
      if (message.type === 'progress') onProgress?.(message.value ?? 0);
      if (message.type === 'done' && message.blob) {
        worker.terminate();
        resolve(message.blob);
      }
      if (message.type === 'error') {
        worker.terminate();
        reject(new Error(message.message));
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'No se pudo convertir el audio a MP3'));
    };
    // Se transfiere el búfer (sin copiarlo) para no duplicar memoria.
    worker.postMessage({ samples, sampleRate }, [samples.buffer]);
  });
}

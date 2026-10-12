/// <reference lib="webworker" />
import { encodePcmToMp3 } from './mp3';

/**
 * Web Worker de codificación: convierte a MP3 fuera del hilo principal para
 * que la pantalla no se congele con grabaciones largas.
 * Entrada: { samples: Float32Array, sampleRate }. Salida: { type: 'progress', value } y { type: 'done', blob }.
 */
self.onmessage = (event: MessageEvent<{ samples: Float32Array; sampleRate: number }>) => {
  try {
    const blob = encodePcmToMp3(event.data.samples, event.data.sampleRate, {
      onProgress: (value) => self.postMessage({ type: 'progress', value }),
    });
    self.postMessage({ type: 'done', blob });
  } catch (error) {
    self.postMessage({ type: 'error', message: (error as Error).message });
  }
};

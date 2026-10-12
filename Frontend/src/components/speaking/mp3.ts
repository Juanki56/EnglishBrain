import { Mp3Encoder } from '@breezystack/lamejs';

/**
 * Codificación a MP3 (design D6): mono a 64 kbps, ~8 KB por segundo
 * (10 minutos ≈ 4,8 MB, por debajo del límite de 15 MB del Backend).
 * Funciones puras: las usa el Web Worker y se pueden probar sin navegador.
 */
export const MP3_KBPS = 64;
const SAMPLES_PER_FRAME = 1152;

/** Mezcla varios canales en uno (media de las muestras). */
export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0]!;
  const length = Math.min(...channels.map((c) => c.length));
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const channel of channels) sum += channel[i]!;
    mono[i] = sum / channels.length;
  }
  return mono;
}

/** Muestras -1..1 a enteros de 16 bits, como las espera el codificador. */
export function floatTo16Bit(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** Codifica audio mono a MP3. `onProgress` recibe valores de 0 a 1. */
export function encodePcmToMp3(
  samples: Float32Array,
  sampleRate: number,
  { kbps = MP3_KBPS, onProgress }: { kbps?: number; onProgress?: (value: number) => void } = {},
): Blob {
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const pcm = floatTo16Bit(samples);
  const parts: Uint8Array<ArrayBuffer>[] = [];
  // Copia cada bloque (el codificador reutiliza su búfer interno).
  const push = (chunk: ArrayLike<number> & { length: number }) => {
    if (chunk.length) parts.push(Uint8Array.from(chunk as ArrayLike<number>, (b) => b & 0xff));
  };

  const step = SAMPLES_PER_FRAME * 64;
  for (let i = 0; i < pcm.length; i += SAMPLES_PER_FRAME) {
    push(encoder.encodeBuffer(pcm.subarray(i, i + SAMPLES_PER_FRAME)));
    if (onProgress && i % step === 0) onProgress(Math.min(1, i / pcm.length));
  }
  push(encoder.flush());
  onProgress?.(1);
  return new Blob(parts, { type: 'audio/mpeg' });
}

import { encodePcmToMp3, floatTo16Bit, mixToMono } from './mp3';

/** Un tono de 440 Hz de `seconds` segundos. */
function tone(seconds: number, sampleRate = 48_000) {
  const samples = new Float32Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < samples.length; i++) samples[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
  return samples;
}

/** La misma comprobación que hace el Backend (services/speaking.service.ts). */
const looksLikeMp3 = (b: Uint8Array) => (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0);
const sizeMatchesDuration = (size: number, seconds: number) => size >= seconds * 500 && size <= seconds * 50_000 + 64 * 1024;

describe('13.2 · Codificación a MP3', () => {
  it('un audio de prueba produce un Blob audio/mpeg que el Backend acepta', async () => {
    const blob = encodePcmToMp3(tone(5), 48_000);
    const bytes = new Uint8Array(await blob.arrayBuffer());

    expect(blob.type).toBe('audio/mpeg');
    expect(looksLikeMp3(bytes)).toBe(true);
    expect(sizeMatchesDuration(blob.size, 5)).toBe(true);
  });

  it('a 64 kbps ocupa unos 8 KB por segundo (10 min ≈ 4,8 MB, bajo el límite de 15 MB)', () => {
    const blob = encodePcmToMp3(tone(10), 48_000);

    expect(blob.size / 10).toBeGreaterThan(7_500);
    expect(blob.size / 10).toBeLessThan(8_800);
  });

  it('funciona también con audio a 44,1 kHz', async () => {
    const blob = encodePcmToMp3(tone(2, 44_100), 44_100);

    expect(looksLikeMp3(new Uint8Array(await blob.arrayBuffer()))).toBe(true);
  });

  it('informa del progreso de 0 a 1', () => {
    const progress: number[] = [];
    encodePcmToMp3(tone(8), 48_000, { onProgress: (v) => progress.push(v) });

    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(1);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
  });

  it('mixToMono promedia los canales y floatTo16Bit recorta valores fuera de rango', () => {
    expect([...mixToMono([new Float32Array([1, 0]), new Float32Array([0, 0.5])])]).toEqual([0.5, 0.25]);
    expect([...floatTo16Bit(new Float32Array([0, 1, -1, 2, -3]))]).toEqual([0, 32767, -32768, 32767, -32768]);
  });
});

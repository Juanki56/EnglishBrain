/**
 * MP3 sintético para las pruebas: tramas MPEG-1 Layer III de 128 kbps a
 * 44,1 kHz (417 bytes, ~26 ms cada una), así el tamaño es realista
 * (~16 KB por segundo). No suena a nada, pero empieza como un MP3 de verdad.
 */
const FRAME_HEADER = [0xff, 0xfb, 0x90, 0x64];
const FRAME_BYTES = 417;
const FRAMES_PER_SECOND = 38.28;

export function makeMp3(seconds: number): Buffer {
  const frames = Math.max(1, Math.round(seconds * FRAMES_PER_SECOND));
  const buffer = Buffer.alloc(frames * FRAME_BYTES);
  for (let i = 0; i < frames; i++) buffer.set(FRAME_HEADER, i * FRAME_BYTES);
  return buffer;
}

/** Igual que makeMp3 pero con etiqueta ID3 al principio (como muchos codificadores). */
export function makeMp3WithId3(seconds: number): Buffer {
  return Buffer.concat([Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00', 'latin1'), makeMp3(seconds)]);
}

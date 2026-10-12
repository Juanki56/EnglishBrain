import { formatTimestamp, parseTimestamp, wordCount } from './text';

describe('parseTimestamp', () => {
  it('entiende minutos:segundos, horas:minutos:segundos y segundos', () => {
    expect(parseTimestamp('1:32')).toBe(92);
    expect(parseTimestamp(' 01:02:03 ')).toBe(3723);
    expect(parseTimestamp('92')).toBe(92);
    expect(parseTimestamp('0:05')).toBe(5);
  });

  it('vacío es null (sin inicio) y un formato inválido es undefined', () => {
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp('   ')).toBeNull();
    expect(['1:75', 'abc', '1:2:3:4', '1.5', '-3', ':30'].map(parseTimestamp)).toEqual(Array(6).fill(undefined));
  });
});

describe('formatTimestamp', () => {
  it('es la inversa de parseTimestamp', () => {
    expect([5, 92, 600, 3723].map(formatTimestamp)).toEqual(['0:05', '1:32', '10:00', '1:02:03']);
    for (const s of [0, 59, 61, 3599, 3600, 7322]) expect(parseTimestamp(formatTimestamp(s))).toBe(s);
  });
});

describe('wordCount', () => {
  it('cuenta palabras ignorando espacios extra', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('  Dear   client,\n I am writing ')).toBe(5);
  });
});

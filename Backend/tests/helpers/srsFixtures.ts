import type { FakeDb } from './fakeSupabase.js';
import { USER_A, USER_B } from './fakeSupabase.js';

/** Ids fijos para las pruebas del motor de repasos. */
export const CARD = {
  vocabOld: '7a000000-0000-4000-8000-000000000001', // vencida hace 3 días
  vocabNew: '7a000000-0000-4000-8000-000000000002', // vencida hace 1 hora
  vocabFuture: '7a000000-0000-4000-8000-000000000003', // vence mañana
  vocabArchived: '7a000000-0000-4000-8000-000000000004', // vencida pero archivada
  vocabPending: '7a000000-0000-4000-8000-000000000005', // en el Inbox
  error: '7a000000-0000-4000-8000-000000000006',
  speaking: '7a000000-0000-4000-8000-000000000007',
  writing: '7a000000-0000-4000-8000-000000000008',
  listening: '7a000000-0000-4000-8000-000000000009',
  neverScheduled: '7a000000-0000-4000-8000-000000000010', // archivada desde su creación (sin fecha)
  vocabOfB: '7b000000-0000-4000-8000-000000000001',
};

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const srs = (due_at: string | null, extra: Record<string, unknown> = {}) => ({
  is_active_srs: true, due_at, interval_days: 0, ease: 2.5, repetitions: 0, lapses: 0,
  retention_state: 'learning', last_reviewed_at: null, created_at: ago(10 * DAY), updated_at: ago(10 * DAY), ...extra,
});

export function seedCards(db: FakeDb): void {
  const a = USER_A.id;
  db.rows('vocabulary').push(
    { id: CARD.vocabOld, user_id: a, word: 'bite the bullet', context_sentence: 'They had to bite the bullet.', translation: 'afrontar',
      definition: 'to face something hard', type: 'idiom_slang', status: 'reviewing', source: 'extension',
      ...srs(ago(3 * DAY), { interval_days: 8, repetitions: 3, retention_state: 'reviewing' }) },
    { id: CARD.vocabNew, user_id: a, word: 'give up', context_sentence: null, translation: 'rendirse', definition: null,
      type: 'phrasal_verb', status: 'learning', source: 'manual', ...srs(ago(HOUR)) },
    { id: CARD.vocabFuture, user_id: a, word: 'awkward', translation: 'incómodo', type: 'word', status: 'learning', source: 'manual',
      ...srs(new Date(Date.now() + DAY).toISOString()) },
    { id: CARD.vocabArchived, user_id: a, word: 'serendipity', translation: 'casualidad', type: 'word', status: 'learning', source: 'manual',
      ...srs(ago(2 * DAY), { is_active_srs: false }) },
    { id: CARD.vocabPending, user_id: a, word: 'pending one', translation: null, type: 'word', status: 'pending_curation', source: 'extension',
      ...srs(ago(2 * DAY)) },
    { id: CARD.neverScheduled, user_id: a, word: 'archived from start', translation: 'archivo', type: 'word', status: 'learning', source: 'manual',
      ...srs(null, { is_active_srs: false }) },
    { id: CARD.vocabOfB, user_id: USER_B.id, word: 'secret of B', translation: 'secreto', type: 'word', status: 'learning', source: 'manual',
      ...srs(ago(5 * DAY)) },
  );
  db.rows('fossilized_errors').push({
    id: CARD.error, user_id: a, incorrect_phrase: 'I have a doubt', correct_phrase: 'I have a question', notes: 'No traducir',
    is_resolved: false, resolved_at: null, ...srs(ago(2 * DAY)),
  });
  db.rows('speaking_logs').push({
    id: CARD.speaking, user_id: a, title: 'Resumen de mi día', duration_seconds: 312, storage_path: `${a}/${CARD.speaking}.mp3`,
    size_bytes: 1000, recording_limit_minutes: 5, ...srs(ago(DAY)),
  });
  db.rows('writing_logs').push({ id: CARD.writing, user_id: a, title: 'Email a cliente', ...srs(ago(12 * HOUR)) });
  db.rows('writing_versions').push(
    { id: '7c000000-0000-4000-8000-000000000001', writing_id: CARD.writing, user_id: a, version_number: 1, content: 'Original', created_at: ago(DAY) },
    { id: '7c000000-0000-4000-8000-000000000002', writing_id: CARD.writing, user_id: a, version_number: 2, content: 'Corregida', created_at: ago(HOUR) },
  );
  db.rows('listening_logs').push({
    id: CARD.listening, user_id: a, title: 'BBC 6 Minute English', url: 'https://www.youtube.com/watch?v=abc', start_seconds: 92,
    transcription: "I reckon that's a stretch", ...srs(ago(6 * HOUR)),
  });
}

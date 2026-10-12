import { describe, expect, it } from 'vitest';
import { HttpError } from '../src/errors.js';
import { scoped } from '../src/services/scoped.js';
import { createTwoUserSupabase, USER_A, USER_B } from './helpers/fakeSupabase.js';

const WORD_A = '1a000000-0000-4000-8000-00000000000a';
const WORD_B = '1b000000-0000-4000-8000-00000000000b';

function setup() {
  const { db, supabase } = createTwoUserSupabase();
  db.rows('vocabulary').push(
    { id: WORD_A, user_id: USER_A.id, word: 'bite the bullet', type: 'idiom_slang', status: 'pending_curation' },
    { id: WORD_B, user_id: USER_B.id, word: 'secret of B', type: 'word', status: 'pending_curation' },
  );
  return { db, a: scoped(supabase, 'vocabulary', USER_A.id) };
}

describe('scoped()', () => {
  it('select solo devuelve filas del usuario', async () => {
    const { a } = setup();
    const { data } = await a.select('id, word');

    expect(data).toEqual([{ id: WORD_A, word: 'bite the bullet' }]);
  });

  it('insert asigna el user_id del usuario aunque el cliente envíe otro', async () => {
    const { db, a } = setup();
    await a.insert({ word: 'intruso', type: 'word', user_id: USER_B.id });

    const inserted = db.rows('vocabulary').find((row) => row.word === 'intruso');
    expect(inserted?.user_id).toBe(USER_A.id);
  });

  it('insert de varias filas asigna el user_id a todas', async () => {
    const { db, a } = setup();
    await a.insert([{ word: 'uno', type: 'word' }, { word: 'dos', type: 'word', user_id: USER_B.id }]);

    const owners = db.rows('vocabulary').filter((r) => ['uno', 'dos'].includes(String(r.word))).map((r) => r.user_id);
    expect(owners).toEqual([USER_A.id, USER_A.id]);
  });

  it('update no toca filas de otro usuario', async () => {
    const { db, a } = setup();
    await a.update({ word: 'hackeado' }).eq('id', WORD_B);

    expect(db.rows('vocabulary').find((r) => r.id === WORD_B)?.word).toBe('secret of B');
  });

  it('update no permite cambiar el dueño de una fila propia', async () => {
    const { db, a } = setup();
    await a.update({ word: 'editada', user_id: USER_B.id }).eq('id', WORD_A);

    const row = db.rows('vocabulary').find((r) => r.id === WORD_A);
    expect(row).toMatchObject({ word: 'editada', user_id: USER_A.id });
  });

  it('delete no borra filas de otro usuario', async () => {
    const { db, a } = setup();
    await a.delete().eq('id', WORD_B);

    expect(db.rows('vocabulary').some((r) => r.id === WORD_B)).toBe(true);
  });

  it('findById devuelve la fila propia', async () => {
    const { a } = setup();

    await expect(a.findById(WORD_A, 'id, word')).resolves.toEqual({ id: WORD_A, word: 'bite the bullet' });
  });

  it('findById de una fila de otro usuario lanza 404', async () => {
    const { a } = setup();

    await expect(a.findById(WORD_B)).rejects.toMatchObject({ status: 404, code: 'not_found' });
  });

  it('findById con un id que no es uuid lanza 404', async () => {
    const { a } = setup();

    await expect(a.findById('no-es-uuid')).rejects.toBeInstanceOf(HttpError);
  });

  it('ownerColumn permite usarlo con profiles (dueño en la columna id)', async () => {
    const { db, supabase } = createTwoUserSupabase();
    db.rows('profiles').push({ id: USER_A.id, timezone: 'UTC' }, { id: USER_B.id, timezone: 'UTC' });

    const { data } = await scoped(supabase, 'profiles', USER_A.id, 'id').select('id');
    expect(data).toEqual([{ id: USER_A.id }]);
  });
});

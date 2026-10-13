import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { QueueCard } from '../components/anki/types';
import { fakeSession, resetAuthMock } from '../test/authMock';
import { mockApi, renderApp } from '../test/renderApp';

vi.mock('../lib/supabase', async () => (await import('../test/authMock')).supabaseModule);

const card = (item_type: QueueCard['item_type'], item_id: string, front: Record<string, unknown>, back: Record<string, unknown>): QueueCard => ({
  item_type, item_id, due_at: '2026-10-10T10:00:00Z', retention_state: 'learning', front, back,
});
const BITE = card('vocabulary', 'v1', { word: 'bite the bullet', context_sentence: 'They had to bite the bullet.' }, { translation: 'afrontar algo difícil', definition: 'to face it', type: 'idiom_slang' });
const DOUBT = card('fossilized_error', 'e1', { incorrect_phrase: 'I have a doubt' }, { correct_phrase: 'I have a question', notes: 'No traducir' });
const BBC = card('listening', 'l1', { title: 'BBC 6 Minute', open_url: 'https://www.youtube.com/watch?v=abc&t=92' }, { transcription: "I reckon that's a stretch" });
const EMAIL = card('writing', 'w1', { title: 'Email a cliente' }, { content: 'Dear client, I am writing…', version_number: 2 });
const MONO = card('speaking', 's1', { title: 'Resumen de mi día', duration_seconds: 312 }, {});

beforeEach(() => {
  resetAuthMock(fakeSession('tok-anki'));
  vi.unstubAllGlobals();
});

function ankiApi(items: QueueCard[] = [BITE, DOUBT], overrides: Parameters<typeof mockApi>[0] = {}, total = items.length) {
  return mockApi({
    'GET /api/srs/queue': () => ({ json: { items, total } }),
    'POST /api/srs/review': (body) => ({ json: { ...(body as object), interval_days: 2 } }),
    'GET /api/stats/overview': () => ({ json: { vocabulary: { total: 0, learning: 0, reviewing: 0, mastered: 0, pending_curation: 0 }, critical_errors: 0, due_count: 0 } }),
    ...overrides,
  });
}

const startSession = async () => {
  await screen.findByRole('heading', { name: /tarjetas? para repasar/ });
  await userEvent.keyboard('{Enter}');
  return screen.findByRole('article', { name: 'Tarjeta' });
};

describe('16.3 · Sesión a pantalla completa', () => {
  it('va fuera del menú lateral y muestra cuántas tarjetas hay', async () => {
    ankiApi();
    renderApp('/review');

    expect(await screen.findByRole('heading', { name: 'Tienes 2 tarjetas para repasar' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Menú principal' })).not.toBeInTheDocument();
  });

  it('sin tarjetas vencidas felicita y no permite empezar', async () => {
    ankiApi([]);
    renderApp('/review');

    expect(await screen.findByRole('heading', { name: '¡Estás al día!' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Empezar/ })).not.toBeInTheDocument();
  });

  it('se recorre entera solo con el teclado: Enter, Espacio y números', async () => {
    const { calls } = ankiApi();
    renderApp('/review');
    let article = await startSession();
    expect(within(article).getByText('bite the bullet', { selector: 'p' })).toBeInTheDocument();

    await userEvent.keyboard(' ');
    expect(within(article).getByText('afrontar algo difícil')).toBeInTheDocument();
    await userEvent.keyboard('3');

    article = await screen.findByRole('article', { name: 'Tarjeta' });
    expect(within(article).getByText('I have a doubt')).toBeInTheDocument();
    await userEvent.keyboard(' 4');

    expect(await screen.findByRole('heading', { name: '¡Sesión terminada!' })).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2));
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.body)).toEqual([
      { item_type: 'vocabulary', item_id: 'v1', grade: 3 },
      { item_type: 'fossilized_error', item_id: 'e1', grade: 4 },
    ]);
  });

  it('Esc sale al panel en cualquier momento', async () => {
    ankiApi();
    renderApp('/review');
    await startSession();
    await userEvent.keyboard('{Escape}');

    expect(await screen.findByRole('heading', { level: 1, name: 'Panel' })).toBeInTheDocument();
  });
});

describe('16.2 · Tarjetas y fin de sesión', () => {
  it('el reverso no se ve hasta voltear y los números no califican antes', async () => {
    const { calls } = ankiApi();
    renderApp('/review');
    const article = await startSession();

    expect(within(article).queryByRole('region', { name: 'Reverso' })).not.toBeInTheDocument();
    await userEvent.keyboard('3');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    expect(within(article).getByText('bite the bullet', { selector: 'p' })).toBeInTheDocument();
  });

  it('"Otra vez" (1) devuelve la tarjeta al final de la sesión', async () => {
    ankiApi();
    renderApp('/review');
    await startSession();
    await userEvent.keyboard(' 1');
    await userEvent.keyboard(' 3');

    const article = await screen.findByRole('article', { name: 'Tarjeta' });
    expect(within(article).getByText('bite the bullet', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('2 repasadas · quedan 1')).toBeInTheDocument();
  });

  it('el resumen cuenta las tarjetas repasadas y la distribución de calificaciones', async () => {
    ankiApi();
    renderApp('/review');
    await startSession();
    await userEvent.keyboard(' 1 3 3');

    const summary = await screen.findByRole('region', { name: 'Resumen de la sesión' });
    expect(within(summary).getByText('Repasaste 3 tarjetas.')).toBeInTheDocument();
    const rows = within(within(summary).getByRole('list', { name: 'Calificaciones' })).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual(['Otra vez1', 'Difícil0', 'Bien2', 'Fácil0']);
  });

  it('cada tipo de tarjeta muestra su anverso y su reverso', async () => {
    ankiApi([DOUBT, BBC, EMAIL, MONO]);
    renderApp('/review');
    let article = await startSession();

    expect(within(article).getByText('¿Cómo se dice correctamente?')).toBeInTheDocument();
    await userEvent.keyboard(' ');
    expect(within(article).getByText('I have a question')).toBeInTheDocument();
    expect(within(article).getByText(/No traducir/)).toBeInTheDocument();
    await userEvent.keyboard('3');

    article = await screen.findByRole('article', { name: 'Tarjeta' });
    expect(within(article).getByRole('link', { name: /Escuchar/ })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc&t=92');
    await userEvent.keyboard(' ');
    expect(within(article).getByText("I reckon that's a stretch")).toBeInTheDocument();
    await userEvent.keyboard('3');

    article = await screen.findByRole('article', { name: 'Tarjeta' });
    expect(within(article).getByText('Email a cliente')).toBeInTheDocument();
    expect(within(article).queryByText('Dear client, I am writing…')).not.toBeInTheDocument();
    await userEvent.keyboard(' ');
    expect(within(article).getByText('Dear client, I am writing…')).toBeInTheDocument();
    await userEvent.keyboard('3');

    article = await screen.findByRole('article', { name: 'Tarjeta' });
    expect(within(article).getByText('Resumen de mi día')).toBeInTheDocument();
    expect(within(article).getByRole('button', { name: 'Escuchar «Resumen de mi día»' })).toBeInTheDocument();
  });

  it('también se puede calificar con el ratón', async () => {
    const { calls } = ankiApi([BITE]);
    renderApp('/review');
    await screen.findByRole('heading', { name: /para repasar/ });
    await userEvent.click(screen.getByRole('button', { name: /Empezar/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Mostrar respuesta/ }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Califica la tarjeta' })).getByRole('button', { name: /Fácil/ }));

    expect(await screen.findByText('Repasaste 1 tarjeta.')).toBeInTheDocument();
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ grade: 4 }));
  });

  it('si una calificación no se guarda, la tarjeta vuelve a la cola y avisa', async () => {
    ankiApi([BITE], { 'POST /api/srs/review': () => ({ status: 500, json: { error: { code: 'internal_error', message: 'Error interno del servidor' } } }) });
    renderApp('/review');
    await startSession();
    await userEvent.keyboard(' 3');

    expect(await screen.findByText(/No se guardó la calificación/)).toBeInTheDocument();
    const article = await screen.findByRole('article', { name: 'Tarjeta' });
    expect(within(article).getByText('bite the bullet', { selector: 'p' })).toBeInTheDocument();
  });

  it('con más vencidas que la tanda, el resumen ofrece seguir', async () => {
    let call = 0;
    ankiApi([BITE], {
      'GET /api/srs/queue': () => {
        call++;
        return { json: call === 1 ? { items: [BITE], total: 150 } : { items: [DOUBT], total: 149 } };
      },
    });
    renderApp('/review');
    expect(await screen.findByText(/Empezamos con las 1 más atrasadas/)).toBeInTheDocument();
    await startSession();
    await userEvent.keyboard(' 3');
    await userEvent.click(await screen.findByRole('button', { name: 'Seguir con 149 más' }));

    const article = await screen.findByRole('article', { name: 'Tarjeta' });
    expect(within(article).getByText('I have a doubt')).toBeInTheDocument();
  });
});

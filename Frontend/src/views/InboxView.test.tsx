import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeSession, resetAuthMock } from '../test/authMock';
import { mockApi, renderApp } from '../test/renderApp';

vi.mock('../lib/supabase', async () => (await import('../test/authMock')).supabaseModule);

const base = {
  translation: null, definition: null, status: 'pending_curation', source: 'extension', is_active_srs: true,
  due_at: null, retention_state: 'learning', updated_at: 'x',
};
const BITE = {
  ...base, id: 'w1', word: 'bite the bullet', type: 'idiom_slang', created_at: '2026-10-01T10:00:00Z',
  context_sentence: 'The company had to bite the bullet and lay off workers.', source_url: 'https://www.bbc.com/news/x',
};
const SERENDIPITY = {
  ...base, id: 'w2', word: 'serendipity', type: 'word', created_at: '2026-10-03T10:00:00Z', context_sentence: null, source_url: null,
};

beforeEach(() => {
  resetAuthMock(fakeSession('tok-inbox'));
  vi.unstubAllGlobals();
});

/** Backend simulado: el Inbox va quitando lo que se cura o descarta. */
function inboxApi(initial = [BITE, SERENDIPITY], overrides: Parameters<typeof mockApi>[0] = {}) {
  let pending = [...initial];
  const remove = (id: string) => (pending = pending.filter((i) => i.id !== id));
  return mockApi({
    'GET /api/vocabulary': () => ({ json: { items: pending, total: pending.length } }),
    'PATCH /api/vocabulary/w1/curate': () => (remove('w1'), { json: { ...BITE, status: 'learning' } }),
    'PATCH /api/vocabulary/w2/curate': () => (remove('w2'), { json: { ...SERENDIPITY, status: 'learning' } }),
    'DELETE /api/vocabulary/w1': () => (remove('w1'), { status: 204 }),
    ...overrides,
  });
}

const panel = (word: string) => screen.findByRole('region', { name: `Curar «${word}»` });

describe('11.1 · Lista del Inbox', () => {
  it('pide solo las pendientes de curación y las muestra en el orden del Backend (más antigua primero)', async () => {
    const { calls } = inboxApi();
    renderApp('/inbox');
    const list = await screen.findByRole('list', { name: 'Capturas por curar' });
    const buttons = within(list).getAllByRole('button');

    expect(buttons.map((b) => b.textContent)).toEqual([expect.stringContaining('bite the bullet'), expect.stringContaining('serendipity')]);
    expect(screen.getByText('2 palabras por curar')).toBeInTheDocument();
    const get = calls.find((c) => c.method === 'GET');
    expect(get?.auth).toBe('Bearer tok-inbox');
  });

  it('muestra de dónde viene cada captura', async () => {
    inboxApi();
    renderApp('/inbox');
    const list = await screen.findByRole('list', { name: 'Capturas por curar' });

    expect(within(list).getByText(/bbc\.com/)).toBeInTheDocument();
    expect(within(list).getByText(/Sin origen/)).toBeInTheDocument();
  });

  it('con el Inbox vacío explica cómo capturar y enlaza a Nueva palabra', async () => {
    inboxApi([]);
    renderApp('/inbox');

    expect(await screen.findByText('No hay capturas por curar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Añadir una palabra a mano/ })).toHaveAttribute('href', '/words/new');
  });

  it('si el Backend no responde lo explica', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    renderApp('/inbox');

    expect(await screen.findByText('No se pudo conectar con el servidor. ¿Está encendido el Backend?')).toBeInTheDocument();
  });
});

describe('11.2 · Panel de curación a dos columnas', () => {
  it('abre la más antigua: palabra en grande, contexto resaltado y origen; foco en la traducción', async () => {
    inboxApi();
    renderApp('/inbox');
    const region = await panel('bite the bullet');

    expect(within(region).getByRole('heading', { level: 2, name: 'bite the bullet' })).toBeInTheDocument();
    expect(within(region).getByText('bite the bullet', { selector: 'mark' })).toBeInTheDocument();
    expect(within(region).getByText(/lay off workers/)).toBeInTheDocument();
    expect(within(region).getByRole('link', { name: /bbc\.com/ })).toHaveAttribute('href', 'https://www.bbc.com/news/x');
    expect(within(region).getByRole('textbox', { name: /Traducción al español/ })).toHaveFocus();
  });

  it('el tipo provisional viene elegido y se puede cambiar; el interruptor de Anki está activado', async () => {
    inboxApi();
    renderApp('/inbox');
    const region = await panel('bite the bullet');

    expect(within(region).getByRole('radio', { name: /Idiom \/ slang/ })).toBeChecked();
    expect(within(region).getByRole('switch', { name: /cola de repasos/ })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(within(region).getByRole('radio', { name: /Phrasal verb/ }));
    expect(within(region).getByRole('radio', { name: /Phrasal verb/ })).toBeChecked();
  });

  it('al hacer clic en otra captura se abre esa, con el formulario vacío', async () => {
    inboxApi();
    renderApp('/inbox');
    await userEvent.type(within(await panel('bite the bullet')).getByRole('textbox', { name: /Traducción/ }), 'afrontar');
    await userEvent.click(screen.getByRole('button', { name: /serendipity/ }));
    const region = await panel('serendipity');

    expect(within(region).getByText('Esta captura no trae párrafo de contexto.')).toBeInTheDocument();
    expect(within(region).getByRole('textbox', { name: /Traducción/ })).toHaveValue('');
    expect(screen.getByRole('button', { name: /serendipity/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('11.3 · Guardar con Ctrl+Enter, validar y descartar', () => {
  it('Ctrl+Enter guarda, pasa la palabra a learning y abre la siguiente con el foco en la traducción', async () => {
    const { calls } = inboxApi();
    renderApp('/inbox');
    const region = await panel('bite the bullet');
    await userEvent.type(within(region).getByRole('textbox', { name: /Traducción/ }), 'afrontar algo difícil');
    await userEvent.type(within(region).getByRole('textbox', { name: /Definición propia/ }), 'to accept something unpleasant');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');

    const next = await panel('serendipity');
    expect(within(next).getByRole('textbox', { name: /Traducción/ })).toHaveFocus();
    expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({
      path: '/api/vocabulary/w1/curate',
      body: { translation: 'afrontar algo difícil', definition: 'to accept something unpleasant', type: 'idiom_slang', is_active_srs: true },
    });
    expect(screen.getByText('«bite the bullet» lista para tus repasos')).toBeInTheDocument();
    expect(screen.getByText('1 palabra por curar')).toBeInTheDocument();
  });

  it('con el interruptor apagado se guarda como archivo', async () => {
    const { calls } = inboxApi();
    renderApp('/inbox');
    const region = await panel('bite the bullet');
    await userEvent.type(within(region).getByRole('textbox', { name: /Traducción/ }), 'afrontar');
    await userEvent.click(within(region).getByRole('switch'));
    await userEvent.click(within(region).getByRole('button', { name: /Guardar y siguiente/ }));

    await screen.findByText('«bite the bullet» guardada como archivo');
    expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ is_active_srs: false });
  });

  it('con la traducción vacía no guarda y marca el campo como obligatorio', async () => {
    const { calls } = inboxApi();
    renderApp('/inbox');
    const region = await panel('bite the bullet');
    await userEvent.type(within(region).getByRole('textbox', { name: /Traducción/ }), '   ');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');

    expect(await within(region).findByText('La traducción es obligatoria')).toBeInTheDocument();
    expect(within(region).getByRole('textbox', { name: /Traducción/ })).toHaveAttribute('aria-invalid', 'true');
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('al curar la última, el Inbox queda vacío', async () => {
    inboxApi([SERENDIPITY]);
    renderApp('/inbox');
    await userEvent.type(within(await panel('serendipity')).getByRole('textbox', { name: /Traducción/ }), 'casualidad');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');

    expect(await screen.findByText('No hay capturas por curar')).toBeInTheDocument();
  });

  it('Descartar pide confirmación y borra la captura', async () => {
    const { calls } = inboxApi();
    renderApp('/inbox');
    await userEvent.click(within(await panel('bite the bullet')).getByRole('button', { name: 'Descartar' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Descartar «bite the bullet»?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Descartar' }));

    expect(await panel('serendipity')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/vocabulary/w1')).toBe(true);
    expect(screen.getByText('Captura «bite the bullet» descartada')).toBeInTheDocument();
  });

  it('Cancelar en la confirmación no borra nada', async () => {
    const { calls } = inboxApi();
    renderApp('/inbox');
    await userEvent.click(within(await panel('bite the bullet')).getByRole('button', { name: 'Descartar' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(await panel('bite the bullet')).toBeInTheDocument();
  });

  it('un error del Backend en un campo se muestra bajo ese campo', async () => {
    inboxApi(undefined, {
      'PATCH /api/vocabulary/w1/curate': () => ({
        status: 400,
        json: { error: { code: 'validation_error', message: 'x', details: [{ field: 'translation', message: 'La traducción admite como máximo 500 caracteres' }] } },
      }),
    });
    renderApp('/inbox');
    const region = await panel('bite the bullet');
    await userEvent.type(within(region).getByRole('textbox', { name: /Traducción/ }), 'demasiado');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');

    expect(await within(region).findByText('La traducción admite como máximo 500 caracteres')).toBeInTheDocument();
  });

  it('si ya estaba curada (409) la quita del Inbox y avisa', async () => {
    inboxApi(undefined, {
      'PATCH /api/vocabulary/w1/curate': () => ({ status: 409, json: { error: { code: 'conflict', message: 'Esta palabra ya fue curada' } } }),
    });
    renderApp('/inbox');
    await userEvent.type(within(await panel('bite the bullet')).getByRole('textbox', { name: /Traducción/ }), 'x');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');

    expect(await screen.findByText('«bite the bullet» ya estaba curada')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: /bite the bullet/ })).not.toBeInTheDocument());
  });
});

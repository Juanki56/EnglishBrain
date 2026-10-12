import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeSession, resetAuthMock } from '../test/authMock';
import { mockApi, renderApp } from '../test/renderApp';

vi.mock('../lib/supabase', async () => (await import('../test/authMock')).supabaseModule);

const word = (id: string, w: string, extra: Record<string, unknown> = {}) => ({
  id, word: w, translation: 'traducción', definition: null, context_sentence: null, type: 'word', status: 'learning',
  source: 'manual', source_url: null, is_active_srs: true, due_at: null, retention_state: 'learning',
  created_at: '2026-10-01T10:00:00Z', updated_at: 'x', ...extra,
});
const GIVE_UP = word('v1', 'give up', { type: 'phrasal_verb', translation: 'rendirse' });
const SERENDIPITY = word('v2', 'serendipity', { is_active_srs: false, status: 'mastered', retention_state: 'mastered' });
const PENDING = word('v3', 'pending one', { translation: null, status: 'pending_curation' });
const EMAIL = { id: 'w1', title: 'Email a cliente', is_active_srs: true, created_at: '2026-10-01T10:00:00Z', version_count: 2, latest_version_number: 2, latest_version_at: null, excerpt: 'Dear client…' };

beforeEach(() => {
  resetAuthMock(fakeSession('tok-lib'));
  vi.unstubAllGlobals();
});

function libraryApi(overrides: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /api/vocabulary': () => ({ json: { items: [GIVE_UP, SERENDIPITY, PENDING], total: 3 } }),
    'GET /api/writing': () => ({ json: { items: [EMAIL], total: 1 } }),
    'GET /api/errors': () => ({ json: { items: [], total: 0 } }),
    'PATCH /api/items/vocabulary/v1/srs-toggle': (body) => ({ json: { id: 'v1', ...(body as object), due_at: null } }),
    'PATCH /api/vocabulary/v1': (body) => ({ json: { ...GIVE_UP, ...(body as object) } }),
    'DELETE /api/writing/w1': () => ({ status: 204 }),
    ...overrides,
  });
}

const table = (name: string) => screen.findByRole('table', { name });
const lastQuery = (calls: ReturnType<typeof libraryApi>['calls'], path: string) => {
  const call = calls.filter((c) => c.method === 'GET' && c.path === path).at(-1);
  return call;
};

describe('15.1 · Biblioteca: pestañas, búsqueda y filtros', () => {
  it('abre Vocabulario con palabra, tipo, traducción, estado y el interruptor de repasos', async () => {
    libraryApi();
    renderApp('/library');
    const rows = within(await table('Vocabulario')).getAllByRole('row');

    expect(rows).toHaveLength(4); // cabecera + 3
    expect(within(rows[1]!).getByText('give up')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Phrasal verb')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('rendirse')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Learning')).toBeInTheDocument();
    expect(within(rows[1]!).getByRole('switch', { name: 'Repasos de «give up»' })).toHaveAttribute('aria-checked', 'true');
    expect(within(rows[2]!).getByRole('switch', { name: 'Repasos de «serendipity»' })).toHaveAttribute('aria-checked', 'false');
    expect(within(rows[3]!).getByRole('link', { name: 'Curar en el Inbox' })).toHaveAttribute('href', '/inbox');
    expect(screen.getByText('3 registros')).toBeInTheDocument();
  });

  it('cambiar de pestaña carga esa categoría con sus columnas', async () => {
    const { calls } = libraryApi();
    renderApp('/library');
    await table('Vocabulario');
    await userEvent.click(screen.getByRole('tab', { name: /Writing/ }));

    const writing = await table('Writing');
    expect(within(writing).getByText('Email a cliente')).toBeInTheDocument();
    expect(within(writing).getByRole('link', { name: /Abrir «Email a cliente»/ })).toHaveAttribute('href', '/writing?id=w1');
    expect(screen.getByRole('tab', { name: /Writing/ })).toHaveAttribute('aria-selected', 'true');
    expect(calls.some((c) => c.path === '/api/writing')).toBe(true);
  });

  it('el filtro "Archivo" y la búsqueda viajan al Backend', async () => {
    const { calls } = libraryApi();
    renderApp('/library');
    await table('Vocabulario');
    await userEvent.click(screen.getByRole('button', { name: 'Archivo' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar en Vocabulario' }), 'seren');

    await waitFor(() => expect(lastQuery(calls, '/api/vocabulary')).toBeDefined());
    await waitFor(() => {
      const fetches = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
      expect(fetches.some((u) => u.includes('srs=archived') && u.includes('q=seren'))).toBe(true);
    });
    expect(screen.getByRole('button', { name: 'Archivo' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('en Vocabulario se filtra por tipo y por estado', async () => {
    libraryApi();
    renderApp('/library');
    await table('Vocabulario');
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'phrasal_verb');
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'mastered');

    await waitFor(() => {
      const fetches = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
      expect(fetches.some((u) => u.includes('type=phrasal_verb') && u.includes('status=mastered'))).toBe(true);
    });
  });

  it('los filtros de tipo y estado no existen en las otras pestañas', async () => {
    libraryApi();
    renderApp('/library?tab=errors');
    await table('Errores');

    expect(screen.queryByLabelText('Tipo')).not.toBeInTheDocument();
    expect(screen.getByText('Todavía no has guardado nada aquí.')).toBeInTheDocument();
  });
});

describe('15.2 · Modo Archivo por fila, edición y borrado', () => {
  it('el interruptor cambia al instante y guarda en el Backend', async () => {
    const { calls } = libraryApi();
    renderApp('/library');
    const toggle = within(await table('Vocabulario')).getByRole('switch', { name: 'Repasos de «give up»' });
    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(await screen.findByText('«give up» archivado: no aparecerá en los repasos')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ path: '/api/items/vocabulary/v1/srs-toggle', body: { is_active_srs: false } });
  });

  it('si el Backend falla, el interruptor vuelve a su estado y avisa', async () => {
    libraryApi({
      'PATCH /api/items/vocabulary/v1/srs-toggle': () => ({ status: 500, json: { error: { code: 'internal_error', message: 'Error interno del servidor' } } }),
    });
    renderApp('/library');
    const toggle = within(await table('Vocabulario')).getByRole('switch', { name: 'Repasos de «give up»' });
    await userEvent.click(toggle);

    expect(await screen.findByText('No se pudo cambiar: Error interno del servidor')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('editar una palabra abre la ventana con sus datos y actualiza la fila', async () => {
    const { calls } = libraryApi();
    renderApp('/library');
    await userEvent.click(within(await table('Vocabulario')).getByRole('button', { name: 'Editar «give up»' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar palabra' });
    const translation = within(dialog).getByLabelText(/Traducción al español/);
    expect(translation).toHaveValue('rendirse');

    await userEvent.clear(translation);
    await userEvent.type(translation, 'darse por vencido');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('«give up» actualizada')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/api/vocabulary/v1' && c.method === 'PATCH')?.body).toMatchObject({ translation: 'darse por vencido', type: 'phrasal_verb' });
    expect(await within(await table('Vocabulario')).findByText('darse por vencido')).toBeInTheDocument();
  });

  it('vaciar la traducción de una palabra curada se señala sin llamar al Backend', async () => {
    const { calls } = libraryApi();
    renderApp('/library');
    await userEvent.click(within(await table('Vocabulario')).getByRole('button', { name: 'Editar «give up»' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar palabra' });
    await userEvent.clear(within(dialog).getByLabelText(/Traducción al español/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(within(dialog).getByText('La traducción es obligatoria')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('borrar pide confirmación, avisa de qué se pierde y quita la fila', async () => {
    const { calls } = libraryApi();
    renderApp('/library?tab=writing');
    await userEvent.click(within(await table('Writing')).getByRole('button', { name: 'Borrar «Email a cliente»' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Borrar este registro?' });
    expect(dialog).toHaveTextContent('con todas sus versiones');
    expect(dialog).toHaveTextContent('apaga «Repasos»');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Borrar' }));
    expect(await screen.findByText('«Email a cliente» borrado')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/writing/w1')).toBe(true);
    expect(await screen.findByText('Todavía no has guardado nada aquí.')).toBeInTheDocument();
  });
});

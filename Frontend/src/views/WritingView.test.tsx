import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeSession, resetAuthMock } from '../test/authMock';
import { mockApi, renderApp } from '../test/renderApp';

vi.mock('../lib/supabase', async () => (await import('../test/authMock')).supabaseModule);

const v = (n: number, content: string) => ({ id: `v${n}`, version_number: n, content, created_at: `2026-10-0${n}T10:00:00Z` });
const EMAIL = {
  id: 'w1', title: 'Email a cliente', is_active_srs: true, created_at: '2026-10-01T10:00:00Z',
  versions: [v(1, 'Dear client, I write you for the meeting.'), v(2, 'Dear client, I am writing about the meeting.')],
};
const DIARY = { id: 'w2', title: 'Diario', is_active_srs: false, created_at: '2026-10-05T10:00:00Z', versions: [v(1, 'Today I go to the park.')] };

const listItem = (e: typeof EMAIL) => ({
  id: e.id, title: e.title, is_active_srs: e.is_active_srs, created_at: e.created_at,
  version_count: e.versions.length, latest_version_number: e.versions.length, latest_version_at: null,
  excerpt: e.versions.at(-1)!.content.slice(0, 200),
});

beforeEach(() => {
  resetAuthMock(fakeSession('tok-writing'));
  vi.unstubAllGlobals();
});

function writingApi(overrides: Parameters<typeof mockApi>[0] = {}) {
  const store = { w1: structuredClone(EMAIL), w2: structuredClone(DIARY) } as Record<string, typeof EMAIL>;
  return mockApi({
    'GET /api/writing': () => ({ json: { items: Object.values(store).map(listItem), total: Object.keys(store).length } }),
    'GET /api/writing/w1': () => ({ json: store.w1 }),
    'GET /api/writing/w2': () => ({ json: store.w2 }),
    'GET /api/writing/w3': () => ({ json: store.w3 }),
    'POST /api/writing': (body) => {
      const b = body as { title: string; content: string; is_active_srs: boolean };
      store.w3 = { id: 'w3', title: b.title, is_active_srs: b.is_active_srs, created_at: '2026-10-12T10:00:00Z', versions: [v(1, b.content)] };
      return { status: 201, json: store.w3 };
    },
    'POST /api/writing/w1/versions': (body) => {
      const version = v(store.w1!.versions.length + 1, (body as { content: string }).content);
      store.w1!.versions.push(version);
      return { status: 201, json: version };
    },
    'PATCH /api/writing/w1': (body) => {
      store.w1!.title = (body as { title: string }).title;
      return { json: store.w1 };
    },
    'DELETE /api/writing/w1': () => {
      delete store.w1;
      return { status: 204 };
    },
    ...overrides,
  });
}

describe('14.1 · Writing', () => {
  it('lista los textos con extracto y número de versiones; sin elegir ninguno invita a escribir', async () => {
    writingApi();
    renderApp('/writing');
    const nav = await screen.findByRole('navigation', { name: 'Tus textos' });

    expect(await within(nav).findByRole('button', { name: /Email a cliente/ })).toHaveTextContent('2 versiones');
    expect(within(nav).getByRole('button', { name: /Diario/ })).toHaveTextContent('Today I go to the park.');
    expect(screen.getByText('Elige un texto de la lista o escribe uno nuevo')).toBeInTheDocument();
  });

  it('crea un texto: la versión 1 es el original y queda abierto', async () => {
    const { calls } = writingApi();
    renderApp('/writing');
    await userEvent.click((await screen.findAllByRole('button', { name: 'Nuevo texto' }))[0]!);
    await userEvent.type(screen.getByLabelText(/^Título/), 'Ensayo sobre la IA');
    await userEvent.type(screen.getByLabelText(/^Tu texto/), 'AI is changing the world.');
    expect(screen.getByText(/^5 palabras/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Guardar/ }));

    expect(await screen.findByText('«Ensayo sobre la IA» guardado')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ title: 'Ensayo sobre la IA', content: 'AI is changing the world.', is_active_srs: true });
    const article = await screen.findByRole('article', { name: 'Ensayo sobre la IA' });
    expect(within(article).getByRole('region', { name: 'Original' })).toHaveTextContent('AI is changing the world.');
    expect(within(article).getByText('Todavía no hay versiones corregidas.')).toBeInTheDocument();
  });

  it('sin título o sin texto no guarda y lo señala', async () => {
    const { calls } = writingApi();
    renderApp('/writing?new=1');
    await userEvent.click(await screen.findByRole('button', { name: /^Guardar/ }));

    expect(screen.getByText('El título es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('El texto es obligatorio')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('compara el original con la última versión y permite elegir otra', async () => {
    writingApi();
    renderApp('/writing?id=w1');
    const article = await screen.findByRole('article', { name: 'Email a cliente' });

    expect(within(article).getByRole('region', { name: 'Original' })).toHaveTextContent('I write you for the meeting');
    expect(within(article).getByRole('region', { name: 'Versión 2' })).toHaveTextContent('I am writing about the meeting');
    expect(within(article).getByLabelText('Comparar con')).toHaveValue('2');
  });

  it('añadir una versión corregida parte del último texto y la muestra al lado del original', async () => {
    const { calls } = writingApi();
    renderApp('/writing?id=w1');
    const article = await screen.findByRole('article', { name: 'Email a cliente' });
    await userEvent.click(within(article).getByRole('button', { name: 'Añadir versión corregida' }));
    const editor = within(article).getByLabelText(/^Versión corregida/);
    expect(editor).toHaveValue('Dear client, I am writing about the meeting.');
    expect(editor).toHaveFocus();

    await userEvent.clear(editor);
    await userEvent.type(editor, 'Dear Ms. Smith, I am writing regarding our meeting.{Control>}{Enter}{/Control}');

    expect(await screen.findByText('Versión 3 guardada')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/api/writing/w1/versions')?.body).toEqual({ content: 'Dear Ms. Smith, I am writing regarding our meeting.' });
    expect(within(article).getByRole('region', { name: 'Versión 3' })).toHaveTextContent('regarding our meeting');
    expect(within(article).getByRole('region', { name: 'Original' })).toHaveTextContent('I write you for the meeting');
  });

  it('una versión sin cambios no se guarda', async () => {
    const { calls } = writingApi();
    renderApp('/writing?id=w1');
    const article = await screen.findByRole('article', { name: 'Email a cliente' });
    await userEvent.click(within(article).getByRole('button', { name: 'Añadir versión corregida' }));
    await userEvent.click(within(article).getByRole('button', { name: /Guardar versión/ }));

    expect(within(article).getByText('Cambia algo del texto para guardar una versión nueva')).toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/versions'))).toBe(false);
  });

  it('cambiar el título y borrar el texto', async () => {
    const { calls } = writingApi();
    renderApp('/writing?id=w1');
    const article = await screen.findByRole('article', { name: 'Email a cliente' });
    await userEvent.click(within(article).getByRole('button', { name: 'Cambiar título' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cambiar título' });
    await userEvent.clear(within(dialog).getByLabelText(/^Título/));
    await userEvent.type(within(dialog).getByLabelText(/^Título/), 'Email al Sr. Smith');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Email al Sr. Smith' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Borrar este texto?' })).getByRole('button', { name: 'Borrar' }));
    expect(await screen.findByText('Elige un texto de la lista o escribe uno nuevo')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/writing/w1')).toBe(true);
  });

  it('un texto archivado muestra la etiqueta de archivo', async () => {
    writingApi();
    renderApp('/writing?id=w2');
    const article = await screen.findByRole('article', { name: 'Diario' });

    expect(within(article).getByText(/Archivo \/ Solo Almacenamiento/)).toBeInTheDocument();
  });
});

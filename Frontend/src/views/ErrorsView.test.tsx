import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeSession, resetAuthMock } from '../test/authMock';
import { mockApi, renderApp } from '../test/renderApp';
import type { FossilizedError } from './ErrorsView';

vi.mock('../lib/supabase', async () => (await import('../test/authMock')).supabaseModule);

const DOUBT: FossilizedError = {
  id: 'e1', incorrect_phrase: 'I have a doubt', correct_phrase: 'I have a question',
  notes: "Dejar de traducir 'tener una duda'", is_resolved: false, resolved_at: null, is_active_srs: true, created_at: '2026-10-01T10:00:00Z',
};
const PEOPLE: FossilizedError = {
  id: 'e2', incorrect_phrase: 'People is', correct_phrase: 'People are', notes: null,
  is_resolved: true, resolved_at: '2026-10-05T10:00:00Z', is_active_srs: false, created_at: '2026-10-02T10:00:00Z',
};

beforeEach(() => {
  resetAuthMock(fakeSession('tok-errors'));
  vi.unstubAllGlobals();
});

/** Backend simulado del muro: filtra por status y q como el real. */
function wallApi(overrides: Parameters<typeof mockApi>[0] = {}) {
  let wall: FossilizedError[] = [DOUBT, PEOPLE];
  const api = mockApi({
    'GET /api/errors': (_, url) => {
      const status = url.searchParams.get('status');
      const q = url.searchParams.get('q')?.toLowerCase();
      const items = wall
        .filter((e) => (status === 'active' ? !e.is_resolved : status === 'resolved' ? e.is_resolved : true))
        .filter((e) => !q || `${e.incorrect_phrase} ${e.correct_phrase} ${e.notes ?? ''}`.toLowerCase().includes(q));
      return { json: { items, total: items.length } };
    },
    'POST /api/errors': (body) => {
      const created = { ...(body as object), id: 'e3', is_resolved: false, resolved_at: null, created_at: '2026-10-12T10:00:00Z' } as FossilizedError;
      wall = [created, ...wall];
      return { status: 201, json: created };
    },
    'PATCH /api/errors/e1': (body) => {
      const b = body as Partial<FossilizedError>;
      const updated: FossilizedError = { ...DOUBT, ...b, resolved_at: b.is_resolved ? '2026-10-12T10:00:00Z' : null };
      wall = wall.map((e) => (e.id === 'e1' ? updated : e));
      return { json: updated };
    },
    'DELETE /api/errors/e1': () => {
      wall = wall.filter((e) => e.id !== 'e1');
      return { status: 204 };
    },
    ...overrides,
  });
  return api;
}

const wall = () => screen.findByRole('list', { name: 'Errores del muro' });

describe('12.1 · Muro de Errores: registro', () => {
  it('registra un error con sus dos frases y la nota, y lo pone arriba del muro', async () => {
    const { calls } = wallApi();
    renderApp('/errors');
    await userEvent.type(await screen.findByLabelText(/Frase incorrecta/), 'I am agree');
    await userEvent.type(screen.getByLabelText(/Frase correcta nativa/), 'I agree');
    await userEvent.type(screen.getByLabelText(/Nota/), 'agree ya es un verbo');
    await userEvent.click(screen.getByRole('button', { name: /Añadir al muro/ }));

    expect(await screen.findByText('Error añadido al muro')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({
      auth: 'Bearer tok-errors',
      body: { incorrect_phrase: 'I am agree', correct_phrase: 'I agree', notes: 'agree ya es un verbo', is_active_srs: true },
    });
    const first = within(await wall()).getAllByRole('listitem')[0]!;
    expect(first).toHaveAccessibleName('I am agree');
    expect(screen.getByLabelText(/Frase incorrecta/)).toHaveValue('');
    expect(screen.getByLabelText(/Frase incorrecta/)).toHaveFocus();
  });

  it('Ctrl+Enter también guarda', async () => {
    const { calls } = wallApi();
    renderApp('/errors');
    await userEvent.type(await screen.findByLabelText(/Frase incorrecta/), 'I have 20 years');
    await userEvent.type(screen.getByLabelText(/Frase correcta nativa/), "I'm 20 years old{Control>}{Enter}{/Control}");

    await screen.findByText('Error añadido al muro');
    expect(calls.some((c) => c.method === 'POST')).toBe(true);
  });

  it('sin alguna de las dos frases no guarda y señala cuál falta', async () => {
    const { calls } = wallApi();
    renderApp('/errors');
    await userEvent.type(await screen.findByLabelText(/Frase incorrecta/), 'I have a doubt');
    await userEvent.click(screen.getByRole('button', { name: /Añadir al muro/ }));

    expect(screen.getByText('La frase correcta es obligatoria')).toBeInTheDocument();
    expect(screen.queryByText('La frase incorrecta es obligatoria')).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('un error del Backend se muestra bajo su campo', async () => {
    wallApi({
      'POST /api/errors': () => ({
        status: 400,
        json: { error: { code: 'validation_error', message: 'x', details: [{ field: 'correct_phrase', message: 'La frase correcta admite como máximo 500 caracteres' }] } },
      }),
    });
    renderApp('/errors');
    await userEvent.type(await screen.findByLabelText(/Frase incorrecta/), 'a');
    await userEvent.type(screen.getByLabelText(/Frase correcta nativa/), 'b');
    await userEvent.click(screen.getByRole('button', { name: /Añadir al muro/ }));

    expect(await screen.findByText('La frase correcta admite como máximo 500 caracteres')).toBeInTheDocument();
  });
});

describe('12.1 · Muro de Errores: listado y filtros', () => {
  it('por defecto muestra los activos con las dos frases lado a lado y la nota', async () => {
    const { calls } = wallApi();
    renderApp('/errors');
    const card = within(await wall()).getByRole('listitem', { name: 'I have a doubt' });

    expect(within(card).getByText('I have a question')).toBeInTheDocument();
    expect(within(card).getByText(/tener una duda/)).toBeInTheDocument();
    expect(screen.queryByText('People is')).not.toBeInTheDocument();
    expect(calls.find((c) => c.method === 'GET')?.path).toBe('/api/errors');
  });

  it('el filtro Superados muestra los superados con su fecha y la etiqueta de archivo', async () => {
    wallApi();
    renderApp('/errors');
    await wall();
    await userEvent.click(screen.getByRole('button', { name: 'Superados' }));
    const card = within(await wall()).getByRole('listitem', { name: 'People is' });

    expect(within(card).getByText(/Superado el/)).toBeInTheDocument();
    expect(within(card).getByText(/Archivo \/ Solo Almacenamiento/)).toBeInTheDocument();
    expect(screen.queryByText('I have a doubt')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Superados' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Todos muestra ambos y la búsqueda filtra por frase o nota', async () => {
    const { calls } = wallApi();
    renderApp('/errors');
    await wall();
    await userEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(within(await wall()).getAllByRole('listitem')).toHaveLength(2);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar en el muro' }), 'duda');
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Errores del muro' })).getAllByRole('listitem')).toHaveLength(1));
    expect(calls.some((c) => c.method === 'GET' && c.path === '/api/errors')).toBe(true);
  });

  it('muro vacío según el filtro', async () => {
    mockApi({ 'GET /api/errors': () => ({ json: { items: [], total: 0 } }) });
    renderApp('/errors');

    expect(await screen.findByText(/No tienes errores activos/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Superados' }));
    expect(await screen.findByText(/Todavía no has superado ningún error/)).toBeInTheDocument();
  });
});

describe('12.1 · Muro de Errores: superar, editar y borrar', () => {
  it('"Marcar como superado" lo guarda y lo saca de Activos', async () => {
    const { calls } = wallApi();
    renderApp('/errors');
    const card = within(await wall()).getByRole('listitem', { name: 'I have a doubt' });
    await userEvent.click(within(card).getByRole('button', { name: 'Marcar como superado' }));

    expect(await screen.findByText(/¡Error superado!/)).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ is_resolved: true });
    expect(await screen.findByText(/No tienes errores activos/)).toBeInTheDocument();
  });

  it('en Todos, superar lo actualiza en su sitio y permite volverlo a activo', async () => {
    const { calls } = wallApi();
    renderApp('/errors');
    await wall();
    await userEvent.click(screen.getByRole('button', { name: 'Todos' }));
    let card = within(await wall()).getByRole('listitem', { name: 'I have a doubt' });
    await userEvent.click(within(card).getByRole('button', { name: 'Marcar como superado' }));

    card = await within(await wall()).findByRole('listitem', { name: 'I have a doubt' });
    expect(await within(card).findByText(/Superado el/)).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'Volver a activo' }));
    await screen.findByText('El error vuelve a estar activo');
    expect(calls.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([{ is_resolved: true }, { is_resolved: false }]);
  });

  it('editar abre una ventana con los datos y guarda los cambios', async () => {
    const { calls } = wallApi();
    renderApp('/errors');
    await userEvent.click(within(await wall()).getByRole('button', { name: 'Editar «I have a doubt»' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar error' });
    const correct = within(dialog).getByLabelText(/Frase correcta nativa/);
    await userEvent.clear(correct);
    await userEvent.type(correct, 'I have a question about…');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Error actualizado')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ correct_phrase: 'I have a question about…' });
    expect(await screen.findByText('I have a question about…')).toBeInTheDocument();
  });

  it('borrar pide confirmación y lo quita del muro', async () => {
    const { calls } = wallApi();
    renderApp('/errors');
    await userEvent.click(within(await wall()).getByRole('button', { name: 'Borrar «I have a doubt»' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Borrar este error?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Borrar' }));

    expect(await screen.findByText('Error borrado del muro')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/errors/e1')).toBe(true);
    expect(await screen.findByText(/No tienes errores activos/)).toBeInTheDocument();
  });
});

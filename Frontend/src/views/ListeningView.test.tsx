import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeSession, resetAuthMock } from '../test/authMock';
import { mockApi, renderApp } from '../test/renderApp';

vi.mock('../lib/supabase', async () => (await import('../test/authMock')).supabaseModule);

const BBC = {
  id: 'l1', title: 'BBC 6 Minute English', url: 'https://www.youtube.com/watch?v=abc', start_seconds: 92,
  transcription: "I reckon that's a bit of a stretch", is_active_srs: true, created_at: '2026-10-01T10:00:00Z',
  open_url: 'https://www.youtube.com/watch?v=abc&t=92',
};

beforeEach(() => {
  resetAuthMock(fakeSession('tok-listen'));
  vi.unstubAllGlobals();
});

function listeningApi(overrides: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /api/listening': (_, url) => {
      const q = url.searchParams.get('q')?.toLowerCase();
      const items = [BBC].filter((i) => !q || `${i.title} ${i.transcription}`.toLowerCase().includes(q));
      return { json: { items, total: items.length } };
    },
    'POST /api/listening': (body) => ({ status: 201, json: { ...BBC, ...(body as object), id: 'l2', open_url: 'https://x.test/open' } }),
    'PATCH /api/listening/l1': (body) => ({ json: { ...BBC, ...(body as object) } }),
    'DELETE /api/listening/l1': () => ({ status: 204 }),
    ...overrides,
  });
}

const fill = async (label: RegExp, text: string) => userEvent.type(await screen.findByLabelText(label), text);

describe('14.2 · Listening', () => {
  it('lista los retos con origen, inicio y transcripción; "Escuchar" abre en otra pestaña en el segundo exacto', async () => {
    listeningApi();
    renderApp('/listening');
    const item = within(await screen.findByRole('list', { name: 'Retos de escucha' })).getByRole('listitem', { name: 'BBC 6 Minute English' });

    expect(within(item).getByText(/youtube\.com · desde 1:32/)).toBeInTheDocument();
    expect(within(item).getByText("I reckon that's a bit of a stretch")).toBeInTheDocument();
    const listen = within(item).getByRole('link', { name: /Escuchar «BBC 6 Minute English»/ });
    expect(listen).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc&t=92');
    expect(listen).toHaveAttribute('target', '_blank');
  });

  it('guarda un reto convirtiendo "1:32" en 92 segundos', async () => {
    const { calls } = listeningApi();
    renderApp('/listening');
    await fill(/^Título/, 'Friends S01E01');
    await fill(/^Enlace/, 'https://www.youtube.com/watch?v=xyz');
    await fill(/^Empieza en/, '1:32');
    await fill(/^Tu transcripción/, 'How you doin?');
    await userEvent.click(screen.getByRole('button', { name: /Guardar reto/ }));

    expect(await screen.findByText('Reto «Friends S01E01» guardado')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      title: 'Friends S01E01', url: 'https://www.youtube.com/watch?v=xyz', start_seconds: 92, transcription: 'How you doin?', is_active_srs: true,
    });
    expect(screen.getByLabelText(/^Título/)).toHaveValue('');
  });

  it('sin inicio envía null', async () => {
    const { calls } = listeningApi();
    renderApp('/listening');
    await fill(/^Título/, 'Podcast');
    await fill(/^Enlace/, 'https://open.spotify.com/episode/x');
    await fill(/^Tu transcripción/, 'something{Control>}{Enter}{/Control}');

    await screen.findByText('Reto «Podcast» guardado');
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ start_seconds: null });
  });

  it('valida campos obligatorios, la URL y el formato del inicio sin llamar al Backend', async () => {
    const { calls } = listeningApi();
    renderApp('/listening');
    await fill(/^Enlace/, 'ftp://algo');
    await fill(/^Empieza en/, '1:75');
    await userEvent.click(screen.getByRole('button', { name: /Guardar reto/ }));

    expect(screen.getByText('El título es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('La URL debe empezar por http:// o https://')).toBeInTheDocument();
    expect(screen.getByText(/Escribe el inicio como 1:32/)).toBeInTheDocument();
    expect(screen.getByText('La transcripción es obligatoria')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('un error del Backend en el inicio aparece bajo "Empieza en"', async () => {
    listeningApi({
      'POST /api/listening': () => ({
        status: 400,
        json: { error: { code: 'validation_error', message: 'x', details: [{ field: 'start_seconds', message: 'El inicio no puede superar las 24 horas' }] } },
      }),
    });
    renderApp('/listening');
    await fill(/^Título/, 'a');
    await fill(/^Enlace/, 'https://x.com');
    await fill(/^Empieza en/, '99999');
    await fill(/^Tu transcripción/, 'b');
    await userEvent.click(screen.getByRole('button', { name: /Guardar reto/ }));

    expect(await screen.findByText('El inicio no puede superar las 24 horas')).toBeInTheDocument();
  });

  it('editar muestra el inicio como 1:32 y guarda los cambios', async () => {
    const { calls } = listeningApi();
    renderApp('/listening');
    await userEvent.click(await screen.findByRole('button', { name: 'Editar «BBC 6 Minute English»' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar reto' });
    const start = within(dialog).getByLabelText(/^Empieza en/);
    expect(start).toHaveValue('1:32');

    await userEvent.clear(start);
    await userEvent.type(start, '2:05');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Reto actualizado')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ start_seconds: 125 });
  });

  it('busca en título y transcripción', async () => {
    listeningApi();
    renderApp('/listening');
    await screen.findByRole('list', { name: 'Retos de escucha' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar retos' }), 'nada que ver');

    expect(await screen.findByText('Ningún reto coincide con tu búsqueda.')).toBeInTheDocument();
  });

  it('borrar pide confirmación', async () => {
    const { calls } = listeningApi();
    renderApp('/listening');
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar «BBC 6 Minute English»' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Borrar este reto?' })).getByRole('button', { name: 'Borrar' }));

    expect(await screen.findByText('«BBC 6 Minute English» borrado')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
  });
});

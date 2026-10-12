import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeSession, resetAuthMock } from '../test/authMock';
import { installMediaMock, uninstallMediaMock } from '../test/mediaMock';
import { mockApi, renderApp } from '../test/renderApp';

vi.mock('../lib/supabase', async () => (await import('../test/authMock')).supabaseModule);
// La conversión real se prueba en mp3.test.ts; aquí se simula para ir rápido.
vi.mock('../components/speaking/encodeMp3', () => ({
  encodeRecordingToMp3: vi.fn(async (_blob: Blob, onProgress?: (v: number) => void) => {
    onProgress?.(0.5);
    return new Blob(['mp3 simulado'], { type: 'audio/mpeg' });
  }),
}));

const SAVED = {
  id: 's1', title: 'Resumen de mi día', duration_seconds: 312, size_bytes: 2_500_000, recording_limit_minutes: 5,
  is_active_srs: true, due_at: null, created_at: '2026-10-10T18:00:00Z',
};

beforeEach(() => {
  resetAuthMock(fakeSession('tok-speak'));
  vi.unstubAllGlobals();
  installMediaMock();
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => uninstallMediaMock());

function speakingApi(overrides: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /api/speaking': () => ({ json: { items: [SAVED], total: 1 } }),
    'POST /api/speaking': (body) => {
      const form = body as FormData;
      return { status: 201, json: { ...SAVED, id: 's2', title: form.get('title'), duration_seconds: Number(form.get('duration_seconds')) } };
    },
    'GET /api/speaking/s1/audio-url': () => ({ json: { url: 'https://storage.test/s1.mp3?token=x', expires_at: '2026-10-12T12:05:00Z' } }),
    'DELETE /api/speaking/s1': () => ({ status: 204 }),
    ...overrides,
  });
}

/** Graba y detiene; espera a que aparezca la previsualización. */
async function recordAndStop() {
  await userEvent.click(await screen.findByRole('button', { name: 'Grabar' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Detener' }));
  await screen.findByLabelText('Escuchar tu grabación antes de subirla');
}

describe('13.3 · Grabar, previsualizar y subir', () => {
  it('elige la duración, graba y muestra el temporizador con el límite', async () => {
    speakingApi();
    renderApp('/speaking');
    await userEvent.click(await screen.findByRole('button', { name: '3 min' }));
    expect(screen.getByText('de 3:00')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }));
    expect(await screen.findByText(/Grabando… se detendrá sola a los 3 minutos/)).toBeInTheDocument();
    expect(screen.getByRole('timer', { name: 'Tiempo grabado' })).toHaveTextContent('0:00');
    expect(screen.getByRole('button', { name: '5 min' })).toBeDisabled();
  });

  it('al detener prepara el MP3 y permite escucharlo antes de subir (nada se envía todavía)', async () => {
    const { calls } = speakingApi();
    renderApp('/speaking');
    await recordAndStop();

    expect(screen.getByLabelText('Escuchar tu grabación antes de subirla')).toHaveAttribute('src', 'blob:preview');
    expect(screen.getByText(/todavía está solo en tu navegador/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('sin título no sube y lo marca como obligatorio', async () => {
    const { calls } = speakingApi();
    renderApp('/speaking');
    await recordAndStop();
    await userEvent.click(screen.getByRole('button', { name: 'Subir' }));

    expect(screen.getByText('El título es obligatorio')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('"Subir" envía el MP3 con título, duración y límite, y lo pone arriba de la lista', async () => {
    const { calls } = speakingApi();
    renderApp('/speaking');
    await userEvent.click(await screen.findByRole('button', { name: '10 min' }));
    await recordAndStop();
    await userEvent.type(screen.getByLabelText(/^Título/), 'Mi opinión sobre la IA');
    await userEvent.click(screen.getByRole('switch'));
    await userEvent.click(screen.getByRole('button', { name: 'Subir' }));

    expect(await screen.findByText('«Mi opinión sobre la IA» guardado')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST')!;
    const form = post.body as FormData;
    expect(post.auth).toBe('Bearer tok-speak');
    expect((form.get('audio') as File).type).toBe('audio/mpeg');
    expect((form.get('audio') as File).name).toBe('monologo.mp3');
    expect(form.get('title')).toBe('Mi opinión sobre la IA');
    expect(form.get('duration_seconds')).toBe('1');
    expect(form.get('recording_limit_minutes')).toBe('10');
    expect(form.get('is_active_srs')).toBe('false');

    const list = screen.getByRole('list', { name: 'Monólogos guardados' });
    expect(within(list).getAllByRole('listitem')[0]).toHaveAccessibleName('Mi opinión sobre la IA');
    expect(screen.getByRole('button', { name: 'Grabar' })).toBeInTheDocument();
  });

  it('si la subida falla, el audio no se pierde y se puede reintentar', async () => {
    let attempts = 0;
    const { calls } = speakingApi({
      'POST /api/speaking': () => {
        attempts++;
        return attempts === 1
          ? { status: 503, json: { error: { code: 'service_unavailable', message: 'No se pudo subir el audio; inténtalo de nuevo' } } }
          : { status: 201, json: { ...SAVED, id: 's2', title: 'Reintento' } };
      },
    });
    renderApp('/speaking');
    await recordAndStop();
    await userEvent.type(screen.getByLabelText(/^Título/), 'Reintento');
    await userEvent.click(screen.getByRole('button', { name: 'Subir' }));

    expect(await screen.findByText('No se pudo subir el audio; inténtalo de nuevo')).toBeInTheDocument();
    expect(screen.getByLabelText('Escuchar tu grabación antes de subirla')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Título/)).toHaveValue('Reintento');

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar subida' }));
    expect(await screen.findByText('«Reintento» guardado')).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2);
  });

  it('"Descartar" pide confirmación y borra la grabación sin enviar nada', async () => {
    const { calls } = speakingApi();
    renderApp('/speaking');
    await recordAndStop();
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Descartar la grabación?' })).getByRole('button', { name: 'Descartar' }));

    expect(await screen.findByRole('button', { name: 'Grabar' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Escuchar tu grabación antes de subirla')).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('con una grabación sin subir, cerrar la pestaña pide confirmación', async () => {
    speakingApi();
    renderApp('/speaking');
    const beforeUnload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(beforeUnload()).toBe(false);

    await recordAndStop();
    expect(beforeUnload()).toBe(true);
  });

  it('si el micrófono está denegado lo explica', async () => {
    uninstallMediaMock();
    installMediaMock({ deny: true });
    speakingApi();
    renderApp('/speaking');
    await userEvent.click(await screen.findByRole('button', { name: 'Grabar' }));

    expect(await screen.findByText(/no tiene permiso para usar el micrófono/)).toBeInTheDocument();
  });
});

describe('13.4 · Monólogos guardados y reproductor', () => {
  it('lista los monólogos con duración y fecha', async () => {
    speakingApi();
    renderApp('/speaking');
    const item = within(await screen.findByRole('list', { name: 'Monólogos guardados' })).getByRole('listitem', { name: 'Resumen de mi día' });

    expect(within(item).getByText(/5:12/)).toBeInTheDocument();
  });

  it('"Escuchar" pide el enlace temporal y carga el reproductor', async () => {
    const { calls } = speakingApi();
    renderApp('/speaking');
    await userEvent.click(await screen.findByRole('button', { name: 'Escuchar «Resumen de mi día»' }));

    const player = await screen.findByLabelText('Reproductor de «Resumen de mi día»');
    expect(player).toHaveAttribute('src', 'https://storage.test/s1.mp3?token=x');
    expect(calls.some((c) => c.path === '/api/speaking/s1/audio-url')).toBe(true);
  });

  it('si no se puede obtener el enlace lo explica', async () => {
    speakingApi({ 'GET /api/speaking/s1/audio-url': () => ({ status: 503, json: { error: { code: 'service_unavailable', message: 'No se pudo preparar el audio; inténtalo de nuevo' } } }) });
    renderApp('/speaking');
    await userEvent.click(await screen.findByRole('button', { name: 'Escuchar «Resumen de mi día»' }));

    expect(await screen.findByText('No se pudo preparar el audio; inténtalo de nuevo')).toBeInTheDocument();
  });

  it('sin monólogos muestra cómo empezar', async () => {
    mockApi({ 'GET /api/speaking': () => ({ json: { items: [], total: 0 } }) });
    renderApp('/speaking');

    expect(await screen.findByText(/Aún no has grabado ningún monólogo/)).toBeInTheDocument();
  });

  it('borrar pide confirmación y lo quita de la lista', async () => {
    const { calls } = speakingApi();
    renderApp('/speaking');
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar «Resumen de mi día»' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Borrar este monólogo?' })).getByRole('button', { name: 'Borrar' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/speaking/s1')).toBe(true));
    expect(await screen.findByText(/Aún no has grabado ningún monólogo/)).toBeInTheDocument();
  });
});

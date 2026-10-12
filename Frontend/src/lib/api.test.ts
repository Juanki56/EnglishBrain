import { ApiError, createApiClient, fieldErrors, generalMessage, NETWORK_ERROR_MESSAGE } from './api';

function client(response: () => Response | Promise<Response>, token: string | null = 'tok-123') {
  const fetchImpl = vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) => response());
  const onUnauthorized = vi.fn();
  const api = createApiClient({ baseUrl: 'http://api.test', getAccessToken: async () => token, onUnauthorized, fetchImpl: fetchImpl as unknown as typeof fetch });
  return { api, fetchImpl, onUnauthorized };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('createApiClient', () => {
  it('adjunta el token de la sesión y devuelve el JSON', async () => {
    const { api, fetchImpl } = client(() => json(200, { id: 'u1' }));
    const data = await api.get<{ id: string }>('/api/me');

    expect(data).toEqual({ id: 'u1' });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe('http://api.test/api/me');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('sin sesión no envía cabecera Authorization', async () => {
    const { api, fetchImpl } = client(() => json(200, {}), null);
    await api.get('/api/health');

    expect((fetchImpl.mock.calls[0]![1]!.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('envía el cuerpo como JSON y añade los parámetros de búsqueda no vacíos', async () => {
    const { api, fetchImpl } = client(() => json(201, { ok: true }));
    await api.post('/api/vocabulary', { word: 'give up' });
    await api.get('/api/vocabulary', { query: { status: 'learning', q: '', limit: 5, type: undefined } });

    const [, postInit] = fetchImpl.mock.calls[0]!;
    expect(postInit!.body).toBe('{"word":"give up"}');
    expect((postInit!.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(String(fetchImpl.mock.calls[1]![0])).toBe('http://api.test/api/vocabulary?status=learning&limit=5');
  });

  it('una respuesta 204 devuelve undefined', async () => {
    const { api } = client(() => new Response(null, { status: 204 }));

    await expect(api.delete('/api/vocabulary/x')).resolves.toBeUndefined();
  });

  it('traduce { error } del Backend a ApiError con sus detalles', async () => {
    const { api } = client(() =>
      json(400, { error: { code: 'validation_error', message: 'Los datos enviados no son válidos', details: [{ field: 'word', message: 'La palabra es obligatoria' }] } }),
    );

    await expect(api.post('/api/vocabulary', {})).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'validation_error',
      details: [{ field: 'word', message: 'La palabra es obligatoria' }],
    });
  });

  it('un 401 avisa para cerrar la sesión y llevar al login', async () => {
    const { api, onUnauthorized } = client(() => json(401, { error: { code: 'unauthorized', message: 'Necesitas iniciar sesión' } }));

    await expect(api.get('/api/me')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('otros errores no cierran la sesión', async () => {
    const { api, onUnauthorized } = client(() => json(404, { error: { code: 'not_found', message: 'Recurso no encontrado' } }));

    await expect(api.get('/api/vocabulary/x')).rejects.toMatchObject({ status: 404 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('si el Backend no responde, el error lo explica en español', async () => {
    const { api } = client(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(api.get('/api/me')).rejects.toMatchObject({ status: 0, code: 'network_error', message: NETWORK_ERROR_MESSAGE });
  });

  it('una respuesta de error sin JSON tiene un mensaje genérico', async () => {
    const { api } = client(() => new Response('Bad Gateway', { status: 502 }));

    await expect(api.get('/api/me')).rejects.toMatchObject({ code: 'http_error', message: 'El servidor respondió con un error (502)' });
  });
});

describe('fieldErrors / generalMessage', () => {
  const error = new ApiError(400, 'validation_error', 'Los datos enviados no son válidos', [
    { field: 'word', message: 'La palabra es obligatoria' },
    { field: '_general', message: 'Envía al menos un campo para editar' },
  ]);

  it('fieldErrors da un mensaje por campo (sin el general)', () => {
    expect(fieldErrors(error)).toEqual({ word: 'La palabra es obligatoria' });
    expect(fieldErrors(new Error('x'))).toEqual({});
  });

  it('generalMessage prefiere el detalle _general y si no el mensaje del error', () => {
    expect(generalMessage(error)).toBe('Envía al menos un campo para editar');
    expect(generalMessage(new ApiError(404, 'not_found', 'Recurso no encontrado'))).toBe('Recurso no encontrado');
    expect(generalMessage(new Error('boom'))).toBe('Ocurrió un error inesperado. Inténtalo de nuevo.');
  });
});

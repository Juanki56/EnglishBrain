import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authMock, fakeSession, resetAuthMock } from '../test/authMock';
import { mockApi, renderApp } from '../test/renderApp';

vi.mock('../lib/supabase', async () => (await import('../test/authMock')).supabaseModule);

const profile = { id: 'u1', email: 'juan@example.com', display_name: 'Juan', timezone: 'America/Bogota', created_at: 'x', updated_at: 'x' };
const activeToken = { id: 't1', label: 'Chrome portátil', last4: 'AbCd', created_at: '2026-10-01T10:00:00Z', last_used_at: null, revoked_at: null };
const FULL_TOKEN = `ebk_${'Z'.repeat(39)}WxYz`;

beforeEach(() => {
  resetAuthMock(fakeSession('tok-profile'));
  vi.unstubAllGlobals();
});

function standardApi(overrides: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /api/me': () => ({ json: profile }),
    'GET /api/me/capture-tokens': () => ({ json: [activeToken] }),
    ...overrides,
  });
}

describe('10.5 · Perfil', () => {
  it('carga el perfil con la sesión del usuario', async () => {
    const { calls } = standardApi();
    renderApp('/profile');

    expect(await screen.findByDisplayValue('Juan')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('juan@example.com');
    expect(screen.getByLabelText('Zona horaria')).toHaveValue('America/Bogota');
    expect(calls.find((c) => c.path === '/api/me')?.auth).toBe('Bearer tok-profile');
  });

  it('guarda nombre y zona horaria con PATCH /api/me', async () => {
    const { calls } = standardApi({
      'PATCH /api/me': (body) => ({ json: { ...profile, ...(body as object) } }),
    });
    renderApp('/profile');
    const name = await screen.findByDisplayValue('Juan');
    await userEvent.clear(name);
    await userEvent.type(name, 'Juan Abello');
    await userEvent.selectOptions(screen.getByLabelText('Zona horaria'), 'Europe/Madrid');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Perfil guardado')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ display_name: 'Juan Abello', timezone: 'Europe/Madrid' });
  });

  it('muestra bajo el campo el error que devuelve el Backend', async () => {
    standardApi({
      'PATCH /api/me': () => ({
        status: 400,
        json: { error: { code: 'validation_error', message: 'Los datos enviados no son válidos', details: [{ field: 'display_name', message: 'El nombre admite como máximo 60 caracteres' }] } },
      }),
    });
    renderApp('/profile');
    await screen.findByDisplayValue('Juan');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('El nombre admite como máximo 60 caracteres')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre visible')).toHaveAttribute('aria-invalid', 'true');
  });

  it('lista los tokens sin mostrar el token completo', async () => {
    standardApi();
    renderApp('/profile');
    const table = await screen.findByRole('table', { name: 'Tokens de la extensión' });

    expect(await within(table).findByText('Chrome portátil')).toBeInTheDocument();
    expect(within(table).getByText('ebk_…AbCd')).toBeInTheDocument();
    expect(within(table).getByText('Nunca')).toBeInTheDocument();
    expect(within(table).getByText('Activo')).toBeInTheDocument();
  });

  it('generar un token lo muestra una sola vez en una ventana con botón de copiar', async () => {
    let created = false;
    const { calls } = standardApi({
      'POST /api/me/capture-tokens': () => {
        created = true;
        return { status: 201, json: { ...activeToken, id: 't2', label: 'Chrome del trabajo', last4: 'WxYz', token: FULL_TOKEN } };
      },
      'GET /api/me/capture-tokens': () => ({ json: created ? [activeToken, { ...activeToken, id: 't2', label: 'Chrome del trabajo', last4: 'WxYz' }] : [activeToken] }),
    });
    renderApp('/profile');
    await userEvent.type(await screen.findByLabelText('Nombre del token'), 'Chrome del trabajo');
    await userEvent.click(screen.getByRole('button', { name: 'Generar token' }));

    const dialog = await screen.findByRole('dialog', { name: 'Tu token nuevo' });
    expect(within(dialog).getByTestId('new-token')).toHaveTextContent(FULL_TOKEN);
    expect(within(dialog).getByText(/no se volverá a mostrar/)).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ label: 'Chrome del trabajo' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Ya lo he copiado' }));
    expect(screen.queryByText(FULL_TOKEN)).not.toBeInTheDocument();
    expect(await screen.findByText('ebk_…WxYz')).toBeInTheDocument();
  });

  it('una etiqueta vacía muestra el error del Backend bajo el campo', async () => {
    standardApi({
      'POST /api/me/capture-tokens': () => ({
        status: 400,
        json: { error: { code: 'validation_error', message: 'x', details: [{ field: 'label', message: 'La etiqueta es obligatoria' }] } },
      }),
    });
    renderApp('/profile');
    await userEvent.click(await screen.findByRole('button', { name: 'Generar token' }));

    expect(await screen.findByText('La etiqueta es obligatoria')).toBeInTheDocument();
  });

  it('revocar pide confirmación y llama a DELETE', async () => {
    let revoked = false;
    const { calls } = standardApi({
      'DELETE /api/me/capture-tokens/t1': () => {
        revoked = true;
        return { status: 204 };
      },
      'GET /api/me/capture-tokens': () => ({ json: [{ ...activeToken, revoked_at: revoked ? '2026-10-12T10:00:00Z' : null }] }),
    });
    renderApp('/profile');
    const table = await screen.findByRole('table', { name: 'Tokens de la extensión' });
    await userEvent.click(await within(table).findByRole('button', { name: 'Revocar' }));

    const dialog = await screen.findByRole('dialog', { name: '¿Revocar este token?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revocar' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/me/capture-tokens/t1')).toBe(true));
    expect(await screen.findByText('Token "Chrome portátil" revocado')).toBeInTheDocument();
    expect(await within(table).findByText('Revocado')).toBeInTheDocument();
  });

  it('si la sesión caduca (401), cierra la sesión y lleva al login', async () => {
    mockApi({
      'GET /api/me': () => ({ status: 401, json: { error: { code: 'unauthorized', message: 'Tu sesión no es válida o ha caducado' } } }),
      'GET /api/me/capture-tokens': () => ({ status: 401, json: { error: { code: 'unauthorized', message: 'x' } } }),
    });
    renderApp('/profile');

    expect(await screen.findByText('Tu sesión ha caducado; vuelve a entrar.')).toBeInTheDocument();
    expect(authMock.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('si el Backend está apagado lo explica', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    renderApp('/profile');

    expect(await screen.findAllByText('No se pudo conectar con el servidor. ¿Está encendido el Backend?')).not.toHaveLength(0);
  });
});

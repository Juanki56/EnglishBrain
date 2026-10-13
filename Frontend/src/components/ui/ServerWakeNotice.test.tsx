import { act, render, screen, waitFor } from '@testing-library/react';
import { serverWake } from '../../lib/serverWake';
import { fakeSession, resetAuthMock } from '../../test/authMock';
import { renderApp } from '../../test/renderApp';
import { ServerWakeNotice } from './ServerWakeNotice';

vi.mock('../../lib/supabase', async () => (await import('../../test/authMock')).supabaseModule);

beforeEach(() => {
  serverWake.reset();
  resetAuthMock(fakeSession('tok-wake'));
  vi.unstubAllGlobals();
});

describe('2.2 · Aviso «Despertando el servidor…»', () => {
  it('se muestra mientras quede alguna petición lenta y se retira al terminar todas', () => {
    render(<ServerWakeNotice />);
    expect(screen.queryByRole('status', { name: 'Despertando el servidor' })).not.toBeInTheDocument();

    act(() => { serverWake.start(); serverWake.start(); });
    expect(screen.getByRole('status', { name: 'Despertando el servidor' })).toHaveTextContent('puede tardar hasta un minuto');

    act(() => serverWake.end());
    expect(screen.getByRole('status', { name: 'Despertando el servidor' })).toBeInTheDocument();
    act(() => serverWake.end());
    expect(screen.queryByRole('status', { name: 'Despertando el servidor' })).not.toBeInTheDocument();
  });

  it('una petición real de más de 4 s lo muestra (también en la sesión Anki) y desaparece al responder', async () => {
    let respond!: () => void;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      const body = path === '/api/srs/queue' ? { items: [], total: 0 } : {};
      const response = () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      // La cola de Anki tarda: el servidor «está despertando».
      if (path === '/api/srs/queue') return new Promise<Response>((resolve) => { respond = () => resolve(response()); });
      return Promise.resolve(response());
    }));
    renderApp('/review');

    expect(await screen.findByRole('status', { name: 'Despertando el servidor' }, { timeout: 6000 })).toBeInTheDocument();
    respond();

    await waitFor(() => expect(screen.queryByRole('status', { name: 'Despertando el servidor' })).not.toBeInTheDocument());
    expect(await screen.findByRole('heading', { name: '¡Estás al día!' })).toBeInTheDocument();
  });
});

import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from '../App';
import { SessionProvider } from '../auth/SessionProvider';
import { ToastProvider } from '../components/ui/Toast';

/** Monta la app completa en una ruta, con sesión y avisos (requiere el mock de Supabase). */
export function renderApp(path: string, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path.split('?')[0], search: path.includes('?') ? `?${path.split('?')[1]}` : '', state }]}>
      <SessionProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </SessionProvider>
    </MemoryRouter>,
  );
}

type Handler = (body: unknown, url: URL) => { status?: number; json?: unknown };

/** Sustituye fetch por respuestas fijas por "MÉTODO /ruta" y registra las llamadas. */
export function mockApi(routes: Record<string, Handler>) {
  const calls: Array<{ method: string; path: string; body: unknown; auth: string | null }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    const auth = new Headers(init.headers).get('Authorization');
    calls.push({ method, path: url.pathname, body, auth });
    const handler = routes[`${method} ${url.pathname}`];
    if (!handler) return new Response(JSON.stringify({ error: { code: 'not_found', message: 'sin mock' } }), { status: 404 });
    const { status = 200, json } = handler(body, url);
    return new Response(status === 204 ? null : JSON.stringify(json ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

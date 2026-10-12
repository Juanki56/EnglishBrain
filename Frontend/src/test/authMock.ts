import type { Session } from '@supabase/supabase-js';
import { vi } from 'vitest';

/**
 * Supabase Auth simulado para las pruebas. Se usa con:
 *   vi.mock('../lib/supabase', async () => (await import('../test/authMock')).supabaseModule);
 */
type Listener = (event: string, session: Session | null) => void;

const listeners = new Set<Listener>();
let currentSession: Session | null = null;

const ok = async () => ({ data: {}, error: null as null | { code?: string; name?: string; message: string } });

export const authMock = {
  getSession: vi.fn(async () => ({ data: { session: currentSession } })),
  onAuthStateChange: vi.fn((listener: Listener) => {
    listeners.add(listener);
    return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
  }),
  signUp: vi.fn(ok),
  signInWithPassword: vi.fn(async (_: { email: string; password: string }) => {
    setSession(fakeSession());
    return { data: { session: currentSession }, error: null as null | { code?: string; message: string } };
  }),
  signOut: vi.fn(async (_options?: { scope?: string }) => {
    setSession(null, 'SIGNED_OUT');
    return { error: null };
  }),
  resetPasswordForEmail: vi.fn(ok),
  updateUser: vi.fn(ok),
  resend: vi.fn(ok),
};

export function fakeSession(token = 'access-token-test'): Session {
  return { access_token: token, refresh_token: 'refresh', token_type: 'bearer', expires_in: 3600, user: { id: 'user-1', email: 'a@example.com' } } as unknown as Session;
}

/** Cambia la sesión y avisa a los suscriptores, como haría Supabase. */
export function setSession(session: Session | null, event = session ? 'SIGNED_IN' : 'SIGNED_OUT') {
  currentSession = session;
  for (const listener of listeners) listener(event, session);
}

/** Estado inicial antes de cada prueba (sin sesión y mocks limpios). */
export function resetAuthMock(session: Session | null = null) {
  currentSession = session;
  listeners.clear();
  for (const fn of Object.values(authMock)) fn.mockClear();
}

export const supabaseModule = {
  supabase: { auth: authMock },
  appOrigin: () => 'http://localhost:5173',
};

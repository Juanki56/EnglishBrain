import { use } from 'react';
import { SessionContext, type SessionState } from '../auth/SessionProvider';

/** Sesión actual: `const { session, loading } = useSession()`. */
export function useSession(): SessionState {
  const state = use(SessionContext);
  if (!state) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return state;
}

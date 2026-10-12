import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface SessionState {
  session: Session | null;
  /** true mientras se recupera la sesión guardada al abrir la app. */
  loading: boolean;
  /** true si el usuario llegó desde el enlace de "recuperar contraseña". */
  recovering: boolean;
  /** true si la sesión se cerró porque el Backend la rechazó (401). */
  expired: boolean;
  /** Cierra la sesión local marcándola como caducada (el login lo avisa). */
  expireSession: () => Promise<void>;
}

export const SessionContext = createContext<SessionState | null>(null);

/** Mantiene la sesión de Supabase Auth al día (login, logout, refresco, recuperación). */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_IN') setExpired(false);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const expireSession = useCallback(async () => {
    setExpired(true);
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const value = useMemo(
    () => ({ session, loading, recovering, expired, expireSession }),
    [session, loading, recovering, expired, expireSession],
  );
  return <SessionContext value={value}>{children}</SessionContext>;
}

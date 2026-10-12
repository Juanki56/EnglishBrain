import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { FormAlert } from '../components/ui/FormAlert';
import { FullPageSpinner } from '../components/ui/FullPageSpinner';
import { useSession } from '../hooks/useSession';

/** Tiempo máximo para canjear el enlace del correo antes de mostrar el error. */
export const CALLBACK_TIMEOUT_MS = 8000;

/**
 * Destino del enlace de confirmación (/auth/callback). Supabase canjea el
 * código del enlace al cargar la página; en cuanto hay sesión, entra al panel.
 */
export function AuthCallbackView() {
  const navigate = useNavigate();
  const { session } = useSession();
  const urlError = new URLSearchParams(window.location.search).get('error_description')
    ?? new URLSearchParams(window.location.hash.slice(1)).get('error_description');
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (session) navigate('/', { replace: true });
  }, [session, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), CALLBACK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  if (urlError || timedOut) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Este enlace ya no sirve</h1>
        <FormAlert>El enlace no es válido o ha caducado.</FormAlert>
        <p className="text-sm text-neutral-700">
          Cada enlace funciona <strong>una sola vez</strong>. Si ya lo habías abierto antes, tu cuenta probablemente
          ya está confirmada: inicia sesión con tu email y contraseña. Si te dice que falta confirmar, desde ahí
          puedes pedir un correo nuevo.
        </p>
        <Link
          to="/login"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }
  return <FullPageSpinner label="Confirmando tu cuenta…" />;
}

import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Cliente de Supabase con la publishable key, SOLO para Auth (registro, login,
 * confirmación, recuperación y refresco de sesión). Los datos siempre pasan por
 * el Backend (design D2): este cliente nunca consulta tablas ni Storage.
 */
export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Los enlaces de los correos traen un código que se canjea al abrir la página.
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

/** Dirección pública actual de la app (localhost en desarrollo, el dominio real al desplegar). */
export const appOrigin = () => window.location.origin;

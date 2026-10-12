/**
 * Variables de entorno del Frontend (Frontend/.env). Solo las que empiezan por
 * VITE_ llegan al navegador; aquí nunca va la secret key de Supabase.
 */
function required(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`Falta la variable ${name} en Frontend/.env. Copia .env.example a .env y complétala.`);
  }
  return value.trim();
}

export const env = {
  apiUrl: required('VITE_API_URL', import.meta.env.VITE_API_URL).replace(/\/+$/, ''),
  supabaseUrl: required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  supabasePublishableKey: required('VITE_SUPABASE_PUBLISHABLE_KEY', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
};

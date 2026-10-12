/** Errores de Supabase Auth traducidos a mensajes claros en español. */
interface AuthLikeError {
  code?: string;
  name?: string;
  message?: string;
  status?: number;
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email o contraseña incorrectos',
  email_not_confirmed: 'Tienes que confirmar tu email antes de entrar. Revisa tu bandeja de entrada.',
  weak_password: 'La contraseña es demasiado débil; usa al menos 8 caracteres combinando letras y números',
  same_password: 'La nueva contraseña debe ser distinta de la anterior',
  over_email_send_rate_limit: 'Se han enviado demasiados correos. Espera unos minutos y vuelve a intentarlo.',
  over_request_rate_limit: 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.',
  email_address_invalid: 'El email no es válido',
  signup_disabled: 'El registro de cuentas nuevas está desactivado',
  otp_expired: 'El enlace no es válido o ha caducado',
  flow_state_expired: 'El enlace no es válido o ha caducado',
  session_not_found: 'Tu sesión ha caducado; vuelve a entrar',
};

export function authErrorMessage(error: AuthLikeError | null | undefined): string {
  if (!error) return '';
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code]!;
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return 'No se pudo conectar con el servicio de cuentas. Revisa tu conexión e inténtalo de nuevo.';
  }
  return 'No se pudo completar la operación. Inténtalo de nuevo.';
}

/** Validaciones de formulario comunes (mensajes por campo, como el Backend). */
export const validate = {
  email(value: string): string | undefined {
    if (!value.trim()) return 'El email es obligatorio';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'El email no es válido';
    return undefined;
  },
  password(value: string): string | undefined {
    if (!value) return 'La contraseña es obligatoria';
    if (value.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    return undefined;
  },
};

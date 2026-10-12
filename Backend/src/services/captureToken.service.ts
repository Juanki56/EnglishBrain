import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { throwIfError } from './db.js';
import { scoped } from './scoped.js';

/**
 * Tokens personales de la extensión de Chrome (design D3, spec user-accounts).
 * Formato: "ebk_" + 32 bytes aleatorios en base64url (43 caracteres).
 * En la base de datos solo se guarda su SHA-256 y los últimos 4 caracteres.
 */
export const CAPTURE_TOKEN_PATTERN = /^ebk_[A-Za-z0-9_-]{43}$/;

/** Datos públicos de un token: nunca incluyen el token ni su hash. */
export interface CaptureTokenInfo {
  id: string;
  label: string;
  last4: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const PUBLIC_COLUMNS = 'id, label, last4, created_at, last_used_at, revoked_at';

export function generateCaptureToken(): string {
  return `ebk_${randomBytes(32).toString('base64url')}`;
}

export function hashCaptureToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const tokens = (supabase: SupabaseClient, userId: string) => scoped(supabase, 'capture_tokens', userId);

export async function listCaptureTokens(supabase: SupabaseClient, userId: string): Promise<CaptureTokenInfo[]> {
  const { data, error } = await tokens(supabase, userId)
    .select(PUBLIC_COLUMNS)
    .order('created_at', { ascending: false });
  throwIfError(error);
  return (data ?? []) as unknown as CaptureTokenInfo[];
}

/** Crea un token y lo devuelve completo. Es la única vez que se puede ver. */
export async function createCaptureToken(
  supabase: SupabaseClient,
  userId: string,
  label: string,
): Promise<CaptureTokenInfo & { token: string }> {
  const token = generateCaptureToken();
  const { data, error } = await tokens(supabase, userId)
    .insert({ label, token_hash: hashCaptureToken(token), last4: token.slice(-4) })
    .select(PUBLIC_COLUMNS)
    .single();
  throwIfError(error);
  return { ...(data as unknown as CaptureTokenInfo), token };
}

/** Revoca un token propio. Revocar uno ya revocado no cambia nada. 404 si no es del usuario. */
export async function revokeCaptureToken(supabase: SupabaseClient, userId: string, tokenId: string): Promise<void> {
  const current = await tokens(supabase, userId).findById<Pick<CaptureTokenInfo, 'id' | 'revoked_at'>>(
    tokenId,
    'id, revoked_at',
  );
  if (current.revoked_at) return;

  const { error } = await tokens(supabase, userId)
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId);
  throwIfError(error);
}

/**
 * Busca el dueño de un token de extensión activo. Es la única consulta sin
 * scoped(): aquí aún no se sabe quién es el usuario; se busca por el hash.
 */
export async function findActiveCaptureToken(
  supabase: SupabaseClient,
  token: string,
): Promise<{ tokenId: string; userId: string } | null> {
  if (!CAPTURE_TOKEN_PATTERN.test(token)) return null;

  const { data, error } = await supabase
    .from('capture_tokens')
    .select('id, user_id, revoked_at')
    .eq('token_hash', hashCaptureToken(token))
    .maybeSingle();
  throwIfError(error);

  const row = data as { id: string; user_id: string; revoked_at: string | null } | null;
  if (!row || row.revoked_at) return null;
  return { tokenId: row.id, userId: row.user_id };
}

/** Registra el último uso de un token. Un fallo aquí no debe bloquear la captura. */
export async function touchCaptureToken(supabase: SupabaseClient, tokenId: string): Promise<void> {
  const { error } = await supabase
    .from('capture_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', tokenId);
  if (error) console.error('[capture_tokens] no se pudo registrar el último uso', error);
}

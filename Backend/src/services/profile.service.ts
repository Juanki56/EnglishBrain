import type { SupabaseClient } from '@supabase/supabase-js';
import { throwIfError } from './db.js';
import { scoped } from './scoped.js';

export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileChanges {
  display_name?: string | null;
  timezone?: string;
}

const PROFILE_COLUMNS = 'id, display_name, timezone, created_at, updated_at';

const profiles = (supabase: SupabaseClient, userId: string) => scoped(supabase, 'profiles', userId, 'id');

/**
 * Perfil del usuario. El trigger on_auth_user_created lo crea al registrarse;
 * si aun así faltara, se crea aquí con los valores por defecto.
 */
export async function getProfile(supabase: SupabaseClient, userId: string): Promise<Profile> {
  const existing = await profiles(supabase, userId).select(PROFILE_COLUMNS).maybeSingle();
  throwIfError(existing.error);
  if (existing.data) return existing.data as unknown as Profile;

  const created = await profiles(supabase, userId).insert({}).select(PROFILE_COLUMNS).single();
  throwIfError(created.error);
  return created.data as unknown as Profile;
}

export async function updateProfile(supabase: SupabaseClient, userId: string, changes: ProfileChanges): Promise<Profile> {
  const { data, error } = await profiles(supabase, userId).update({ ...changes }).select(PROFILE_COLUMNS).single();
  throwIfError(error);
  return data as unknown as Profile;
}

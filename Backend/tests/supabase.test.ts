import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createSupabaseAdmin } from '../src/services/supabase.js';

describe('createSupabaseAdmin', () => {
  it('crea un cliente de servidor sin hacer peticiones de red', () => {
    const client = createSupabaseAdmin({
      supabaseUrl: 'https://ujipnxeaipreyjcnoean.supabase.co',
      supabaseSecretKey: 'sb_secret_test_value',
    });

    expect(typeof client.from).toBe('function');
    expect(typeof client.storage.from).toBe('function');
    expect(typeof client.auth.getUser).toBe('function');
  });

  it('createApp comparte el cliente en app.locals.supabase', () => {
    const supabase = createSupabaseAdmin({
      supabaseUrl: 'https://ujipnxeaipreyjcnoean.supabase.co',
      supabaseSecretKey: 'sb_secret_test_value',
    });

    expect(createApp({ supabase }).locals.supabase).toBe(supabase);
  });
});

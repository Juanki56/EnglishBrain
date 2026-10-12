import type { Request, Response } from 'express';
import { z } from 'zod';
import { getUserId } from '../middlewares/auth.js';
import { getProfile, updateProfile } from '../services/profile.service.js';
import { getSupabase } from '../services/supabase.js';
import { canonicalTimeZone, parse } from '../validation.js';

const updateProfileSchema = z
  .object({
    display_name: z
      .string({ error: 'El nombre debe ser un texto' })
      .trim()
      .min(1, { error: 'El nombre no puede estar vacío' })
      .max(60, { error: 'El nombre admite como máximo 60 caracteres' })
      .nullable()
      .optional(),
    timezone: z
      .string({ error: 'La zona horaria debe ser un texto, p. ej. America/Bogota' })
      .trim()
      .transform((value, ctx) => {
        const canonical = canonicalTimeZone(value);
        if (!canonical) {
          ctx.addIssue({ code: 'custom', message: 'Zona horaria IANA inválida, p. ej. America/Bogota' });
          return z.NEVER;
        }
        return canonical;
      })
      .optional(),
  })
  .refine((body) => body.display_name !== undefined || body.timezone !== undefined, {
    error: 'Envía al menos display_name o timezone',
  });

/** GET /api/me · perfil del usuario autenticado. */
export async function getMe(req: Request, res: Response): Promise<void> {
  const profile = await getProfile(getSupabase(req), getUserId(req));
  res.json({ ...profile, email: req.userEmail ?? null });
}

/** PATCH /api/me · cambia nombre visible y/o zona horaria. */
export async function patchMe(req: Request, res: Response): Promise<void> {
  const changes = parse(updateProfileSchema, req.body);
  const profile = await updateProfile(getSupabase(req), getUserId(req), changes);
  res.json({ ...profile, email: req.userEmail ?? null });
}

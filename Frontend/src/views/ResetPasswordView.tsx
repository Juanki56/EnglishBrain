import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AuthHeader } from '../components/ui/AuthLayout';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { FullPageSpinner } from '../components/ui/FullPageSpinner';
import { Input } from '../components/ui/Input';
import { useSession } from '../hooks/useSession';
import { useToast } from '../hooks/useToast';
import { authErrorMessage, validate } from '../lib/authErrors';
import { supabase } from '../lib/supabase';

export const RESET_LINK_TIMEOUT_MS = 8000;

/**
 * Nueva contraseña desde el enlace del correo (/reset-password). El enlace abre
 * una sesión temporal de recuperación; sin ella, el enlace no es válido.
 */
export function ResetPasswordView() {
  const navigate = useNavigate();
  const toast = useToast();
  const { session } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (session) return;
    const timer = setTimeout(() => setTimedOut(true), RESET_LINK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [session]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = {
      password: validate.password(password),
      confirm: confirm === password ? undefined : 'Las contraseñas no coinciden',
    };
    setErrors(nextErrors);
    setFormError('');
    if (nextErrors.password || nextErrors.confirm) return;

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    toast.show('Contraseña actualizada. Ya puedes usarla para entrar.');
    navigate('/', { replace: true });
  }

  if (!session) {
    if (!timedOut) return <FullPageSpinner label="Comprobando el enlace…" />;
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Enlace no válido</h1>
        <FormAlert>El enlace no es válido o ha caducado. Pide uno nuevo y ábrelo en este mismo navegador.</FormAlert>
        <Link to="/forgot-password" className="text-center text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline">Pedir un enlace nuevo</Link>
      </div>
    );
  }

  return (
    <>
      <AuthHeader title="Crea una contraseña nueva" />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        <Input label="Nueva contraseña" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="Mínimo 8 caracteres." autoComplete="new-password" autoFocus />
        <Input label="Repite la contraseña" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} autoComplete="new-password" />
        <Button type="submit" loading={submitting} className="w-full">Guardar contraseña</Button>
      </form>
    </>
  );
}

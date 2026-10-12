import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { AuthHeader } from '../components/ui/AuthLayout';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { Input } from '../components/ui/Input';
import { authErrorMessage, validate } from '../lib/authErrors';
import { appOrigin, supabase } from '../lib/supabase';

interface LoginState {
  from?: string;
  expired?: boolean;
}

/** Inicio de sesión (spec user-accounts): error genérico y aviso de email sin confirmar. */
export function LoginView() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LoginState | null) ?? {};
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [notice, setNotice] = useState(state.expired ? 'Tu sesión ha caducado; vuelve a entrar.' : '');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = { email: validate.email(email), password: password ? undefined : 'La contraseña es obligatoria' };
    setErrors(nextErrors);
    setFormError('');
    setNotice('');
    setUnconfirmed(false);
    if (nextErrors.email || nextErrors.password) return;

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);

    if (error) {
      setUnconfirmed(error.code === 'email_not_confirmed');
      setFormError(authErrorMessage(error));
      return;
    }
    navigate(state.from ?? '/', { replace: true });
  }

  async function resendConfirmation() {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: `${appOrigin()}/auth/callback` } });
    setFormError('');
    setUnconfirmed(false);
    if (error) setFormError(authErrorMessage(error));
    else setNotice('Te hemos enviado otra vez el correo de confirmación.');
  }

  return (
    <>
      <AuthHeader title="Inicia sesión" subtitle="Bienvenido de nuevo a tu cerebro de inglés." />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {notice && <FormAlert variant="success">{notice}</FormAlert>}
        {formError && (
          <FormAlert>
            {formError}
            {unconfirmed && (
              <button type="button" onClick={resendConfirmation} className="mt-1 block font-medium underline hover:no-underline">
                Reenviar correo de confirmación
              </button>
            )}
          </FormAlert>
        )}
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoComplete="email" autoFocus />
        <Input label="Contraseña" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} autoComplete="current-password" />
        <div className="-mt-1 text-right">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline">¿Olvidaste tu contraseña?</Link>
        </div>
        <Button type="submit" loading={submitting} className="w-full">Entrar</Button>
      </form>
      <p className="mt-6 text-center text-sm text-neutral-600">
        ¿No tienes cuenta?{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700 hover:underline">Crea una</Link>
      </p>
    </>
  );
}

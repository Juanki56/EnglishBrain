import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { AuthHeader } from '../components/ui/AuthLayout';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { Input } from '../components/ui/Input';
import { authErrorMessage, validate } from '../lib/authErrors';
import { appOrigin, supabase } from '../lib/supabase';

export const RESET_SENT_MESSAGE = 'Si el email existe, recibirás un enlace para crear una contraseña nueva.';

/** Solicitud de recuperación (spec user-accounts): misma respuesta exista o no el email. */
export function ForgotPasswordView() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const emailError = validate.email(email);
    setError(emailError);
    setFormError('');
    if (emailError) return;

    setSubmitting(true);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${appOrigin()}/reset-password`,
    });
    setSubmitting(false);

    // Solo se muestran errores que no revelan si la cuenta existe (límite de envíos o red);
    // cualquier otro caso recibe el mismo mensaje que un envío correcto.
    const safeToShow =
      authError &&
      (['over_email_send_rate_limit', 'over_request_rate_limit'].includes(authError.code ?? '') ||
        authError.name === 'AuthRetryableFetchError');
    if (safeToShow) {
      setFormError(authErrorMessage(authError));
      return;
    }
    setSent(true);
  }

  return (
    <>
      <AuthHeader title="Recupera tu contraseña" subtitle="Te enviaremos un enlace para crear una nueva." />
      {sent ? (
        <FormAlert variant="success">{RESET_SENT_MESSAGE}</FormAlert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {formError && <FormAlert>{formError}</FormAlert>}
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={error} autoComplete="email" autoFocus />
          <Button type="submit" loading={submitting} className="w-full">Enviar enlace</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700 hover:underline">Volver a iniciar sesión</Link>
      </p>
    </>
  );
}

import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { authErrorMessage } from '../lib/authErrors';
import { appOrigin, supabase } from '../lib/supabase';

/** "Revisa tu email para confirmar tu cuenta" (spec user-accounts). */
export function CheckEmailView() {
  const email = (useLocation().state as { email?: string } | null)?.email;
  const [status, setStatus] = useState<{ variant: 'error' | 'success'; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  async function resend() {
    if (!email) return;
    setSending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${appOrigin()}/auth/callback` } });
    setSending(false);
    setStatus(error ? { variant: 'error', text: authErrorMessage(error) } : { variant: 'success', text: 'Te hemos enviado el correo otra vez.' });
  }

  return (
    <div className="text-center">
      <MailCheck className="mx-auto mb-4 text-brand-600" size={40} aria-hidden />
      <h1 className="text-xl font-semibold tracking-tight">Revisa tu email para confirmar tu cuenta</h1>
      <p className="mt-2 text-sm text-neutral-600">
        {email ? <>Te enviamos un enlace a <strong className="text-neutral-800">{email}</strong>.</> : 'Te enviamos un enlace de confirmación.'}{' '}
        Ábrelo en este mismo navegador para entrar.
      </p>
      <p className="mt-3 text-xs text-neutral-500">¿No llega? Mira en spam. Puede tardar unos minutos.</p>

      {status && <div className="mt-5 text-left"><FormAlert variant={status.variant}>{status.text}</FormAlert></div>}

      <div className="mt-6 flex flex-col gap-2">
        {email && <Button variant="secondary" onClick={resend} loading={sending}>Reenviar correo</Button>}
        <Link to="/login" className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline">Volver a iniciar sesión</Link>
      </div>
    </div>
  );
}

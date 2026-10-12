import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AuthHeader } from '../components/ui/AuthLayout';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { Input } from '../components/ui/Input';
import { authErrorMessage, validate } from '../lib/authErrors';
import { appOrigin, supabase } from '../lib/supabase';

type Errors = Partial<Record<'display_name' | 'email' | 'password', string>>;

/** Registro con email y contraseña (spec user-accounts). Envía el correo de confirmación. */
export function RegisterView() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Errors = {
      email: validate.email(email),
      password: validate.password(password),
      display_name: displayName.trim().length > 60 ? 'El nombre admite como máximo 60 caracteres' : undefined,
    };
    setErrors(nextErrors);
    setFormError('');
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${appOrigin()}/auth/callback`,
        // El trigger on_auth_user_created crea el perfil con estos datos.
        data: {
          display_name: displayName.trim() || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    });
    setSubmitting(false);

    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    // Mismo mensaje exista o no la cuenta: no se revela qué emails están registrados.
    navigate('/register/check-email', { state: { email: email.trim() } });
  }

  return (
    <>
      <AuthHeader title="Crea tu cuenta" subtitle="Tu cerebro de inglés: vocabulario, errores, speaking, writing y listening." />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        <Input label="Nombre" value={displayName} onChange={(e) => setDisplayName(e.target.value)} error={errors.display_name} hint="Opcional. Así te saludará la app." autoComplete="name" />
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoComplete="email" />
        <Input label="Contraseña" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="Mínimo 8 caracteres." autoComplete="new-password" />
        <Button type="submit" loading={submitting} className="mt-2 w-full">Crear cuenta</Button>
      </form>
      <p className="mt-6 text-center text-sm text-neutral-600">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700 hover:underline">Inicia sesión</Link>
      </p>
    </>
  );
}

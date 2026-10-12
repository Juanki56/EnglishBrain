import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authMock, fakeSession, resetAuthMock, setSession } from './test/authMock';
import { renderApp } from './test/renderApp';
import { RESET_SENT_MESSAGE } from './views/ForgotPasswordView';

vi.mock('./lib/supabase', async () => (await import('./test/authMock')).supabaseModule);

beforeEach(() => resetAuthMock());

// Espera al campo: mientras se recupera la sesión se ve un instante el "Cargando…".
const type = async (label: RegExp | string, text: string) => userEvent.type(await screen.findByLabelText(label), text);

describe('10.1 · Rutas protegidas', () => {
  it('sin sesión, una pantalla privada redirige al login', async () => {
    renderApp('/library');

    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument();
  });

  it('tras iniciar sesión vuelve a la pantalla que se quería abrir', async () => {
    renderApp('/library');
    await screen.findByRole('heading', { name: 'Inicia sesión' });
    await type(/^Email/, 'a@example.com');
    await type(/^Contraseña/, 'secreta123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Biblioteca' })).toBeInTheDocument();
  });

  it('con sesión, el login redirige al panel', async () => {
    resetAuthMock(fakeSession());
    renderApp('/login');

    expect(await screen.findByRole('heading', { level: 1, name: 'Panel' })).toBeInTheDocument();
  });
});

describe('10.2 · Registro', () => {
  it('una contraseña corta y un email inválido se señalan sin llamar a Supabase', async () => {
    renderApp('/register');
    await type(/^Email/, 'no-es-email');
    await type(/^Contraseña/, 'corta');
    await userEvent.click(await screen.findByRole('button', { name: 'Crear cuenta' }));

    expect(screen.getByText('El email no es válido')).toBeInTheDocument();
    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument();
    expect(authMock.signUp).not.toHaveBeenCalled();
  });

  it('registra con la zona horaria del navegador y muestra "Revisa tu email"', async () => {
    renderApp('/register');
    await type(/^Nombre/, 'Juan');
    await type(/^Email/, 'juan@example.com');
    await type(/^Contraseña/, 'secreta123');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('heading', { name: 'Revisa tu email para confirmar tu cuenta' })).toBeInTheDocument();
    expect(screen.getByText('juan@example.com')).toBeInTheDocument();
    expect(authMock.signUp).toHaveBeenCalledWith({
      email: 'juan@example.com',
      password: 'secreta123',
      options: {
        emailRedirectTo: 'http://localhost:5173/auth/callback',
        data: { display_name: 'Juan', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      },
    });
  });

  it('un error de Supabase se muestra traducido (p. ej. demasiados correos)', async () => {
    authMock.signUp.mockResolvedValueOnce({ data: {}, error: { code: 'over_email_send_rate_limit', message: 'rate limit' } });
    renderApp('/register');
    await type(/^Email/, 'juan@example.com');
    await type(/^Contraseña/, 'secreta123');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Se han enviado demasiados correos');
  });

  it('se puede reenviar el correo de confirmación', async () => {
    renderApp('/register/check-email', { email: 'juan@example.com' });
    await userEvent.click(await screen.findByRole('button', { name: 'Reenviar correo' }));

    expect(authMock.resend).toHaveBeenCalledWith({ type: 'signup', email: 'juan@example.com', options: { emailRedirectTo: 'http://localhost:5173/auth/callback' } });
    expect(await screen.findByText('Te hemos enviado el correo otra vez.')).toBeInTheDocument();
  });
});

describe('10.3 · Login, confirmación y logout', () => {
  it('credenciales incorrectas muestran un mensaje genérico', async () => {
    authMock.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } });
    renderApp('/login');
    await type(/^Email/, 'a@example.com');
    await type(/^Contraseña/, 'mala12345');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos');
  });

  it('un email sin confirmar avisa y permite reenviar la confirmación', async () => {
    authMock.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: { code: 'email_not_confirmed', message: 'Email not confirmed' } });
    renderApp('/login');
    await type(/^Email/, 'a@example.com');
    await type(/^Contraseña/, 'secreta123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Tienes que confirmar tu email');
    await userEvent.click(screen.getByRole('button', { name: 'Reenviar correo de confirmación' }));
    expect(authMock.resend).toHaveBeenCalled();
    expect(await screen.findByText('Te hemos enviado otra vez el correo de confirmación.')).toBeInTheDocument();
  });

  it('campos vacíos se señalan sin llamar a Supabase', async () => {
    renderApp('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar' }));

    expect(screen.getByText('El email es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es obligatoria')).toBeInTheDocument();
    expect(authMock.signInWithPassword).not.toHaveBeenCalled();
  });

  it('si la sesión caducó, el login lo explica', async () => {
    renderApp('/login', { expired: true });

    expect(await screen.findByText('Tu sesión ha caducado; vuelve a entrar.')).toBeInTheDocument();
  });

  it('el enlace de confirmación entra al panel en cuanto hay sesión', async () => {
    renderApp('/auth/callback');
    expect(await screen.findByText('Confirmando tu cuenta…')).toBeInTheDocument();

    act(() => setSession(fakeSession()));
    expect(await screen.findByRole('heading', { level: 1, name: 'Panel' })).toBeInTheDocument();
  });

  it('un enlace de confirmación con error muestra el aviso', async () => {
    window.history.pushState({}, '', '/auth/callback?error_description=Email+link+is+invalid');
    renderApp('/auth/callback');

    expect(await screen.findByText(/El enlace no es válido o ha caducado/)).toBeInTheDocument();
    window.history.pushState({}, '', '/');
  });

  it('"Cerrar sesión" cierra la sesión y vuelve al login', async () => {
    resetAuthMock(fakeSession());
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(authMock.signOut).toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument();
  });
});

describe('10.4 · Recuperación de contraseña', () => {
  it('muestra la misma respuesta exista o no el email', async () => {
    for (const result of [{ data: {}, error: null }, { data: {}, error: { code: 'user_not_found', message: 'User not found' } }]) {
      resetAuthMock();
      authMock.resetPasswordForEmail.mockResolvedValueOnce(result);
      const { unmount } = renderApp('/forgot-password');
      await type(/^Email/, 'alguien@example.com');
      await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

      expect(await screen.findByText(RESET_SENT_MESSAGE)).toBeInTheDocument();
      unmount();
    }
    expect(authMock.resetPasswordForEmail).toHaveBeenCalledWith('alguien@example.com', { redirectTo: 'http://localhost:5173/reset-password' });
  });

  it('el límite de envíos sí se avisa (no revela si la cuenta existe)', async () => {
    authMock.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: { code: 'over_email_send_rate_limit', message: 'rate' } });
    renderApp('/forgot-password');
    await type(/^Email/, 'a@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('demasiados correos');
  });

  it('con el enlace válido permite guardar una contraseña nueva', async () => {
    resetAuthMock(fakeSession());
    renderApp('/reset-password');
    await type(/^Nueva contraseña/, 'nueva12345');
    await type(/^Repite la contraseña/, 'otra12345');
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar contraseña' }));
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(authMock.updateUser).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText(/^Repite la contraseña/));
    await type(/^Repite la contraseña/, 'nueva12345');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    expect(authMock.updateUser).toHaveBeenCalledWith({ password: 'nueva12345' });
    expect(await screen.findByText('Contraseña actualizada. Ya puedes usarla para entrar.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Panel' })).toBeInTheDocument();
  });

  it('sin sesión de recuperación, el enlace se da por no válido', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderApp('/reset-password');
    expect(await screen.findByText('Comprobando el enlace…')).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTime(8000));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Enlace no válido' })).toBeInTheDocument());
    vi.useRealTimers();
  });
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ALL_SECTIONS } from './navigation';
import { fakeSession, resetAuthMock } from './test/authMock';
import { renderApp } from './test/renderApp';

vi.mock('./lib/supabase', async () => (await import('./test/authMock')).supabaseModule);

beforeEach(() => resetAuthMock(fakeSession()));

describe('Estructura base (AppLayout)', () => {
  it('muestra el menú lateral con todas las secciones y el botón de cerrar sesión', async () => {
    renderApp('/');
    const menu = await screen.findByRole('complementary', { name: 'Menú principal' });

    for (const section of ALL_SECTIONS) {
      expect(menu).toHaveTextContent(section.label);
    }
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it('marca como activa la sección actual', async () => {
    renderApp('/inbox');

    expect(await screen.findByRole('link', { name: 'Inbox' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Panel' })).not.toHaveAttribute('aria-current');
  });

  it('navegar desde el menú cambia la pantalla', async () => {
    renderApp('/');
    await userEvent.click(await screen.findByRole('link', { name: 'Biblioteca' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Biblioteca' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Biblioteca' })).toHaveAttribute('aria-current', 'page');
  });

  it('una ruta inexistente muestra la página 404 dentro del layout', async () => {
    renderApp('/no-existe');

    expect(await screen.findByRole('heading', { name: 'Esta página no existe' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Menú principal' })).toBeInTheDocument();
  });
});

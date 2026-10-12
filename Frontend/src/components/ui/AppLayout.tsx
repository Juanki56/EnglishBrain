import { LogOut } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { ACCOUNT_SECTIONS, BRAND_ICON, MAIN_SECTIONS, type Section, SKILL_SECTIONS } from '../../navigation';

/**
 * Estructura base de escritorio: menú lateral fijo a la izquierda y contenido
 * a la derecha (spec dashboard: Desktop-First, sin layout móvil).
 */
export function AppLayout() {
  const navigate = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-neutral-200 bg-white"
        aria-label="Menú principal"
      >
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-brand-100">
            <BRAND_ICON size={20} aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight text-neutral-900">EnglishBrain</span>
        </div>

        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-4">
          <NavGroup sections={MAIN_SECTIONS} />
          <NavGroup title="Habilidades" sections={SKILL_SECTIONS} />
          <div className="mt-auto flex flex-col gap-0.5">
            <NavGroup sections={ACCOUNT_SECTIONS} />
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              <LogOut size={18} aria-hidden />
              Cerrar sesión
            </button>
          </div>
        </nav>
      </aside>

      <main className="ml-60 flex-1">
        <div className="mx-auto max-w-6xl px-10 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavGroup({ title, sections }: { title?: string; sections: Section[] }) {
  return (
    <div>
      {title && <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</p>}
      <ul className="flex flex-col gap-0.5">
        {sections.map(({ path, label, icon: Icon }) => (
          <li key={path}>
            <NavLink
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-100 text-brand-900' : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
                ].join(' ')
              }
            >
              <Icon size={18} aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

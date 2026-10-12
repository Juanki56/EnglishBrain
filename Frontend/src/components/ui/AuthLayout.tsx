import { Outlet } from 'react-router';
import { BRAND_ICON } from '../../navigation';

/** Pantallas de cuenta (login, registro…): tarjeta centrada con la marca. */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-neutral-50 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-600 text-brand-100">
            <BRAND_ICON size={22} aria-hidden />
          </span>
          <span className="text-xl font-semibold tracking-tight">EnglishBrain</span>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white px-8 py-8 shadow-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

/** Título y subtítulo comunes de las pantallas de cuenta. */
export function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>}
    </header>
  );
}

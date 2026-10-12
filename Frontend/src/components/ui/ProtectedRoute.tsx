import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '../../hooks/useSession';
import { FullPageSpinner } from './FullPageSpinner';

/** Rutas privadas: sin sesión, redirige a /login recordando a dónde se quería ir. */
export function ProtectedRoute() {
  const { session, loading, expired } = useSession();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search, expired }} />;
  return <Outlet />;
}

/** Rutas solo para quien NO ha iniciado sesión (login, registro…): con sesión, al panel. */
export function GuestRoute() {
  const { session, loading } = useSession();

  if (loading) return <FullPageSpinner />;
  if (session) return <Navigate to="/" replace />;
  return <Outlet />;
}

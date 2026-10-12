import { Route, Routes } from 'react-router';
import { AppLayout } from './components/ui/AppLayout';
import { AuthLayout } from './components/ui/AuthLayout';
import { GuestRoute, ProtectedRoute } from './components/ui/ProtectedRoute';
import { ALL_SECTIONS } from './navigation';
import { AuthCallbackView } from './views/AuthCallbackView';
import { CheckEmailView } from './views/CheckEmailView';
import { ComingSoonView } from './views/ComingSoonView';
import { ErrorsView } from './views/ErrorsView';
import { ForgotPasswordView } from './views/ForgotPasswordView';
import { InboxView } from './views/InboxView';
import { LibraryView } from './views/LibraryView';
import { ListeningView } from './views/ListeningView';
import { LoginView } from './views/LoginView';
import { NewWordView } from './views/NewWordView';
import { NotFoundView } from './views/NotFoundView';
import { ProfileView } from './views/ProfileView';
import { RegisterView } from './views/RegisterView';
import { ResetPasswordView } from './views/ResetPasswordView';
import { SpeakingView } from './views/SpeakingView';
import { UiKitView } from './views/UiKitView';
import { WritingView } from './views/WritingView';

/** Pantallas ya construidas; el resto muestra su página provisional. */
const VIEWS: Record<string, React.ReactNode> = {
  '/inbox': <InboxView />,
  '/words/new': <NewWordView />,
  '/library': <LibraryView />,
  '/errors': <ErrorsView />,
  '/speaking': <SpeakingView />,
  '/writing': <WritingView />,
  '/listening': <ListeningView />,
  '/profile': <ProfileView />,
};

/** Rutas de la app. Cada grupo de tareas sustituye su pantalla provisional por la real. */
export function App() {
  return (
    <Routes>
      {/* Cuenta: pantallas públicas */}
      <Route element={<AuthLayout />}>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginView />} />
          <Route path="/register" element={<RegisterView />} />
          <Route path="/register/check-email" element={<CheckEmailView />} />
          <Route path="/forgot-password" element={<ForgotPasswordView />} />
        </Route>
        {/* Destinos de los enlaces de los correos: funcionan con o sin sesión previa. */}
        <Route path="/auth/callback" element={<AuthCallbackView />} />
        <Route path="/reset-password" element={<ResetPasswordView />} />
      </Route>

      {/* App: requiere sesión */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {ALL_SECTIONS.map((section) => (
            <Route key={section.path} path={section.path} element={VIEWS[section.path] ?? <ComingSoonView section={section} />} />
          ))}
          {import.meta.env.DEV && <Route path="/dev/ui" element={<UiKitView />} />}
          <Route path="*" element={<NotFoundView />} />
        </Route>
      </Route>
    </Routes>
  );
}

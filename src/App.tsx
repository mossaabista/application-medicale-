import { lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Spinner, ToastProvider } from './components/ui';
import { PrefsProvider } from './lib/prefs';
import { SessionProvider, useSession } from './lib/session';
import Login from './pages/Login';

const PatientApp = lazy(() => import('./pages/patient/PatientApp'));
const StaffApp = lazy(() => import('./pages/doctor/StaffApp'));
const Monitor = lazy(() => import('./pages/doctor/Monitor'));
const Report = lazy(() => import('./pages/shared/Report'));

function Home() {
  const { loading, profile } = useSession();
  if (loading) return <Spinner />;
  if (!profile) return <Navigate to="/connexion" replace />;
  return <Navigate to={profile.role === 'patient' ? '/p' : '/d'} replace />;
}

function Guard({ staff, children }: { staff: boolean; children: ReactNode }) {
  const { loading, profile } = useSession();
  if (loading) return <Spinner />;
  if (!profile) return <Navigate to="/connexion" replace />;
  if (staff !== (profile.role !== 'patient')) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function SignedInGuard({ children }: { children: ReactNode }) {
  const { loading, profile } = useSession();
  if (loading) return <Spinner />;
  if (!profile) return <Navigate to="/connexion" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <PrefsProvider>
      <ToastProvider>
        <SessionProvider>
          <HashRouter>
            <Suspense fallback={<Spinner />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/connexion" element={<Login />} />
                <Route path="/p/*" element={<Guard staff={false}><PatientApp /></Guard>} />
                <Route path="/d/*" element={<Guard staff><StaffApp /></Guard>} />
                <Route path="/moniteur" element={<Guard staff><Monitor /></Guard>} />
                <Route path="/moniteur/:id" element={<Guard staff><Monitor /></Guard>} />
                <Route path="/rapport/:id" element={<SignedInGuard><Report /></SignedInGuard>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </HashRouter>
        </SessionProvider>
      </ToastProvider>
    </PrefsProvider>
  );
}

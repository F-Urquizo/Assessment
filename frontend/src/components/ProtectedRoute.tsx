import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Gate for per-user routes (/favorites, future /admin). Unauthenticated users
 * are sent to /login carrying the page they wanted in state.from, so LoginPage
 * can return them after a successful login. This is UX only — the backend
 * guards are what actually protect the data.
 */
export default function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: ReactNode;
  requiredRole?: 'admin';
}) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Silent refresh still in flight — render nothing rather than flashing the
  // login page at users whose session is about to be restored.
  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

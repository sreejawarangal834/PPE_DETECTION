import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../lib/auth/authStore';
import { ROUTES } from '../constants/routes';
import { ROLE_LANDING } from '../constants/permissions';
import toast from 'react-hot-toast';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, token, checkExpiry } = useAuthStore();
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (checkExpiry()) {
    toast.error('Your session has expired. Please log in again.', { id: 'session-expired' });
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // Redirect root to role landing
  if (location.pathname === '/') {
    return <Navigate to={ROLE_LANDING[user.role]} replace />;
  }

  return <>{children}</>;
}

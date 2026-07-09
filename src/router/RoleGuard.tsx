import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../lib/auth/authStore';
import { ROLE_LANDING } from '../constants/permissions';
import type { UserRole } from '../constants/roles';
import toast from 'react-hot-toast';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export default function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const user = useAuthStore(s => s.user);
  const location = useLocation();

  if (!user) return null;

  if (!allowedRoles.includes(user.role)) {
    if (location.pathname !== ROLE_LANDING[user.role]) {
      toast.error('You do not have permission to view that page.', { id: 'no-permission' });
    }
    return <Navigate to={ROLE_LANDING[user.role]} replace />;
  }

  return <>{children}</>;
}

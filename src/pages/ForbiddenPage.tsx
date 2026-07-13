import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/auth/authStore';
import { ROLE_LANDING } from '../constants/permissions';
import { ROLE_LABELS } from '../constants/roles';
import Button from '../components/ui/Button';
import { ShieldOff } from 'lucide-react';

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const user     = useAuthStore(s => s.user);
  return (
    <div className="h-full bg-bg flex flex-col items-center justify-center text-center p-6">
      <ShieldOff className="w-16 h-16 text-status-danger opacity-30 mb-6" aria-hidden="true" />
      <p className="text-7xl font-bold text-border mb-3 leading-none">403</p>
      <h1 className="text-2xl font-semibold text-text-primary mb-2">Access denied</h1>
      <p className="text-sm text-text-muted mb-2 max-w-sm">
        You don't have permission to view this page.
      </p>
      {user && (
        <p className="text-xs text-text-muted mb-8">
          Your role: <span className="text-accent font-medium">{ROLE_LABELS[user.role]}</span>
        </p>
      )}
      <Button onClick={() => navigate(user ? ROLE_LANDING[user.role] : '/login')}>
        Go to my dashboard
      </Button>
    </div>
  );
}

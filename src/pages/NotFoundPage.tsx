import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/auth/authStore';
import { ROLE_LANDING } from '../constants/permissions';
import Button from '../components/ui/Button';
import { Inbox } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const user     = useAuthStore(s => s.user);
  return (
    <div className="h-full bg-bg flex flex-col items-center justify-center text-center p-6">
      <Inbox className="w-16 h-16 text-text-muted opacity-20 mb-6" aria-hidden="true" />
      <p className="text-7xl font-bold text-border mb-3 leading-none">404</p>
      <h1 className="text-2xl font-semibold text-text-primary mb-2">Page not found</h1>
      <p className="text-sm text-text-muted mb-8 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button onClick={() => navigate(user ? ROLE_LANDING[user.role] : '/login')}>
        Back to dashboard
      </Button>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { resetPassword } from '../../api/authApi';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { ROUTES } from '../../constants/routes';
import toast from 'react-hot-toast';

function strength(pw: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'text-status-danger', 'text-status-warn', 'text-status-warn', 'text-status-ok'];
  return { score: s, label: labels[s] ?? '', color: colors[s] ?? '' };
}

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const str = strength(pw);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== confirm) { setError('Passwords do not match'); return; }
    if (pw.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError(''); setLoading(true);
    try {
      await resetPassword(params.get('token') ?? '', pw);
      toast.success('Password reset successfully. Please sign in.');
      navigate(ROUTES.LOGIN);
    } catch {
      setError('Invalid or expired reset link.');
    } finally { setLoading(false); }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary mb-1">Set new password</h1>
      <p className="text-sm text-text-muted mb-6">Choose a strong password for your account.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="New password" type="password" value={pw} onChange={e => setPw(e.target.value)} />
        {pw && (
          <div className="flex items-center gap-2">
            {[1,2,3,4].map(i => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i <= str.score ? 'bg-accent' : 'bg-border'}`} />
            ))}
            <span className={`text-xs ${str.color}`}>{str.label}</span>
          </div>
        )}
        <Input label="Confirm password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} error={error} />
        <Button type="submit" loading={loading} className="w-full justify-center">Reset password</Button>
      </form>
      <p className="text-center text-sm text-text-muted mt-6">
        <Link to={ROUTES.LOGIN} className="text-accent hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}

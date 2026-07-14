import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../api/authApi';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { ROUTES } from '../../constants/routes';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await forgotPassword(email);
    setSent(true);
    setLoading(false);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary mb-1">Reset password</h1>
      <p className="text-sm text-text-muted mb-6">Enter your email and we'll send a reset link.</p>
      {sent ? (
        <div className="bg-status-ok/10 border border-status-ok/30 rounded-lg p-4 text-sm text-status-ok">
          If that address is registered, a reset link has been sent.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
          <Button type="submit" loading={loading} className="w-full justify-center">Send reset link</Button>
        </form>
      )}
      <p className="text-center text-sm text-text-muted mt-6">
        <Link to={ROUTES.LOGIN} className="text-accent hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}

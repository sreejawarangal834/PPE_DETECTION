import { useState } from 'react';
import { useAuthStore } from '../../lib/auth/authStore';
import { updateProfile } from '../../api/authApi';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { ROLE_LABELS } from '../../constants/roles';
import { Shield, User } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [name,      setName]      = useState(user?.name ?? '');
  const [email,     setEmail]     = useState(user?.email ?? '');
  const [saving,    setSaving]    = useState(false);
  const [curPw,     setCurPw]     = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError,   setPwError]   = useState('');

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const updated = await updateProfile(user.id, { name, email });
    updateUser(updated);
    setSaving(false);
    toast.success('Profile updated.');
  }

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    if (!curPw) { setPwError('Enter your current password'); return; }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    toast.success('Password changed successfully.');
    setCurPw(''); setNewPw(''); setConfirmPw('');
  }

  if (!user) return null;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#E8EAF0]">My Profile</h1>
        <p className="text-sm text-[#5C6480] mt-1">Manage your account details and security settings</p>
      </div>

      {/* Account card */}
      <div className="bg-panel border border-border-soft rounded-xl overflow-hidden">
        {/* Avatar section */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-[#21252D] bg-[#20242D]">
          <div className="w-14 h-14 rounded-full bg-[#252A35] flex items-center justify-center text-2xl font-bold text-[#4A8FA3] select-none shrink-0">
            {user.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
          </div>
          <div>
            <p className="text-base font-semibold text-[#E8EAF0]">{user.name}</p>
            <p className="text-sm text-[#9BA3B8]">{user.email}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Shield className="w-3.5 h-3.5 text-[#4A8FA3]" aria-hidden="true" />
              <span className="text-xs text-[#4A8FA3] font-medium">{ROLE_LABELS[user.role]}</span>
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-[#5C6480]">Last login</p>
            <p className="text-xs font-mono text-[#9BA3B8] mt-0.5">{user.lastLogin}</p>
          </div>
        </div>

        {/* Edit form */}
        <form onSubmit={handleSaveProfile} className="px-6 py-5 space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#5C6480]">Account Details</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Display Name" value={name} onChange={e => setName(e.target.value)} />
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-[#9BA3B8] block mb-1">Role</label>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#20242D] rounded-md border border-[#21252D]">
              <User className="w-3.5 h-3.5 text-[#5C6480]" aria-hidden="true" />
              <span className="text-sm text-[#5C6480]">{ROLE_LABELS[user.role]}</span>
              <span className="text-xs text-[#5C6480] ml-auto">(read-only)</span>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={saving} size="sm">Save changes</Button>
          </div>
        </form>
      </div>

      {/* Password card */}
      <div className="bg-[#1B1F27] border border-[#21252D] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#21252D]">
          <p className="text-xs font-medium uppercase tracking-wide text-[#5C6480]">Change Password</p>
        </div>
        <form onSubmit={handleChangePassword} className="px-6 py-5 space-y-4">
          <Input label="Current password" type="password" value={curPw} onChange={e => setCurPw(e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="New password" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
            <Input label="Confirm new password" type="password" value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)} error={pwError} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" size="sm">Update password</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

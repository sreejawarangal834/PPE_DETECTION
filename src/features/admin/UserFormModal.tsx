import { useState, useEffect } from 'react';
import Dialog from '../../components/ui/Dialog';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import MultiSelect from '../../components/ui/MultiSelect';
import Button from '../../components/ui/Button';
import { ROLE_LABELS, UserRole } from '../../constants/roles';
import { ZONES } from '../../data/zones';
import type { ManagedUser } from '../../types';

const ROLE_OPTS = Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l }));
const ZONE_OPTS = ZONES.map(z => ({ value: z.id, label: z.name }));

interface Props {
  user?: ManagedUser;
  onSave: (data: Partial<ManagedUser> & { password?: string }) => Promise<void>;
  onClose: () => void;
}

export default function UserFormModal({ user, onSave, onClose }: Props) {
  const [name, setName]           = useState(user?.name ?? '');
  const [username, setUsername]   = useState(user?.username ?? '');
  const [email, setEmail]         = useState(user?.email ?? '');
  const [role, setRole]           = useState<UserRole>(user?.role ?? 'viewer');
  const [password, setPassword]   = useState('');
  const [zones, setZones]         = useState<string[]>(user?.assignedZones ?? []);
  const [loading, setLoading]     = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});

  useEffect(() => { if (role !== 'operator') setZones([]); }, [role]);

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim()) errs.email = 'Email is required';
    if (!user && !password.trim()) errs.password = 'Password is required for new users';
    if (role === 'operator' && zones.length === 0) errs.zones = 'At least one zone must be assigned';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    await onSave({ name, username, email, role, assignedZones: zones, ...(password ? { password } : {}) });
    setLoading(false);
  }

  return (
    <Dialog open onClose={onClose} title={user ? 'Edit User' : 'Create User'}
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={loading} onClick={handleSave}>Save</Button></>}
    >
      <div className="space-y-3">
        <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} error={errors.name} />
        <Input label="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} error={errors.email} />
        <Select label="Role" options={ROLE_OPTS} value={role} onChange={e => setRole(e.target.value as UserRole)} />
        {!user && <Input label="Temporary Password" type="password" value={password} onChange={e => setPassword(e.target.value)} error={errors.password} />}
        {role === 'operator' && (
          <div className="relative">
            <MultiSelect label="Assigned Zones (required)" options={ZONE_OPTS} value={zones} onChange={setZones} error={errors.zones} />
          </div>
        )}
      </div>
    </Dialog>
  );
}

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser, updateUser } from '../../api/adminApi';
import { useAuthStore } from '../../lib/auth/authStore';
import DataTable, { type ColumnDef } from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import UserFormModal from './UserFormModal';
import Dialog from '../../components/ui/Dialog';
import { ROLE_LABELS } from '../../constants/roles';
import { ZONES } from '../../data/zones';
import type { ManagedUser } from '../../types';
import toast from 'react-hot-toast';
import PageShell from '../../components/ui/PageShell';

export default function UserManagementPage() {
  const qc    = useQueryClient();
  const actor = useAuthStore(s => s.user?.name ?? 'admin');
  const [search, setSearch]               = useState('');
  const [roleFilter, setRoleFilter]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [editUser, setEditUser]           = useState<ManagedUser | null>(null);
  const [createOpen, setCreateOpen]       = useState(false);
  const [deactivateUser, setDeactivateUser] = useState<ManagedUser | null>(null);

  const { data: users = [] } = useQuery({ queryKey: ['admin', 'users'], queryFn: getUsers, staleTime: 60_000 });

  let visible = users;
  if (search)       visible = visible.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
  if (roleFilter)   visible = visible.filter(u => u.role === roleFilter);
  if (statusFilter) visible = visible.filter(u => u.status === statusFilter);

  const ROLE_OPTS   = [{ value: '', label: 'All roles' },   ...Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l }))];
  const STATUS_OPTS = [{ value: '', label: 'All status' },  { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }];

  async function handleSave(data: Partial<ManagedUser> & { password?: string }) {
    if (editUser) await updateUser(editUser.id, data as ManagedUser, actor);
    else await createUser(data as ManagedUser & { password: string }, actor);
    qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    toast.success(editUser ? 'User updated.' : 'User created.');
    setEditUser(null); setCreateOpen(false);
  }

  async function handleToggleStatus() {
    if (!deactivateUser) return;
    await updateUser(deactivateUser.id, { status: deactivateUser.status === 'active' ? 'inactive' : 'active' }, actor);
    qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    toast.success(`User ${deactivateUser.status === 'active' ? 'deactivated' : 'activated'}.`);
    setDeactivateUser(null);
  }

  const cols: ColumnDef<ManagedUser>[] = [
    { key: 'name',    header: 'Name',      sortable: true },
    { key: 'email',   header: 'Email',     sortable: true, className: 'text-text-muted text-xs' },
    { key: 'role',    header: 'Role',      render: r => <Badge variant={r.role === 'admin' ? 'high' : 'info'} label={ROLE_LABELS[r.role]} /> },
    { key: 'status',  header: 'Status',    render: r => <Badge variant={r.status} /> },
    { key: 'lastLogin', header: 'Last Login', className: 'text-sm' },
    { key: 'assignedZones', header: 'Assigned Zones', render: r => {
      if (r.role !== 'site_supervisor' || !r.assignedZones?.length) return <span className="text-text-muted">—</span>;
      const names = r.assignedZones.map(id => ZONES.find(z => z.id === id)?.name ?? id);
      const shown = names.slice(0, 3);
      return (
        <div className="flex flex-wrap gap-1">
          {shown.map(n => <span key={n} className="bg-accent/15 text-accent text-xs px-1.5 py-0.5 rounded">{n}</span>)}
          {names.length > 3 && <span className="text-xs text-text-muted">+{names.length - 3} more</span>}
        </div>
      );
    }},
    { key: 'id', header: 'Actions', render: r => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <Button variant="ghost" size="sm" onClick={() => setEditUser(r)}>Edit</Button>
        <Button variant={r.status === 'active' ? 'danger' : 'secondary'} size="sm" onClick={() => setDeactivateUser(r)}>
          {r.status === 'active' ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    )},
  ];

  return (
    <PageShell><div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">User Management</h1>
        <p className="text-sm text-text-muted mt-1">Manage user accounts, roles, and permissions</p>
      </div>
      <div className="flex items-center justify-between">
        <Button size="sm" onClick={() => setCreateOpen(true)}>Create User</Button>
      </div>
      <div className="flex gap-3">
        <Input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} className="w-56" />
        <Select options={ROLE_OPTS}   value={roleFilter}   onChange={e => setRoleFilter(e.target.value)}   className="w-44" />
        <Select options={STATUS_OPTS} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-36" />
      </div>
      <DataTable<ManagedUser>
        columns={cols} data={visible} keyExtractor={r => r.id}
        emptyHeading="No users found" emptyMessage="Create the first user to get started."
      />
      {(createOpen || editUser) && (
        <UserFormModal user={editUser ?? undefined} onSave={handleSave} onClose={() => { setCreateOpen(false); setEditUser(null); }} />
      )}
      {deactivateUser && (
        <Dialog open onClose={() => setDeactivateUser(null)} title="Confirm Status Change"
          footer={<><Button variant="ghost" size="sm" onClick={() => setDeactivateUser(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleToggleStatus}>Confirm</Button></>}>
          <p className="text-sm text-text-secondary">
            {deactivateUser.status === 'active' ? 'Deactivate' : 'Activate'} user{' '}
            <strong className="text-text-primary">{deactivateUser.name}</strong>?
          </p>
        </Dialog>
      )}
    </div>
    </PageShell>
  );
}

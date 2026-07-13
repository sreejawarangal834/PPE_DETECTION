import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getZones, createZone, updateZone } from '../../api/zonesApi';
import { useAuthStore } from '../../lib/auth/authStore';
import DataTable, { type ColumnDef } from '../../components/ui/DataTable';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import Input from '../../components/ui/Input';
import { PPE_TYPES } from '../../constants/ppeTypes';
import type { Zone } from '../../types';
import type { PpeTypeId } from '../../constants/ppeTypes';
import toast from 'react-hot-toast';
import PageShell from '../../components/ui/PageShell';

function ZoneFormModal({ zone, onSave, onClose }:
  { zone?: Zone; onSave: (d: Partial<Zone>) => Promise<void>; onClose: () => void }) {
  const [name,   setName]   = useState(zone?.name ?? '');
  const [desc,   setDesc]   = useState(zone?.description ?? '');
  const [ppe,    setPpe]    = useState<PpeTypeId[]>(zone?.requiredPpe ?? []);
  const [active, setActive] = useState(zone?.active ?? true);
  const [loading, setLoading] = useState(false);

  function togglePpe(id: PpeTypeId) {
    setPpe(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  async function handleSave() {
    setLoading(true);
    await onSave({ name, description: desc, requiredPpe: ppe, active });
    setLoading(false);
  }

  return (
    <Dialog open onClose={onClose} title={zone ? 'Edit Zone' : 'Create Zone'}
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={loading} onClick={handleSave}>Save</Button></>}>
      <div className="space-y-3">
        <Input label="Zone Name" value={name} onChange={e => setName(e.target.value)} />
        <Input label="Description" value={desc} onChange={e => setDesc(e.target.value)} />
        <div>
          <p className="text-sm text-text-secondary font-medium mb-2">Required PPE</p>
          <div className="flex flex-wrap gap-2">
            {PPE_TYPES.map(p => (
              <button key={p.id} type="button" onClick={() => togglePpe(p.id as PpeTypeId)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
                  ${ppe.includes(p.id as PpeTypeId) ? 'bg-accent/20 text-accent border-accent' : 'border-border text-text-muted hover:border-accent/50'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="accent-accent" />
          Active zone
        </label>
      </div>
    </Dialog>
  );
}

export default function ZoneConfigPage() {
  const qc    = useQueryClient();
  const actor = useAuthStore(s => s.user?.name ?? 'admin');
  const [editZone, setEditZone]     = useState<Zone | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: getZones, staleTime: 60_000 });

  async function handleSave(data: Partial<Zone>) {
    if (editZone) await updateZone(editZone.id, data, actor);
    else await createZone(data as Omit<Zone, 'id' | 'cameraCount'>, actor);
    qc.invalidateQueries({ queryKey: ['zones'] });
    toast.success(editZone ? 'Zone updated.' : 'Zone created.');
    setEditZone(null); setCreateOpen(false);
  }

  const cols: ColumnDef<Zone>[] = [
    { key: 'name',        header: 'Zone Name',   sortable: true },
    { key: 'description', header: 'Description', className: 'text-sm text-text-muted' },
    { key: 'requiredPpe', header: 'Required PPE', render: r => (
      <div className="flex flex-wrap gap-1">
        {r.requiredPpe.map(p => (
          <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-accent/15 text-accent">
            {PPE_TYPES.find(t => t.id === p)?.label ?? p}
          </span>
        ))}
      </div>
    )},
    { key: 'cameraCount', header: 'Cameras',  sortable: true },
    { key: 'active',      header: 'Status',   render: r => r.active
      ? <span className="text-status-ok text-xs">Active</span>
      : <span className="text-text-muted text-xs">Inactive</span> },
    { key: 'id', header: 'Actions', render: r => (
      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setEditZone(r); }}>Edit</Button>
    )},
  ];

  return (
    <PageShell><div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#E8EAF0]">Zone Configuration</h1>
        <p className="text-sm text-[#5C6480] mt-1">Define zones and required PPE for each area</p>
      </div>
      <div className="flex items-center justify-between">
        <Button size="sm" onClick={() => setCreateOpen(true)}>Create Zone</Button>
      </div>
      <DataTable<Zone>
        columns={cols} data={zones} keyExtractor={r => r.id}
        emptyHeading="No zones configured" emptyMessage="Create a zone to get started."
      />
      {(createOpen || editZone) && (
        <ZoneFormModal zone={editZone ?? undefined} onSave={handleSave}
          onClose={() => { setCreateOpen(false); setEditZone(null); }} />
      )}
    </div>
    </PageShell>
  );
}

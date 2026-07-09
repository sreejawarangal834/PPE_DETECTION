import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCameras, createCamera, updateCamera, testCameraConnection } from '../../api/camerasApi';
import { getZones } from '../../api/zonesApi';
import { useAuthStore } from '../../lib/auth/authStore';
import DataTable, { type ColumnDef } from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import type { Camera } from '../../types';
import { formatRelative } from '../../lib/utils';
import toast from 'react-hot-toast';

function CameraFormModal({ camera, zones, onSave, onClose }:
  { camera?: Camera; zones: { value: string; label: string }[]; onSave: (d: Partial<Camera>) => Promise<void>; onClose: () => void }) {
  const [name, setName]         = useState(camera?.name ?? '');
  const [rtsp, setRtsp]         = useState(camera?.rtspUrl ?? '');
  const [zone, setZone]         = useState(camera?.zoneId ?? '');
  const [testing, setTesting]   = useState(false);
  const [testResult, setTest]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleTest() {
    setTesting(true); setTest(null);
    const r = await testCameraConnection(camera?.id ?? 'new');
    setTest(r.success ? '✓ Connection successful' : '✗ Connection failed');
    setTesting(false);
  }

  async function handleSave() {
    setLoading(true);
    const selectedZone = zones.find(z => z.value === zone);
    await onSave({ name, rtspUrl: rtsp, zoneId: zone, zoneName: selectedZone?.label ?? zone });
    setLoading(false);
  }

  return (
    <Dialog open onClose={onClose} title={camera ? 'Edit Camera' : 'Add Camera'}
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={loading} onClick={handleSave}>Save</Button></>}>
      <div className="space-y-3">
        <Input label="Camera Name" value={name} onChange={e => setName(e.target.value)} />
        <Input label="RTSP URL" value={rtsp} onChange={e => setRtsp(e.target.value)} placeholder="rtsp://..." />
        <Select label="Zone" options={[{ value: '', label: 'Select zone…' }, ...zones]} value={zone} onChange={e => setZone(e.target.value)} />
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" loading={testing} onClick={handleTest}>Test Connection</Button>
          {testResult && <span className={`text-xs ${testResult.startsWith('✓') ? 'text-status-ok' : 'text-status-danger'}`}>{testResult}</span>}
        </div>
      </div>
    </Dialog>
  );
}

export default function CameraManagementPage() {
  const qc     = useQueryClient();
  const actor  = useAuthStore(s => s.user?.name ?? 'admin');
  const [editCam, setEditCam]       = useState<Camera | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: cameras = [] } = useQuery({ queryKey: ['cameras'], queryFn: getCameras, staleTime: 30_000 });
  const { data: zones = [] }   = useQuery({ queryKey: ['zones'],   queryFn: getZones,   staleTime: 60_000 });
  const zoneOpts = zones.map(z => ({ value: z.id, label: z.name }));

  async function handleSave(data: Partial<Camera>) {
    if (editCam) await updateCamera(editCam.id, data, actor);
    else await createCamera(data as Camera, actor);
    qc.invalidateQueries({ queryKey: ['cameras'] });
    toast.success(editCam ? 'Camera updated.' : 'Camera added.');
    setEditCam(null); setCreateOpen(false);
  }

  const cols: ColumnDef<Camera>[] = [
    { key: 'id',       header: 'Camera ID',  sortable: true, className: 'font-mono text-xs' },
    { key: 'name',     header: 'Name',       sortable: true },
    { key: 'rtspUrl',  header: 'RTSP URL',   render: () => <span className="text-text-muted text-xs font-mono">rtsp://***</span> },
    { key: 'zoneName', header: 'Zone',       sortable: true },
    { key: 'status',   header: 'Status',     render: r => <Badge variant={r.status} /> },
    { key: 'lastSeen', header: 'Last Seen',  render: r => formatRelative(r.lastSeen), className: 'text-xs' },
    { key: 'id',       header: 'Actions',    render: r => <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setEditCam(r); }}>Edit</Button> },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#E8EAF0]">Camera Management</h1>
        <p className="text-sm text-[#5C6480] mt-1">Configure and monitor camera connections</p>
      </div>
      <div className="flex items-center justify-between">
        <Button size="sm" onClick={() => setCreateOpen(true)}>Add Camera</Button>
      </div>
      <DataTable<Camera>
        columns={cols} data={cameras} keyExtractor={r => r.id}
        emptyHeading="No cameras configured" emptyMessage="No cameras configured yet — add one to get started."
      />
      {(createOpen || editCam) && (
        <CameraFormModal camera={editCam ?? undefined} zones={zoneOpts} onSave={handleSave}
          onClose={() => { setCreateOpen(false); setEditCam(null); }} />
      )}
    </div>
  );
}

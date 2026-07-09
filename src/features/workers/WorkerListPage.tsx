import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getWorkers } from '../../api/workersApi';
import { useAuthStore } from '../../lib/auth/authStore';
import DataTable, { type ColumnDef } from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { ROUTES } from '../../constants/routes';
import { formatRelative } from '../../lib/utils';
import type { Worker } from '../../types';
import { ZONES } from '../../data/zones';
import { Search } from 'lucide-react';

export default function WorkerListPage() {
  const navigate = useNavigate();
  const user     = useAuthStore(s => s.user);
  const [search,     setSearch]     = useState('');
  const [zone,       setZone]       = useState('');
  const [compliance, setCompliance] = useState('');
  const assignedZones = user?.role === 'site_supervisor' ? user.assignedZones : undefined;

  const { data: workers = [] } = useQuery({
    queryKey: ['workers', search, zone, compliance],
    queryFn:  () => getWorkers({ search, zone: zone || undefined, compliance: compliance || undefined }),
    staleTime: 30_000,
  });

  const visible = assignedZones?.length
    ? workers.filter(w => !w.currentZoneId || assignedZones.includes(w.currentZoneId))
    : workers;

  const columns: ColumnDef<Worker>[] = [
    { key: 'id',           header: 'Worker ID',    sortable: true, className: 'font-mono text-xs' },
    { key: 'name',         header: 'Name',         sortable: true, render: r => <span className="font-medium text-text-primary">{r.name}</span> },
    { key: 'department',   header: 'Department',   sortable: true },
    { key: 'currentZoneName', header: 'Current Zone',
      render: r => r.currentZoneName
        ? <span className="text-text-secondary">{r.currentZoneName}</span>
        : <span className="text-text-muted italic">Not detected</span> },
    { key: 'lastSeen',     header: 'Last Seen',    render: r => <span className="font-mono text-xs">{formatRelative(r.lastSeen)}</span> },
    { key: 'complianceRate', header: 'Compliance', sortable: true,
      render: r => (
        <span className={`font-mono font-bold ${
          r.complianceRate >= 80 ? 'text-compliance-good' :
          r.complianceRate >= 60 ? 'text-compliance-warn' :
          'text-compliance-bad'
        }`}>{r.complianceRate}%</span>
      )},
    { key: 'activeViolations', header: 'Violations', sortable: true,
      render: r => r.activeViolations > 0
        ? <Badge variant="high" label={String(r.activeViolations)} />
        : <span className="text-text-muted">—</span> },
  ];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Workers</h1>
        <p className="text-sm text-text-muted mt-1">All detected workers and compliance status</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Input placeholder="Search by ID or name…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-56"
          leftIcon={<Search className="w-3.5 h-3.5" aria-hidden="true" />} />
        <Select options={[
          { value: '', label: 'All zones' },
          ...ZONES.map(z => ({ value: z.id, label: z.name })),
        ]} value={zone} onChange={e => setZone(e.target.value)} className="w-44" />
        <Select options={[
          { value: '', label: 'All compliance' },
          { value: 'compliant', label: 'Compliant (≥80%)' },
          { value: 'non_compliant', label: 'Non-compliant (<80%)' },
        ]} value={compliance} onChange={e => setCompliance(e.target.value)} className="w-48" />
      </div>

      <DataTable<Worker>
        columns={columns} data={visible} keyExtractor={r => r.id}
        emptyHeading="No workers found"
        emptyMessage="No workers match the current filters."
        onRowClick={row => navigate(ROUTES.WORKER_PROFILE(row.id))}
      />
    </div>
  );
}

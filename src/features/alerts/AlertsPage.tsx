import { useState } from 'react';
import { useAuthStore } from '../../lib/auth/authStore';
import AlertFilters, { defaultFilters, type AlertFilterState } from './AlertFilters';
import AlertTable from './AlertTable';
import AlertDetailPanel from './AlertDetailPanel';
import type { Alert } from '../../types';
import { exportToCSV } from '../../lib/utils';
import { useAlertStore } from '../../lib/alerts/alertStore';
import { PPE_LABEL } from '../../constants/ppeTypes';
import { formatDate } from '../../lib/utils';

import PageShell from '../../components/ui/PageShell';

export default function AlertsPage() {
  const user       = useAuthStore(s => s.user);
  const allAlerts  = useAlertStore(s => s.alerts);
  const [filters, setFilters]   = useState<AlertFilterState>(() => defaultFilters(false));
  const [selected, setSelected] = useState<Alert | null>(null);
  const [page, setPage]         = useState(1);
  const assignedZones = user?.role === 'operator' ? user.assignedZones : undefined;

  function handleExportCSV() {
    let data = [...allAlerts];
    if (assignedZones?.length) data = data.filter(a => assignedZones.includes(a.zoneId));
    exportToCSV(data.map(a => ({
      ID: a.id, Timestamp: a.timestamp, Zone: a.zoneName,
      Worker: `${a.workerId} ${a.workerName}`,
      'Missing PPE': a.missingPpe.map(p => PPE_LABEL[p] ?? p).join('; '),
      Severity: a.severity, Status: a.status,
      'Acknowledged By': a.acknowledgedBy ?? '',
      'Acknowledged At': a.acknowledgedAt ? formatDate(a.acknowledgedAt) : '',
      'Resolved By':     a.resolvedBy ?? '',
      'Resolved At':     a.resolvedAt ? formatDate(a.resolvedAt) : '',
    })), 'alerts-export');
  }

  return (
    <PageShell>
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Alerts &amp; Violations</h1>
        <p className="text-sm text-text-muted mt-1">Real-time violation feed — updates automatically</p>
      </div>

      <AlertFilters filters={filters} onChange={f => { setFilters(f); setPage(1); }} />

      <AlertTable
        filters={filters} page={page} onPageChange={setPage}
        onAlertClick={setSelected} assignedZones={assignedZones}
        onExportCSV={handleExportCSV}
      />

      {selected && (
        <AlertDetailPanel
          alert={selected}
          onClose={() => setSelected(null)}
          onUpdate={updated => setSelected(updated)}
        />
      )}
    </PageShell>
  );
}

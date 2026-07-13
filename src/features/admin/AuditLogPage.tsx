import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLog } from '../../api/adminApi';
import DataTable, { type ColumnDef } from '../../components/ui/DataTable';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import type { AuditLogEntry } from '../../types';
import { exportToCSV } from '../../lib/utils';
import { PAGE_SIZE_AUDIT } from '../../constants/app';
import PageShell from '../../components/ui/PageShell';

export default function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [actor, setActor]   = useState('');
  const [page, setPage]     = useState(1);

  const { data } = useQuery({
    queryKey: ['admin', 'audit-log', { search, actor, page }],
    queryFn: () => getAuditLog({ search: search || undefined, actor: actor || undefined, page, pageSize: PAGE_SIZE_AUDIT }),
    staleTime: 10_000,
  });

  const rows = (data?.data ?? []) as AuditLogEntry[];
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE_AUDIT);

  function handleExport() {
    exportToCSV(rows.map(r => ({
      Timestamp: r.timestamp, Actor: r.actor, 'Action Type': r.actionType,
      Entity: r.entity, Description: r.description, 'IP Address': r.ipAddress,
    })), 'audit-log');
  }

  const cols: ColumnDef<AuditLogEntry>[] = [
    { key: 'timestamp',   header: 'Timestamp',   className: 'font-mono text-xs whitespace-nowrap' },
    { key: 'actor',       header: 'Actor',        sortable: true },
    { key: 'actionType',  header: 'Action',       sortable: true, className: 'font-mono text-xs' },
    { key: 'entity',      header: 'Entity',       className: 'text-sm' },
    { key: 'description', header: 'Description',  className: 'text-sm' },
    { key: 'ipAddress',   header: 'IP',           className: 'font-mono text-xs text-text-muted' },
  ];

  return (
    <PageShell><div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#E8EAF0]">Audit Log</h1>
        <p className="text-sm text-[#5C6480] mt-1">Track all system actions and changes</p>
      </div>
      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={handleExport}>Export CSV</Button>
      </div>
      <div className="flex gap-3">
        <Input placeholder="Search description…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="w-64" />
        <Input placeholder="Filter by actor…"    value={actor}  onChange={e => { setActor(e.target.value);  setPage(1); }} className="w-44" />
      </div>
      <DataTable<AuditLogEntry>
        columns={cols}
        data={rows}
        keyExtractor={r => r.id}
        emptyHeading="No audit log entries found"
        pageSize={PAGE_SIZE_AUDIT}
      />
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</Button>
            <Button variant="ghost" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</Button>
          </div>
        </div>
      )}
    </div>
    </PageShell>
  );
}

import { useQuery } from '@tanstack/react-query';
import { getWorkerZoneLog } from '../../api/workersApi';
import DataTable, { type ColumnDef } from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import type { WorkerZoneLog } from '../../types';

interface Props { workerId: string; }

export default function ZoneEntryExitLog({ workerId }: Props) {
  const { data } = useQuery({
    queryKey: ['worker-zone-log', workerId],
    queryFn: () => getWorkerZoneLog(workerId),
    staleTime: 30_000,
  });

  const rows = data?.data ?? [];

  const cols: ColumnDef<WorkerZoneLog>[] = [
    { key: 'entryTime', header: 'Entry',    sortable: true },
    { key: 'exitTime',  header: 'Exit',
      render: r => r.exitTime ?? <span className="text-status-ok text-xs">In zone</span> },
    { key: 'zoneName',  header: 'Zone',     sortable: true },
    { key: 'duration',  header: 'Duration' },
    { key: 'complianceStatus', header: 'Compliance',
      render: r => <Badge variant={r.complianceStatus as 'compliant' | 'non_compliant' | 'partial'} /> },
  ];

  return (
    <div>
      <h2 className="text-sm font-semibold text-text-secondary mb-3">Zone Entry / Exit Log</h2>
      <DataTable<WorkerZoneLog>
        columns={cols}
        data={rows}
        keyExtractor={(_r, i) => String(i)}
        emptyHeading="No zone log entries"
        pageSize={25}
      />
    </div>
  );
}

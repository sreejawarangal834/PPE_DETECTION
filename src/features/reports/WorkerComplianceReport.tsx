import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWorkerComplianceReport } from '../../api/reportsApi';
import { useNavigate } from 'react-router-dom';
import DataTable, { type ColumnDef } from '../../components/ui/DataTable';
import Input from '../../components/ui/Input';
import MultiSelect from '../../components/ui/MultiSelect';
import DateRangePicker from '../../components/ui/DateRangePicker';
import { ROUTES } from '../../constants/routes';
import { generateExcelWorkbook } from '../../lib/utils';
import type { WorkerComplianceRow } from '../../types';
import { ZONES } from '../../data/zones';
import { format } from 'date-fns';
import { FileSpreadsheet, FileText } from 'lucide-react';

const DEPT_OPTS = ['Production', 'Welding', 'Chemical', 'Logistics', 'Maintenance'].map(d => ({ value: d, label: d }));
const ZONE_OPTS = ZONES.map(z => ({ value: z.id, label: z.name }));

export default function WorkerComplianceReport() {
  const navigate = useNavigate();
  const [zones, setZones]       = useState<string[]>([]);
  const [depts, setDepts]       = useState<string[]>([]);
  const [threshold, setThreshold] = useState('');
  const [dateRange, setDateRange] = useState({
    from: format(new Date(Date.now() - 30 * 86400_000), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'workers', { zones, depts, threshold }],
    queryFn: () => getWorkerComplianceReport({
      zones,
      departments: depts,
      thresholdBelow: threshold ? parseInt(threshold) : undefined,
    }),
    staleTime: 300_000,
  });

  const rows: WorkerComplianceRow[] = data?.data ?? [];

  const cols: ColumnDef<WorkerComplianceRow>[] = [
    { key: 'workerId',              header: 'Worker ID',        sortable: true, className: 'font-mono text-xs' },
    { key: 'workerName',            header: 'Name',             sortable: true },
    { key: 'department',            header: 'Department',       sortable: true },
    { key: 'totalShifts',           header: 'Total Shifts',     sortable: true },
    { key: 'compliantShifts',       header: 'Compliant Shifts', sortable: true },
    { key: 'violationCount',        header: 'Violations',       sortable: true },
    { key: 'complianceRate',        header: 'Compliance %',     sortable: true,
      render: r => (
        <span className={
          r.complianceRate >= 70 ? 'text-status-ok font-medium' :
          r.complianceRate >= 50 ? 'text-status-warn font-medium' :
          'text-status-danger font-medium'
        }>{r.complianceRate}%</span>
      )},
    { key: 'mostFrequentViolation', header: 'Top Violation',   sortable: true },
    { key: 'lastViolationDate',     header: 'Last Violation',   sortable: true },
  ];

  function handleExcelExport() {
    generateExcelWorkbook([{
      name: 'Worker Compliance',
      data: rows.map(r => ({
        'Worker ID': r.workerId, Name: r.workerName, Department: r.department,
        'Total Shifts': r.totalShifts, 'Compliant Shifts': r.compliantShifts,
        Violations: r.violationCount, 'Compliance %': r.complianceRate,
        'Top Violation': r.mostFrequentViolation, 'Last Violation': r.lastViolationDate,
      })),
      metadata: [
        `Date range: ${dateRange.from} – ${dateRange.to}`,
        `Zones: ${zones.join(', ') || 'All'}`,
        `Departments: ${depts.join(', ') || 'All'}`,
      ],
    }], 'worker-compliance-report');
  }

  return (
    <div className="space-y-4">
      <div className="bg-panel border border-border-soft rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} label="Date range" />
          <MultiSelect options={ZONE_OPTS} value={zones} onChange={setZones} placeholder="All zones" label="Zone" />
          <MultiSelect options={DEPT_OPTS} value={depts} onChange={setDepts} placeholder="All departments" label="Department" />
          <Input label="Compliance below %" type="number" min={0} max={100}
            value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="e.g. 70" />
        </div>
        <div className="flex gap-3">
          {/* Excel Button */}
          <button
            onClick={handleExcelExport}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#217346] to-[#4F9E7C] hover:from-[#217346]/90 hover:to-[#4F9E7C]/90 shadow-lg shadow-[#4F9E7C]/20 transition-all duration-300 transform hover:scale-105 hover:shadow-[#4F9E7C]/30"
          >
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            Excel
          </button>
          
          {/* PDF Button */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#C25450] to-[#E85D4A] hover:from-[#C25450]/90 hover:to-[#E85D4A]/90 shadow-lg shadow-[#C25450]/20 transition-all duration-300 transform hover:scale-105 hover:shadow-[#C25450]/30"
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            PDF
          </button>
        </div>
      </div>

      <DataTable<WorkerComplianceRow>
        columns={cols}
        data={rows}
        isLoading={isLoading}
        keyExtractor={r => r.workerId}
        emptyHeading="No worker data found for the selected period and filters."
        pageSize={25}
        onRowClick={row => navigate(ROUTES.WORKER_PROFILE(row.workerId))}
        rowClassName={row =>
          row.complianceRate < 50
            ? 'bg-status-danger/5 border-l-2 border-l-status-danger'
            : row.complianceRate < 70
              ? 'bg-status-warn/5 border-l-2 border-l-status-warn'
              : ''
        }
      />
    </div>
  );
}

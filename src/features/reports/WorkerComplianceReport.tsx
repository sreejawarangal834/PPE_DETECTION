import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWorkerComplianceReport, searchPersons, type PersonSummary } from '../../api/reportsApi';
import { useNavigate } from 'react-router-dom';
import DataTable, { type ColumnDef } from '../../components/ui/DataTable';
import Input from '../../components/ui/Input';
import MultiSelect from '../../components/ui/MultiSelect';
import DateRangePicker from '../../components/ui/DateRangePicker';
import PersonComplianceDetail from './PersonComplianceDetail';
import { ROUTES } from '../../constants/routes';
import { generateExcelWorkbook } from '../../lib/utils';
import type { WorkerComplianceRow } from '../../types';
import { ZONES } from '../../data/zones';
import { PPE_TYPES } from '../../constants/ppeTypes';
import { Severity, SEVERITY_LABELS } from '../../constants/severity';
import { format } from 'date-fns';
import { FileSpreadsheet, FileText, Search, X } from 'lucide-react';

const DEPT_OPTS = ['Production', 'Welding', 'Chemical', 'Logistics', 'Maintenance'].map(d => ({ value: d, label: d }));
const ZONE_OPTS = ZONES.map(z => ({ value: z.id, label: z.name }));
// Reused directly from AdHocAnalytics.tsx's option lists (plan §6.2) rather than inventing a
// second PPE-type/severity vocabulary for this tab.
const PPE_OPTS = PPE_TYPES.map(p => ({ value: p.id, label: p.label }));
const SEVERITY_OPTS = Object.values(Severity).map(s => ({ value: s, label: SEVERITY_LABELS[s] }));

export default function WorkerComplianceReport() {
  const navigate = useNavigate();
  const [zones, setZones]       = useState<string[]>([]);
  const [depts, setDepts]       = useState<string[]>([]);
  const [ppeTypes, setPpeTypes] = useState<string[]>([]);
  const [severities, setSeverities] = useState<string[]>([]);
  const [threshold, setThreshold] = useState('');
  const [dateRange, setDateRange] = useState({
    from: format(new Date(Date.now() - 30 * 86400_000), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });

  // ── Person search/select (plan §6.2) ──────────────────────────────────────
  const [personQuery, setPersonQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<PersonSummary | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(personQuery), 250);
    return () => clearTimeout(t);
  }, [personQuery]);

  const { data: personResults } = useQuery({
    queryKey: ['persons', 'search', debouncedQuery],
    queryFn: () => searchPersons(debouncedQuery),
    enabled: debouncedQuery.length > 0 && !selectedPerson,
    staleTime: 30_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'workers', { zones, depts, threshold }],
    queryFn: () => getWorkerComplianceReport({
      zones,
      departments: depts,
      thresholdBelow: threshold ? parseInt(threshold) : undefined,
    }),
    staleTime: 300_000,
    enabled: !selectedPerson,
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
        {/* Person search/select — plan §6.2. Selecting a person switches this tab from the
            aggregate table to that person's detail panel (per-zone/per-PPE/trend/timeline). */}
        <div className="relative">
          <Input
            label="Find a person"
            leftIcon={<Search className="w-4 h-4" />}
            placeholder="Search by worker id or name…"
            value={selectedPerson ? (selectedPerson.name ?? selectedPerson.label) : personQuery}
            onChange={e => { setPersonQuery(e.target.value); setSelectedPerson(null); }}
            disabled={!!selectedPerson}
          />
          {selectedPerson && (
            <button
              onClick={() => { setSelectedPerson(null); setPersonQuery(''); }}
              aria-label="Clear selected person"
              className="absolute right-3 top-[34px] text-text-muted hover:text-text-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {!selectedPerson && debouncedQuery && (personResults?.length ?? 0) > 0 && (
            <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-panel border border-border-soft rounded-lg shadow-lg">
              {personResults!.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPerson(p); setPersonQuery(''); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-panel-alt flex items-center justify-between"
                >
                  <span className="font-mono text-xs text-text-muted">{p.label}</span>
                  <span className="text-text-secondary">{p.name ?? '—'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} label="Date range" />
          <MultiSelect options={ZONE_OPTS} value={zones} onChange={setZones} placeholder="All zones" label="Zone" />
          {!selectedPerson && (
            <MultiSelect options={DEPT_OPTS} value={depts} onChange={setDepts} placeholder="All departments" label="Department" />
          )}
          {!selectedPerson && (
            <Input label="Compliance below %" type="number" min={0} max={100}
              value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="e.g. 70" />
          )}
          {selectedPerson && (
            <>
              <MultiSelect options={PPE_OPTS} value={ppeTypes} onChange={setPpeTypes} placeholder="All PPE types" label="PPE Type" />
              <MultiSelect options={SEVERITY_OPTS} value={severities} onChange={setSeverities} placeholder="All severities" label="Severity" />
            </>
          )}
        </div>

        {!selectedPerson && (
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
        )}
      </div>

      {selectedPerson ? (
        <PersonComplianceDetail
          personId={selectedPerson.id}
          personLabel={selectedPerson.name ?? selectedPerson.label}
          filters={{
            from: dateRange.from, to: dateRange.to,
            zoneIds: zones.length ? zones : undefined,
            ppeTypes: ppeTypes.length ? ppeTypes : undefined,
            severity: severities.length ? severities : undefined,
          }}
        />
      ) : (
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
      )}
    </div>
  );
}

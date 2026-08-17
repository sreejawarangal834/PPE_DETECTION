import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getPersonCompliance, type PersonComplianceFilters } from '../../api/reportsApi';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import { generateExcelWorkbook } from '../../lib/utils';
import { PPE_LABEL } from '../../constants/ppeTypes';
import { FileSpreadsheet } from 'lucide-react';

const TT = { contentStyle: { background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 11 } };

interface Props {
  personId: string;
  personLabel: string;
  filters: PersonComplianceFilters;
}

export default function PersonComplianceDetail({ personId, personLabel, filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['persons', personId, 'compliance', filters],
    queryFn: () => getPersonCompliance(personId, filters),
    staleTime: 60_000,
  });

  if (isLoading) return <LoadingSkeleton variant="chart" />;
  if (!data) return <EmptyState heading="No data" message="Could not load this person's compliance history." />;

  const hasAnyViolations = data.timeline.length > 0;

  function handleExport() {
    generateExcelWorkbook([
      {
        name: 'Timeline',
        data: data!.timeline.map(t => ({
          Date: t.startedAt, PPE: PPE_LABEL[t.ppeType as keyof typeof PPE_LABEL] ?? t.ppeType,
          Zone: t.zoneName ?? '', Camera: t.cameraCode ?? '', Severity: t.severity, Status: t.alertStatus,
          Confidence: t.confidence ?? '',
        })),
      },
      {
        name: 'Per Zone',
        data: data!.perZone.map(z => ({ Zone: z.zoneName, Violations: z.violations })),
      },
      {
        name: 'Per PPE',
        data: data!.perPpe.map(p => ({
          PPE: PPE_LABEL[p.ppeType as keyof typeof PPE_LABEL] ?? p.ppeType,
          Violations: p.violations, 'Last Seen': p.lastSeen ?? '',
        })),
      },
    ], `${personLabel}-compliance-history`);
  }

  return (
    <div className="bg-panel border border-border-soft rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-text-primary">
          {personLabel} — compliance detail
        </p>
        <button
          onClick={handleExport}
          disabled={!hasAnyViolations}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#217346] to-[#4F9E7C] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
          Export
        </button>
      </div>

      {!hasAnyViolations ? (
        <EmptyState heading="No violations in range" message="This person has no recorded violations for the selected filters." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <p className="text-xs text-text-muted font-medium uppercase tracking-wide mb-2">
              Violations per day (count, not a duration-weighted rate — see note below)
            </p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={data.trend.map(t => ({ day: t.day.slice(5), violations: t.violations }))} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border-soft)" />
                <XAxis dataKey="day" tick={{ fill: 'var(--color-text-muted)', fontSize: 9 }} />
                <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} allowDecimals={false} />
                <Tooltip {...TT} />
                <Line type="monotone" dataKey="violations" stroke="var(--color-severity-high)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-text-muted mt-1">
              This trend counts violation events per day. A true time-weighted compliance-rate
              trend needs "violation cleared" events to be persisted, which isn't wired up yet
              (see backend/repositories/persons.py) — shown as a count so nothing is fabricated.
            </p>
          </div>

          <div>
            <p className="text-xs text-text-muted font-medium uppercase tracking-wide mb-2">Where — per zone</p>
            <div className="space-y-1.5">
              {data.perZone.map(z => (
                <div key={z.zoneId} className="flex items-center gap-2 text-sm">
                  <span className="w-28 truncate text-text-secondary">{z.zoneName}</span>
                  <div className="flex-1 h-2 bg-panel-alt rounded-full overflow-hidden">
                    <div
                      className="h-full bg-severity-high/70"
                      style={{ width: `${Math.min(100, (z.violations / Math.max(...data.perZone.map(x => x.violations), 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-text-muted text-xs">{z.violations}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-text-muted font-medium uppercase tracking-wide mb-2">What — per PPE type</p>
            <table className="w-full text-sm">
              <tbody>
                {data.perPpe.map(p => (
                  <tr key={p.ppeType} className="border-t border-border-soft first:border-t-0">
                    <td className="py-1 text-text-secondary">{PPE_LABEL[p.ppeType as keyof typeof PPE_LABEL] ?? p.ppeType}</td>
                    <td className="py-1 text-right font-medium">{p.violations}</td>
                    <td className="py-1 text-right text-text-muted text-xs">
                      {p.lastSeen ? new Date(p.lastSeen).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-2">
            <p className="text-xs text-text-muted font-medium uppercase tracking-wide mb-2">Recent violations</p>
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-text-muted"><th className="text-left py-1">When</th><th className="text-left py-1">PPE</th><th className="text-left py-1">Zone</th><th className="text-left py-1">Severity</th><th className="text-left py-1">Status</th></tr></thead>
                <tbody>
                  {data.timeline.slice(0, 50).map(t => (
                    <tr key={t.id} className="border-t border-border-soft">
                      <td className="py-1 text-text-muted text-xs">{new Date(t.startedAt).toLocaleString()}</td>
                      <td className="py-1">{PPE_LABEL[t.ppeType as keyof typeof PPE_LABEL] ?? t.ppeType}</td>
                      <td className="py-1 text-text-secondary">{t.zoneName ?? '—'}</td>
                      <td className="py-1 capitalize">{t.severity}</td>
                      <td className="py-1 capitalize">{t.alertStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

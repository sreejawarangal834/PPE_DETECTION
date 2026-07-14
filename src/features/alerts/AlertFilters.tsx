import MultiSelect from '../../components/ui/MultiSelect';
import DateRangePicker from '../../components/ui/DateRangePicker';
import Button from '../../components/ui/Button';
import { ZONES } from '../../data/zones';
import { format } from 'date-fns';

export interface AlertFilterState {
  severities: string[]; zones: string[]; statuses: string[];
  search: string; dateFrom: string; dateTo: string;
}

const SEV_OPTS = [
  { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },   { value: 'info', label: 'Info' },
];
const STATUS_OPTS = [
  { value: 'open', label: 'Open' }, { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'escalated', label: 'Escalated' }, { value: 'resolved', label: 'Resolved' },
];
const ZONE_OPTS = ZONES.map(z => ({ value: z.id, label: z.name }));

interface Props { filters: AlertFilterState; onChange: (f: AlertFilterState) => void; }

export default function AlertFilters({ filters, onChange }: Props) {
  const set = (patch: Partial<AlertFilterState>) => onChange({ ...filters, ...patch });
  const hasFilters = !!(filters.severities.length || filters.zones.length || filters.statuses.length ||
    filters.search || filters.dateFrom || filters.dateTo);

  return (
    <div className="bg-panel border border-border-soft rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input value={filters.search} onChange={e => set({ search: e.target.value })}
          placeholder="Search worker, zone…"
          className="bg-panel-alt border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent" />
        <MultiSelect options={SEV_OPTS} value={filters.severities} onChange={v => set({ severities: v })} placeholder="Severity" />
        <MultiSelect options={ZONE_OPTS} value={filters.zones} onChange={v => set({ zones: v })} placeholder="Zone" />
        <MultiSelect options={STATUS_OPTS} value={filters.statuses} onChange={v => set({ statuses: v })} placeholder="Status" />
      </div>
      <div className="flex items-center gap-4">
        <DateRangePicker value={{ from: filters.dateFrom, to: filters.dateTo }} onChange={v => set({ dateFrom: v.from, dateTo: v.to })} />
        {hasFilters && <Button variant="ghost" size="sm" onClick={() => onChange({ severities: [], zones: [], statuses: [], search: '', dateFrom: '', dateTo: '' })}>Clear all</Button>}
      </div>
      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap gap-1.5">
          {[...filters.severities.map(v => ({ label: `Severity: ${v}`, clear: () => set({ severities: filters.severities.filter(s => s !== v) }) })),
            ...filters.zones.map(v => ({ label: `Zone: ${ZONE_OPTS.find(z => z.value === v)?.label ?? v}`, clear: () => set({ zones: filters.zones.filter(z => z !== v) }) })),
            ...filters.statuses.map(v => ({ label: `Status: ${v}`, clear: () => set({ statuses: filters.statuses.filter(s => s !== v) }) })),
          ].map(chip => (
            <span key={chip.label} className="flex items-center gap-1 bg-accent/15 text-accent text-xs px-2 py-0.5 rounded-full">
              {chip.label}
              <button onClick={chip.clear} className="hover:text-white" aria-label={`Remove filter ${chip.label}`}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function defaultFilters(includeResolved = false): AlertFilterState {
  const today = format(new Date(), 'yyyy-MM-dd');
  const week  = format(new Date(Date.now() - 7 * 24 * 3600_000), 'yyyy-MM-dd');
  return {
    severities: [], zones: [], statuses: includeResolved ? [] : ['open','acknowledged','escalated'],
    search: '', dateFrom: week, dateTo: today,
  };
}

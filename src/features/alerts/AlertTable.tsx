import { useRef, useEffect } from 'react';
import { useAlertStore } from '../../lib/alerts/alertStore';
import AlertRow from './AlertRow';
import type { Alert } from '../../types';
import type { AlertFilterState } from './AlertFilters';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import { PAGE_SIZE_DEFAULT } from '../../constants/app';
import { PPE_LABEL } from '../../constants/ppeTypes';

interface AlertTableProps {
  filters: AlertFilterState;
  page: number;
  onPageChange: (p: number) => void;
  onAlertClick: (alert: Alert) => void;
  assignedZones?: string[];
  onExportCSV: () => void;
}

const HEADERS = ['ID','Time','Zone','Worker','Missing PPE','Severity','Status','Ack By','Ack At','Resolved By','Resolved At'];

export default function AlertTable({ filters, page, onPageChange, onAlertClick, assignedZones, onExportCSV }: AlertTableProps) {
  const allAlerts = useAlertStore(s => s.alerts);
  const prevLengthRef = useRef(allAlerts.length);
  const newIdsRef = useRef<Set<string>>(new Set());

  // Track newly arrived alerts for row animation
  useEffect(() => {
    if (allAlerts.length > prevLengthRef.current) {
      const newOnes = allAlerts.slice(0, allAlerts.length - prevLengthRef.current);
      newIdsRef.current = new Set(newOnes.map(a => a.id));
      const t = setTimeout(() => { newIdsRef.current = new Set(); }, 3500);
      prevLengthRef.current = allAlerts.length;
      return () => clearTimeout(t);
    }
    prevLengthRef.current = allAlerts.length;
  }, [allAlerts.length]);

  // Apply filters
  let visible = [...allAlerts];
  if (assignedZones?.length) visible = visible.filter(a => assignedZones.includes(a.zoneId));
  if (filters.severities.length) visible = visible.filter(a => filters.severities.includes(a.severity));
  if (filters.zones.length)      visible = visible.filter(a => filters.zones.includes(a.zoneId));
  if (filters.statuses.length)   visible = visible.filter(a => filters.statuses.includes(a.status));
  if (filters.search) {
    const q = filters.search.toLowerCase();
    visible = visible.filter(a =>
      a.id.toLowerCase().includes(q) ||
      a.workerName.toLowerCase().includes(q) ||
      a.zoneName.toLowerCase().includes(q) ||
      (a.acknowledgedBy ?? '').toLowerCase().includes(q) ||
      (a.resolvedBy ?? '').toLowerCase().includes(q) ||
      a.missingPpe.map(p => PPE_LABEL[p] ?? p).join(' ').toLowerCase().includes(q)
    );
  }

  const totalPages = Math.ceil(visible.length / PAGE_SIZE_DEFAULT);
  const paged = visible.slice((page - 1) * PAGE_SIZE_DEFAULT, page * PAGE_SIZE_DEFAULT);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">{visible.length} alert{visible.length !== 1 ? 's' : ''} matching filters</p>
        <Button variant="secondary" size="sm" onClick={onExportCSV}>Export CSV</Button>
      </div>

      {paged.length === 0 ? (
        <EmptyState heading="No alerts match the current filters" message="Try adjusting your filter criteria." />
      ) : (
        <div className="bg-panel border border-border-soft rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" role="table" aria-label="Alert feed">
              <thead>
                <tr className="bg-panel-alt text-xs text-text-muted tracking-wide">
                  {HEADERS.map(h => (
                    <th key={h} className="px-3 py-3 font-medium text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(a => (
                  <AlertRow
                    key={a.id}
                    alert={a}
                    isNew={newIdsRef.current.has(a.id)}
                    onClick={onAlertClick}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-border-soft flex items-center justify-between text-xs text-text-muted">
              <span>
                {(page - 1) * PAGE_SIZE_DEFAULT + 1}–{Math.min(page * PAGE_SIZE_DEFAULT, visible.length)} of {visible.length}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => onPageChange(page - 1)}>‹</Button>
                <span className="px-2 py-1">Page {page}/{totalPages}</span>
                <Button variant="ghost" size="sm" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>›</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

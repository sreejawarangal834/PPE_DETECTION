import type { Alert } from '../../types';
import Button from '../ui/Button';
import { SITE_NAME } from '../../constants/app';
import { formatDate, formatDuration } from '../../lib/utils';
import { useAuthStore } from '../../lib/auth/authStore';
import { PPE_LABEL } from '../../constants/ppeTypes';

interface IncidentReportWidgetProps {
  alert: Alert;
  triggerLabel?: string;
}

export default function IncidentReportWidget({ alert, triggerLabel = 'Generate Incident Report' }: IncidentReportWidgetProps) {
  const user = useAuthStore(s => s.user);

  function handlePrint() {
    const div = document.getElementById(`incident-report-${alert.id}`);
    if (!div) return;
    div.classList.remove('hidden');
    window.print();
    setTimeout(() => div.classList.add('hidden'), 500);
  }

  const responseTimeMs = alert.acknowledgedAt
    ? new Date(alert.acknowledgedAt).getTime() - alert.createdAt
    : null;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handlePrint}>{triggerLabel}</Button>

      {/* Hidden print-only report */}
      <div id={`incident-report-${alert.id}`} className="hidden print-only fixed inset-0 z-[9999] bg-white text-black p-8 text-sm font-sans">
        <div className="mb-4 border-b border-gray-300 pb-3">
          <p className="text-xs text-gray-500 uppercase">{SITE_NAME}</p>
          <h1 className="text-xl font-bold mt-1">Incident Report — {alert.id}</h1>
          <p className="text-xs text-gray-500 mt-1">Generated: {formatDate(Date.now())} · By: {user?.name ?? 'System'}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div><p className="text-xs font-semibold text-gray-500">Date &amp; Time</p><p>{formatDate(alert.createdAt)}</p></div>
          <div><p className="text-xs font-semibold text-gray-500">Zone</p><p>{alert.zoneName}</p></div>
          <div><p className="text-xs font-semibold text-gray-500">Camera</p><p>{alert.cameraId}</p></div>
          <div><p className="text-xs font-semibold text-gray-500">Worker ID</p><p>{alert.workerId} — {alert.workerName}</p></div>
          <div><p className="text-xs font-semibold text-gray-500">Severity</p><p className="capitalize">{alert.severity}</p></div>
          <div><p className="text-xs font-semibold text-gray-500">Status</p><p className="capitalize">{alert.status}</p></div>
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 mb-1">Missing PPE Items</p>
          <p>{alert.missingPpe.map(p => PPE_LABEL[p] ?? p).join(', ')}</p>
        </div>

        <div className="mb-4 h-24 bg-gray-100 border border-gray-300 rounded flex items-center justify-center text-gray-400 text-xs">
          CCTV capture at time of incident — {formatDate(alert.createdAt)}
        </div>

        {alert.acknowledgedBy && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500">Acknowledged By</p>
            <p>{alert.acknowledgedBy} at {alert.acknowledgedAt ? formatDate(alert.acknowledgedAt) : '—'}</p>
          </div>
        )}

        {responseTimeMs !== null && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500">Response Time</p>
            <p>{formatDuration(responseTimeMs)}</p>
          </div>
        )}

        {alert.resolvedBy && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500">Resolved By</p>
            <p>{alert.resolvedBy} at {alert.resolvedAt ? formatDate(alert.resolvedAt) : '—'}</p>
            {alert.resolutionNotes && <p className="mt-1 text-gray-600 italic">{alert.resolutionNotes}</p>}
          </div>
        )}

        {alert.status === 'escalated' && (
          <div className="mt-4 border border-red-400 bg-red-50 rounded p-3 text-red-700 text-sm font-semibold">
            ⚠ This alert was escalated — the configured response time was exceeded.
          </div>
        )}
      </div>
    </>
  );
}

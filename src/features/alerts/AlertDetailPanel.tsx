import { useState } from 'react';
import Drawer from '../../components/ui/Drawer';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import IncidentReportWidget from '../../components/widgets/IncidentReportWidget';
import AcknowledgeDialog from './AcknowledgeDialog';
import ResolveDialog from './ResolveDialog';
import type { Alert } from '../../types';
import { formatDate } from '../../lib/utils';
import { PPE_LABEL } from '../../constants/ppeTypes';
import { useAuthStore } from '../../lib/auth/authStore';
import { hasCapability } from '../../constants/permissions';
import SnapshotImage from '../../components/ui/SnapshotImage';

interface Props { alert: Alert; onClose: () => void; onUpdate: (a: Alert) => void; }

export default function AlertDetailPanel({ alert, onClose, onUpdate }: Props) {
  const [showAck, setShowAck] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const role = useAuthStore(s => s.user?.role);
  // UI-only gating — backend/main.py's require_role("admin","operator") on
  // acknowledge/resolve is the real boundary (a manager/viewer hitting the endpoint
  // directly still gets a 403). This just avoids showing a button that would fail.
  const canAct = (alert.status === 'open' || alert.status === 'escalated')
    && !!role && (hasCapability(role, 'acknowledgeAlerts') || hasCapability(role, 'resolveAlerts'));

  return (
    <>
      <Drawer open onClose={onClose} title={`Alert ${alert.id}`} width="w-[480px]">
        {/* Escalation banner */}
        {alert.status === 'escalated' && (
          <div className="mx-4 mt-4 bg-status-danger/15 border border-status-danger/40 rounded-lg p-3 flex items-start gap-2">
            <span className="text-lg">⚠</span>
            <p className="text-sm text-status-danger font-medium">
              Escalated — this alert exceeded the configured response time and requires immediate attention.
            </p>
          </div>
        )}

        <div className="px-4 py-4 space-y-4">
          {/* Real violation snapshot (or an honest empty state — see SnapshotImage) */}
          <SnapshotImage snapshotUrl={alert.snapshotUrl} alt={`Snapshot for alert ${alert.id}`} height={144} />

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Alert ID', alert.id],
              ['Time', formatDate(alert.createdAt)],
              ['Zone', alert.zoneName],
              ['Camera', alert.cameraId],
              ['Worker', `${alert.workerId} · ${alert.workerName}`],
              ['Confidence', `${(alert.confidence * 100).toFixed(0)}%`],
            ].map(([l, v]) => (
              <div key={l} className="bg-panel-alt rounded-lg px-3 py-2">
                <p className="text-xs text-text-muted">{l}</p>
                <p className="text-sm font-medium text-text-primary mt-0.5 truncate">{v}</p>
              </div>
            ))}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2">
            <Badge variant={alert.severity} />
            <Badge variant={alert.status} />
          </div>

          {/* Missing PPE */}
          <div>
            <p className="text-xs text-text-muted mb-2 font-medium uppercase tracking-wide">Missing PPE</p>
            <div className="flex flex-wrap gap-1.5">
              {alert.missingPpe.map(p => (
                <span key={p} className="bg-status-danger/15 text-status-danger text-xs px-2.5 py-1 rounded-full font-medium">
                  {PPE_LABEL[p] ?? p}
                </span>
              ))}
            </div>
          </div>

          {/* Resolution history */}
          <div>
            <p className="text-xs text-text-muted mb-2 font-medium uppercase tracking-wide">History</p>
            <div className="space-y-2">
              <HistoryRow icon="🔴" label="Created" time={formatDate(alert.createdAt)} />
              {alert.acknowledgedBy && <HistoryRow icon="🟡" label={`Acknowledged by ${alert.acknowledgedBy}`} time={alert.acknowledgedAt ? formatDate(alert.acknowledgedAt) : ''} />}
              {alert.escalatedAt && <HistoryRow icon="⚠" label="Escalated (auto)" time={formatDate(alert.escalatedAt)} />}
              {alert.resolvedBy && <HistoryRow icon="🟢" label={`Resolved by ${alert.resolvedBy}`} time={alert.resolvedAt ? formatDate(alert.resolvedAt) : ''} />}
              {alert.resolutionNotes && <p className="text-xs text-text-secondary italic pl-6">{alert.resolutionNotes}</p>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {canAct && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setShowAck(true)}>Acknowledge</Button>
                <Button size="sm" onClick={() => setShowResolve(true)}>Resolve</Button>
              </>
            )}
            <IncidentReportWidget alert={alert} />
          </div>
        </div>
      </Drawer>

      {showAck && (
        <AcknowledgeDialog alert={alert} onClose={() => setShowAck(false)}
          onDone={updated => { onUpdate(updated); setShowAck(false); }} />
      )}
      {showResolve && (
        <ResolveDialog alert={alert} onClose={() => setShowResolve(false)}
          onDone={updated => { onUpdate(updated); setShowResolve(false); }} />
      )}
    </>
  );
}

function HistoryRow({ icon, label, time }: { icon: string; label: string; time: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="mt-0.5">{icon}</span>
      <div>
        <span className="text-text-primary">{label}</span>
        {time && <span className="text-text-muted ml-2">{time}</span>}
      </div>
    </div>
  );
}

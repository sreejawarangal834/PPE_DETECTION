import { useState } from 'react';
import Dialog from '../../components/ui/Dialog';
import Button from '../../components/ui/Button';
import { acknowledgeAlert } from '../../api/alertsApi';
import { useAlertStore } from '../../lib/alerts/alertStore';
import { useAuthStore } from '../../lib/auth/authStore';
import type { Alert } from '../../types';
import toast from 'react-hot-toast';

interface Props { alert: Alert; onClose: () => void; onDone: (a: Alert) => void; }

export default function AcknowledgeDialog({ alert, onClose, onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const updateStatus = useAlertStore(s => s.updateStatus);
  const user = useAuthStore(s => s.user);

  async function handleConfirm() {
    setLoading(true);
    const updated = await acknowledgeAlert(alert.id, user?.name ?? 'Officer');
    updateStatus(alert.id, 'acknowledged', { acknowledgedBy: updated.acknowledgedBy, acknowledgedAt: updated.acknowledgedAt });
    toast.success('Alert acknowledged.');
    onDone(updated);
    setLoading(false);
  }

  return (
    <Dialog open onClose={onClose} title="Acknowledge Alert"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" loading={loading} onClick={handleConfirm}>Confirm</Button>
      </>}>
      <p className="text-sm text-text-secondary">
        Acknowledge <strong className="text-text-primary">{alert.id}</strong> for worker <strong className="text-text-primary">{alert.workerName}</strong> in <strong className="text-text-primary">{alert.zoneName}</strong>?
      </p>
      <p className="text-xs text-text-muted mt-2">Your name and timestamp will be recorded.</p>
    </Dialog>
  );
}

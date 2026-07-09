import { useState } from 'react';
import Dialog from '../../components/ui/Dialog';
import Button from '../../components/ui/Button';
import { resolveAlert } from '../../api/alertsApi';
import { useAlertStore } from '../../lib/alerts/alertStore';
import { useAuthStore } from '../../lib/auth/authStore';
import type { Alert } from '../../types';
import toast from 'react-hot-toast';

interface Props { alert: Alert; onClose: () => void; onDone: (a: Alert) => void; }

export default function ResolveDialog({ alert, onClose, onDone }: Props) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const updateStatus = useAlertStore(s => s.updateStatus);
  const user = useAuthStore(s => s.user);

  async function handleConfirm() {
    if (notes.trim().length < 10) { setError('Resolution notes must be at least 10 characters.'); return; }
    setLoading(true);
    const updated = await resolveAlert(alert.id, user?.name ?? 'Officer', notes);
    updateStatus(alert.id, 'resolved', { resolvedBy: updated.resolvedBy, resolvedAt: updated.resolvedAt, resolutionNotes: notes });
    toast.success('Alert resolved.');
    onDone(updated);
    setLoading(false);
  }

  return (
    <Dialog open onClose={onClose} title="Resolve Alert"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" loading={loading} onClick={handleConfirm}>Resolve</Button>
      </>}>
      <p className="text-sm text-text-secondary mb-3">
        Resolve <strong className="text-text-primary">{alert.id}</strong>. Provide resolution notes below.
      </p>
      <textarea value={notes} onChange={e => { setNotes(e.target.value); setError(''); }}
        rows={4} placeholder="Describe the corrective action taken (min 10 characters)…"
        className="w-full bg-panel-alt border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
        aria-describedby="resolve-error" />
      {error && <p id="resolve-error" className="text-xs text-status-danger mt-1" role="alert">{error}</p>}
    </Dialog>
  );
}

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminAlertConfig, saveAdminAlertConfig } from '../../api/adminApi';
import { useAuthStore } from '../../lib/auth/authStore';
import Slider from '../../components/ui/Slider';
import Button from '../../components/ui/Button';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import type { AlertConfig } from '../../types';
import toast from 'react-hot-toast';
import PageShell from '../../components/ui/PageShell';

export default function AlertConfigPage() {
  const qc = useQueryClient();
  const actor = useAuthStore(s => s.user?.name ?? 'admin');
  const { data: configs = [], isLoading } = useQuery({ queryKey: ['admin', 'alert-config'], queryFn: getAdminAlertConfig, staleTime: 60_000 });
  const [local, setLocal] = useState<AlertConfig[] | null>(null);
  const [saving, setSaving] = useState(false);

  const working: AlertConfig[] = local ?? configs;

  function update(zoneId: string, patch: Partial<AlertConfig>) {
    setLocal((working).map(c => c.zoneId === zoneId ? { ...c, ...patch } : c));
  }

  async function handleSave() {
    setSaving(true);
    await saveAdminAlertConfig(working, actor);
    qc.invalidateQueries({ queryKey: ['admin', 'alert-config'] });
    toast.success('Alert configuration saved.');
    setSaving(false);
  }

  if (isLoading) return <PageShell><LoadingSkeleton variant="table" /></PageShell>;

  return (
    <PageShell>
      <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#E8EAF0]">Alert Severity & Thresholds</h1>
        <p className="text-sm text-[#5C6480] mt-1">Configure detection confidence and escalation settings per zone</p>
      </div>
      <div className="flex items-center justify-between">
        <Button size="sm" loading={saving} onClick={handleSave}>Save Changes</Button>
      </div>

      <div className="space-y-4">
        {working.map(cfg => (
          <div key={cfg.zoneId} className="bg-panel border border-border-soft rounded-xl p-5 space-y-4">
            <h2 className="text-base font-semibold text-text-primary">{cfg.zoneName}</h2>
            <div className="grid grid-cols-2 gap-6">
              <Slider label="Detection Confidence Threshold" min={0} max={1} step={0.01} value={cfg.confidenceThreshold}
                onChange={v => update(cfg.zoneId, { confidenceThreshold: v })}
                formatValue={v => `${Math.round(v * 100)}%`} />
              <div className="flex flex-col gap-1">
                <label className="text-sm text-text-secondary font-medium">Escalation Delay (minutes)</label>
                <input type="number" min={1} max={60} value={cfg.escalationDelayMinutes}
                  onChange={e => update(cfg.zoneId, { escalationDelayMinutes: parseInt(e.target.value) || 5 })}
                  className="bg-panel-alt border border-border rounded-md px-3 py-2 text-sm text-text-primary w-24 focus:outline-none focus:ring-2 focus:ring-accent" />
                <p className="text-xs text-text-muted">Alerts unresolved after this time are auto-escalated.</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
    </PageShell>
  );
}

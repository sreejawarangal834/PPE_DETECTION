import { useEffect, useRef, useState } from 'react';
import Badge from '../../components/ui/Badge';
import type { Alert } from '../../types';
import { PPE_LABEL } from '../../constants/ppeTypes';
import { formatDate } from '../../lib/utils';

interface AlertRowProps {
  alert: Alert;
  isNew?: boolean;
  onClick: (alert: Alert) => void;
}

export default function AlertRow({ alert, isNew = false, onClick }: AlertRowProps) {
  const [animate, setAnimate] = useState(isNew);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (isNew) {
      setAnimate(true);
      const t = setTimeout(() => setAnimate(false), 3500);
      return () => clearTimeout(t);
    }
  }, [isNew]);

  return (
    <tr
      onClick={() => onClick(alert)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(alert); } }}
      tabIndex={0}
      role="button"
      aria-label={`Alert ${alert.id}: ${alert.severity} severity in ${alert.zoneName}`}
      className={`border-t border-border-soft cursor-pointer hover:bg-panel-alt transition-colors
        ${animate ? 'new-row-fade' : ''}
        ${alert.status === 'escalated' ? 'border-l-2 border-l-status-danger' : ''}`}
    >
      <td className="px-3 py-3 font-mono text-text-muted text-xs">{alert.id}</td>
      <td className="px-3 py-3 text-text-muted text-xs whitespace-nowrap">{alert.timestamp}</td>
      <td className="px-3 py-3 text-text-secondary">{alert.zoneName}</td>
      <td className="px-3 py-3 text-text-secondary">{alert.workerName}</td>
      <td className="px-3 py-3 text-text-secondary text-xs">
        {alert.missingPpe.map(p => PPE_LABEL[p] ?? p).join(', ')}
      </td>
      <td className="px-3 py-3"><Badge variant={alert.severity} /></td>
      <td className="px-3 py-3"><Badge variant={alert.status} /></td>
      <td className="px-3 py-3 text-text-muted text-xs">{alert.acknowledgedBy ?? '—'}</td>
      <td className="px-3 py-3 text-text-muted text-xs whitespace-nowrap">
        {alert.acknowledgedAt ? formatDate(alert.acknowledgedAt) : '—'}
      </td>
      <td className="px-3 py-3 text-text-muted text-xs">{alert.resolvedBy ?? '—'}</td>
      <td className="px-3 py-3 text-text-muted text-xs whitespace-nowrap">
        {alert.resolvedAt ? formatDate(alert.resolvedAt) : '—'}
      </td>
    </tr>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { WORKERS } from '../../data/workers';
import { mockWsService } from '../../lib/websocket/mockWebSocketService';
import type { WsEvent, Worker } from '../../types';
import { ROUTES } from '../../constants/routes';
import { Users } from 'lucide-react';

interface Props { selectedZone: string | null; assignedZones?: string[]; }

export default function LiveWorkerList({ selectedZone, assignedZones }: Props) {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<Worker[]>(() =>
    WORKERS.filter(w => w.currentZoneId)
  );

  useEffect(() => {
    function handler(e: WsEvent) {
      if (e.type !== 'worker_update') return;
      const p = e.payload as { workerId: string; zoneId: string; complianceStatus: string };
      setWorkers(prev => prev.map(w =>
        w.id === p.workerId
          ? { ...w, currentZoneId: p.zoneId, complianceRate: p.complianceStatus === 'compliant' ? 90 : 45 }
          : w
      ));
    }
    mockWsService.onMessage(handler);
    return () => { mockWsService.removeAllHandlers(); };
  }, []);

  const visible = workers
    .filter(w => !selectedZone || w.currentZoneId === selectedZone)
    .filter(w => !assignedZones?.length || (w.currentZoneId && assignedZones.includes(w.currentZoneId)));

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <Users className="w-7 h-7 text-text-muted opacity-40" aria-hidden="true" />
        <p className="text-xs text-text-muted">No workers currently detected</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border-soft">
      {visible.map(w => {
        const compliant = w.complianceRate >= 80;
        return (
          <button
            key={w.id}
            onClick={() => navigate(ROUTES.WORKER_PROFILE(w.id))}
            className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-panel-hover transition-colors duration-150 text-left
              ${!compliant ? 'border-l-2 border-l-status-danger' : ''}`}
          >
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-panel-alt flex items-center justify-center text-xs font-semibold text-accent shrink-0">
              {w.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary truncate leading-snug">{w.name}</p>
              <p className="text-xs text-text-muted font-mono truncate">{w.id}</p>
            </div>
            {/* Compliance indicator */}
            <span className={`text-xs font-medium shrink-0 ${compliant ? 'text-status-ok' : 'text-status-danger'}`}>
              {compliant ? '✓' : '✗'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

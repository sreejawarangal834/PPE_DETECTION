import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { WORKERS } from '../../data/workers';
import { mockWsService } from '../../lib/websocket/mockWebSocketService';
import { useDetectionStore } from '../../state/DetectionStore';
import type { Detection } from '../../hooks/useDetectionSocket';
import type { WsEvent, Worker } from '../../types';
import { ROUTES } from '../../constants/routes';
import { Users, Zap } from 'lucide-react';

interface LiveWorker {
  id: string; name: string; department: string;
  currentZoneId: string; currentZoneName: string;
  lastSeen: string; complianceRate: number;
  totalViolations: number; activeViolations: number;
  zonesVisited: string[];
}

interface Props { selectedZone: string | null; assignedZones?: string[]; }

export default function LiveWorkerList({ selectedZone, assignedZones }: Props) {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<Worker[]>(() =>
    WORKERS.filter(w => w.currentZoneId)
  );

  // YOLO26 live detection from store
  const { liveCamera } = useDetectionStore();
  const isLiveActive = liveCamera !== null && (
    liveCamera.status === 'streaming' || liveCamera.jpeg !== undefined
  );

  // Derive "live workers" from YOLO26 detections
  const liveWorkers: LiveWorker[] | null = isLiveActive && liveCamera
    ? liveCamera.detections
        .filter((d: Detection) =>
          d.label.toLowerCase().startsWith('person') || d.label.toLowerCase().includes('worker'))
        .map((d: Detection, i: number): LiveWorker => ({
          id:              `live-${i}`,
          name:            `Worker ${String.fromCharCode(65 + i)}`,
          department:      'Live Detection',
          currentZoneId:   'live',
          currentZoneName: liveCamera.name,
          lastSeen:        new Date().toISOString(),
          complianceRate:  d.label.toLowerCase().includes('no_') ? 30 : 90,
          totalViolations: d.label.toLowerCase().includes('no_') ? 1 : 0,
          activeViolations:d.label.toLowerCase().includes('no_') ? 1 : 0,
          zonesVisited:    [],
        }))
    : null;

  // Mock worker updates from WebSocket
  useEffect(() => {
    if (isLiveActive) return;     // don't overwrite live data with mock updates
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
  }, [isLiveActive]);

  // Which workers to display — typed union so .map callback is typed
  const displayWorkers: (Worker | LiveWorker)[] =
    isLiveActive && liveWorkers && liveWorkers.length > 0
      ? liveWorkers
      : workers
          .filter((w: Worker) => !selectedZone || w.currentZoneId === selectedZone)
          .filter((w: Worker) => !assignedZones?.length || (w.currentZoneId && assignedZones.includes(w.currentZoneId)));

  if (displayWorkers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <Users className="w-7 h-7 text-text-muted opacity-40" aria-hidden="true" />
        <p className="text-xs text-text-muted">No workers currently detected</p>
      </div>
    );
  }

  return (
    <div>
      {/* Live detection badge */}
      {isLiveActive && liveWorkers && liveWorkers.length > 0 && (
        <div className="px-4 py-2 border-b border-border-soft bg-accent/5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-accent flex items-center gap-1.5">
            <Zap className="w-3 h-3" aria-hidden="true" />
            YOLO26 · {liveWorkers.length} person{liveWorkers.length > 1 ? 's' : ''} detected
          </p>
        </div>
      )}

      <div className="divide-y divide-border-soft">
        {displayWorkers.map((w: Worker | LiveWorker) => {
          const compliant = w.complianceRate >= 80;
          const isLiveRow = w.id.startsWith('live-');
          return (
            <button
              key={w.id}
              onClick={() => isLiveRow ? undefined : navigate(ROUTES.WORKER_PROFILE(w.id))}
              disabled={isLiveRow}
              className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 text-left
                ${isLiveRow ? 'cursor-default' : 'hover:bg-panel-hover cursor-pointer'}
                ${!compliant ? 'border-l-2 border-l-status-danger' : ''}`}
            >
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0
                ${isLiveRow ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-panel-alt text-accent'}`}>
                {w.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate leading-snug">{w.name}</p>
                <p className="text-xs text-text-muted font-mono truncate">
                  {isLiveRow ? w.currentZoneName ?? 'Live Feed' : w.id}
                </p>
              </div>
              <span className={`text-xs font-medium shrink-0 ${compliant ? 'text-status-ok' : 'text-status-danger'}`}>
                {compliant ? '✓' : '✗'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

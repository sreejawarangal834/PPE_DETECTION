import { useQuery } from '@tanstack/react-query';
import { getCameras } from '../../api/camerasApi';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

export default function CameraStatusWidget({ assignedZones }: { assignedZones?: string[] }) {
  const { data: cameras = [] } = useQuery({ queryKey: ['cameras'], queryFn: getCameras, staleTime: 30_000 });
  const navigate = useNavigate();
  
  const filteredCameras = assignedZones?.length 
    ? cameras.filter(c => assignedZones.includes(c.zoneId))
    : cameras;
  
  const online = filteredCameras.filter(c => c.status === 'online').length;

  return (
    <div className="bg-panel border border-border-soft rounded-xl p-4 flex flex-col">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-3">Camera Status</p>

      <div className="grid grid-cols-4 gap-2">
        {filteredCameras.map(c => {
          const isOnline = c.status === 'online';
          const isError  = c.status === 'error';
          const dotColor = isOnline ? 'bg-status-ok' : isError ? 'bg-status-warn' : 'bg-status-danger';
          return (
            <button
              key={c.id}
              onClick={() => navigate(ROUTES.MONITORING)}
              aria-label={`${c.id} is ${c.status}`}
              title={`${c.name} — ${c.status}`}
              className="aspect-square rounded-lg bg-panel-alt border border-border flex flex-col items-center justify-center gap-1 hover:border-border-focus transition-colors"
            >
              <span className={`w-2 h-2 rounded-full ${dotColor}`} aria-hidden="true" />
              <span className="text-[10px] font-mono text-text-secondary">{c.id}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-text-muted mt-2">
        <span className="text-status-ok font-semibold">{online}</span>/{filteredCameras.length} online
      </p>
    </div>
  );
}

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
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 flex flex-col gap-4 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Cameras</p>
        <span className="text-sm font-mono text-white bg-gray-700 px-3 py-1 rounded-lg">
          <span className="text-green-400 font-bold">{online}</span>/{filteredCameras.length} online
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {filteredCameras.map(c => {
          const isOnline  = c.status === 'online';
          const isError   = c.status === 'error';
          const dotColor  = isOnline ? 'text-green-400' : isError ? 'text-yellow-400' : 'text-red-400';
          const textColor = isOnline ? 'text-white' : 'text-gray-400';
          return (
            <button
              key={c.id}
              onClick={() => navigate(ROUTES.MONITORING)}
              aria-label={`${c.id} is ${c.status}`}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg text-sm font-mono hover:bg-gray-600 border border-transparent transition-all duration-300 text-left"
            >
              <span className={`text-[12px] leading-none ${dotColor}`} aria-hidden="true">●</span>
              <span className={`truncate ${textColor}`}>{c.id}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

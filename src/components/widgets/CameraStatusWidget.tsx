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
    <div className="bg-[#1B1F27] border border-[#21252D] rounded-2xl p-5 flex flex-col gap-4 hover:border-[#4A8FA3]/30 transition-all duration-300">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#9BA3B8]">Cameras</p>
        <span className="text-sm font-mono text-[#E8EAF0] bg-[#20242D] px-3 py-1 rounded-lg">
          <span className="text-[#4F9E7C] font-bold">{online}</span>/{filteredCameras.length} online
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {filteredCameras.map(c => {
          const isOnline  = c.status === 'online';
          const isError   = c.status === 'error';
          const dotColor  = isOnline ? 'text-[#4F9E7C]' : isError ? 'text-[#D9A441]' : 'text-[#C25450]';
          const textColor = isOnline ? 'text-[#E8EAF0]' : 'text-[#9BA3B8]';
          return (
            <button
              key={c.id}
              onClick={() => navigate(ROUTES.MONITORING)}
              aria-label={`${c.id} is ${c.status}`}
              className="flex items-center gap-2 px-3 py-2 bg-[#20242D] rounded-lg text-sm font-mono hover:bg-[#252A35] hover:border-[#4A8FA3]/30 border border-transparent transition-all duration-300 text-left"
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

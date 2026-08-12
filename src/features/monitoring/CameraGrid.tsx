import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCameras } from '../../api/camerasApi';
import CameraCard from './CameraCard';
import CameraDetailPanel from './CameraDetailPanel';
import SessionCard from './SessionCard';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import type { Camera } from '../../types';
import { useDetectionStore } from '../../state/DetectionStore';

interface CameraGridProps {
  selectedZone: string | null;
  onCameraSelect?: (camera: Camera) => void;
  onStopSession?: (id: string) => void;
  visibleClasses?: Set<string>;
}

// The CCTV grid — every camera slot renders here, in place. A slot with a
// live session bound to it (uploaded video or webcam, picked via
// CameraSlotPicker) shows that session's real feed; an idle slot shows the
// placeholder camera card. There is no separate "live sessions" area.
export default function CameraGrid({ selectedZone, onCameraSelect, onStopSession, visibleClasses }: CameraGridProps) {
  const { data: cameras = [], isLoading } = useQuery({ queryKey: ['cameras'], queryFn: getCameras, staleTime: 30_000 });
  const { sessions } = useDetectionStore();
  const [selectedCam, setSelectedCam] = useState<Camera | null>(null);

  const visible = selectedZone ? cameras.filter(c => c.zoneId === selectedZone) : cameras;

  const handleCameraClick = (camera: Camera) => {
    if (onCameraSelect) {
      onCameraSelect(camera);
    } else {
      setSelectedCam(camera);
    }
  };

  if (isLoading) return <LoadingSkeleton variant="card" count={6} />;

  return (
    <>
      {visible.length === 0 ? (
        <EmptyState heading="No cameras" message={selectedZone ? 'No cameras in this zone.' : 'No cameras configured.'} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visible.map(c => {
            const session = sessions.find(s => s.cameraId === c.id);
            return session ? (
              <SessionCard
                key={c.id}
                session={session}
                onStop={onStopSession ?? (() => {})}
                visibleClasses={visibleClasses}
                onClick={() => handleCameraClick(c)}
              />
            ) : (
              <CameraCard key={c.id} camera={c} onClick={handleCameraClick} />
            );
          })}
        </div>
      )}
      {selectedCam && !onCameraSelect && (
        <CameraDetailPanel
          camera={selectedCam}
          cameras={cameras}
          onClose={() => setSelectedCam(null)}
          onStopSession={onStopSession}
        />
      )}
    </>
  );
}

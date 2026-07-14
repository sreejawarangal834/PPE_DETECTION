import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCameras } from '../../api/camerasApi';
import CameraCard from './CameraCard';
import CameraDetailPanel from './CameraDetailPanel';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import type { Camera } from '../../types';

interface CameraGridProps {
  selectedZone: string | null;
  onCameraSelect?: (camera: Camera) => void;
}

export default function CameraGrid({ selectedZone, onCameraSelect }: CameraGridProps) {
  const { data: cameras = [], isLoading } = useQuery({ queryKey: ['cameras'], queryFn: getCameras, staleTime: 30_000 });
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
          {visible.map(c => <CameraCard key={c.id} camera={c} onClick={handleCameraClick} />)}
        </div>
      )}
      {selectedCam && !onCameraSelect && <CameraDetailPanel camera={selectedCam} cameras={cameras} onClose={() => setSelectedCam(null)} />}
    </>
  );
}

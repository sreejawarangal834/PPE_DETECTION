/**
 * Modal shown before a video upload/webcam session starts, so it lands
 * bound to a specific camera slot (and therefore that slot's zone policy)
 * instead of appearing in a separate, unassigned area of the page.
 */
import { useQuery } from '@tanstack/react-query';
import { Camera as CameraIcon } from 'lucide-react';
import Dialog from '../../components/ui/Dialog';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import { getCameras } from '../../api/camerasApi';
import { useDetectionStore } from '../../state/DetectionStore';

interface CameraSlotPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (cameraId: string) => void;
  title?: string;
}

export default function CameraSlotPicker({ open, onClose, onSelect, title = 'Assign to a camera' }: CameraSlotPickerProps) {
  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ['cameras'], queryFn: getCameras, staleTime: 30_000, enabled: open,
  });
  const { sessions } = useDetectionStore();
  const boundCameraIds = new Set(sessions.map(s => s.cameraId).filter(Boolean));
  const idleCameras = cameras.filter(c => !boundCameraIds.has(c.id));

  function handleSelect(cameraId: string) {
    onSelect(cameraId);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-xs text-text-muted mb-3">
        Pick which camera's zone policy applies to this feed. Every zone requires different PPE, so the
        compliance engine needs to know which one this camera belongs to.
      </p>
      {isLoading ? (
        <LoadingSkeleton variant="line" rows={4} />
      ) : idleCameras.length === 0 ? (
        <EmptyState
          heading="No free camera slots"
          message="Every camera already has a live session running. Stop one first, or add a camera in Admin → Cameras."
        />
      ) : (
        <div className="space-y-1.5">
          {idleCameras.map(c => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border-soft
                hover:border-accent hover:bg-panel-alt transition-colors duration-150 text-left"
            >
              <CameraIcon className="w-4 h-4 text-text-muted shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{c.name}</p>
                <p className="text-xs text-text-muted truncate">{c.id} · {c.zoneName}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
}

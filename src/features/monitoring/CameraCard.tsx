import { VideoOff } from 'lucide-react';
import type { Camera } from '../../types';
import Badge from '../../components/ui/Badge';

interface CameraCardProps { camera: Camera; onClick: (cam: Camera) => void; }

/**
 * Idle camera slot — CameraGrid.tsx only renders this for a camera with no active
 * detection session bound in THIS browser (an active one renders the real SessionCard
 * instead), so there is no live feed, fps, latency, or worker count to show here. This used
 * to fabricate all four via a fake `camera_metrics_update` event from
 * mockWebSocketService.ts, including a pulsing "LIVE" badge on a camera nobody is actually
 * streaming — replaced with an honest idle state showing only the camera's real DB-known
 * status (backend/repositories/cameras.py — online/offline/reconnecting, driven by
 * RTSPSource's actual reconnect loop, not fabricated).
 */
export default function CameraCard({ camera, onClick }: CameraCardProps) {
  return (
    <button
      onClick={() => onClick(camera)}
      className="bg-panel border border-border-soft rounded-2xl overflow-hidden hover:border-accent hover:shadow-lg hover:shadow-accent/10 transition-all duration-300 text-left w-full group transform hover:scale-[1.02]"
    >
      {/* Feed area — idle */}
      <div className="relative h-80 bg-bg flex flex-col items-center justify-center gap-3">
        <VideoOff className="w-10 h-10 text-text-muted opacity-40" aria-hidden="true" />
        <p className="text-sm text-text-muted font-medium">
          {camera.status === 'online' ? 'Not connected in this view' : 'No signal'}
        </p>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-panel-alt">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-base font-semibold text-text-primary truncate">{camera.name}</p>
          <Badge variant={camera.status} className="shrink-0" />
        </div>
        <p className="text-sm text-text-secondary truncate">{camera.zoneName}</p>
      </div>
    </button>
  );
}

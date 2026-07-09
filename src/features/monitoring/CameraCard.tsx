import { useState, useEffect } from 'react';
import { VideoOff, Users, AlertTriangle } from 'lucide-react';
import type { Camera } from '../../types';
import { mockWsService } from '../../lib/websocket/mockWebSocketService';
import type { WsEvent } from '../../types';
import Badge from '../../components/ui/Badge';

interface CameraCardProps { camera: Camera; onClick: (cam: Camera) => void; }

export default function CameraCard({ camera: initial, onClick }: CameraCardProps) {
  const [cam, setCam] = useState(initial);

  useEffect(() => {
    function handler(e: WsEvent) {
      if (e.type !== 'camera_metrics_update') return;
      const p = e.payload as { cameraId: string; fps: number; latencyMs: number; workerCount: number; violations: number };
      if (p.cameraId !== initial.id) return;
      setCam(c => ({ ...c, fps: p.fps, latencyMs: p.latencyMs, workersDetected: p.workerCount, activeViolations: p.violations }));
    }
    mockWsService.onMessage(handler);
    return () => { mockWsService.removeAllHandlers(); };
  }, [initial.id]);

  const isOffline = cam.status === 'offline';
  const hasViolations = cam.activeViolations > 0;

  return (
    <button
      onClick={() => onClick(cam)}
      className="bg-[#1B1F27] border border-[#21252D] rounded-2xl overflow-hidden hover:border-[#4A8FA3] hover:shadow-lg hover:shadow-[#4A8FA3]/10 transition-all duration-300 text-left w-full group transform hover:scale-[1.02]"
    >
      {/* Feed area */}
      <div
        className={`relative h-80 ${isOffline ? 'bg-[#12151A]' : ''}`}
        style={!isOffline ? {
          backgroundImage: 'repeating-linear-gradient(115deg, #20242D 0px, #20242D 2px, #12151A 2px, #12151A 4px)',
        } : {}}
      >
        {isOffline ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <VideoOff className="w-10 h-10 text-[#5C6480] opacity-40 animate-pulse" aria-hidden="true" />
            <p className="text-sm text-[#5C6480] font-medium">No Signal</p>
          </div>
        ) : (
          <>
            {/* LIVE badge */}
            <div className="absolute top-3 left-3 flex items-center gap-2 text-sm font-semibold text-[#4F9E7C] bg-[#0f1117]/90 px-3 py-1 rounded-lg font-mono backdrop-blur-md border border-[#4F9E7C]/20">
              <span className="w-2 h-2 rounded-full bg-[#4F9E7C] animate-pulse" aria-hidden="true" />
              LIVE
            </div>
            {/* Metrics */}
            <div className="absolute top-3 right-3 text-sm font-mono text-[#9BA3B8] bg-[#0f1117]/90 px-3 py-1 rounded-lg backdrop-blur-md border border-[#262B34]/50">
              {cam.fps.toFixed(1)} fps · {cam.latencyMs}ms
            </div>
            {/* Camera ID */}
            <div className="absolute bottom-3 left-3 text-sm font-mono text-[#9BA3B8] bg-[#0f1117]/90 px-3 py-1 rounded-lg backdrop-blur-md border border-[#262B34]/50">
              {cam.id}
            </div>
            {/* Worker count */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-sm font-mono text-[#E8EAF0] bg-[#0f1117]/90 px-3 py-1 rounded-lg backdrop-blur-md border border-[#262B34]/50">
              <Users className="w-4 h-4" aria-hidden="true" />
              {cam.workersDetected}
            </div>
            {/* Simulated bounding boxes with animation */}
            {hasViolations && (
              <div className="absolute border-2 border-[#C25450] rounded-lg opacity-90 animate-pulse"
                style={{ left:'35%', top:'20%', width:'18%', height:'55%' }} />
            )}
            <div className="absolute border-2 border-[#4A8FA3] rounded-lg opacity-70 transition-all duration-500 hover:opacity-100"
              style={{ left:'57%', top:'30%', width:'15%', height:'45%' }} />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-[#161a22]">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-base font-semibold text-[#E8EAF0] truncate">{cam.name}</p>
          <Badge variant={cam.status} className="shrink-0" />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#9BA3B8] truncate">{cam.zoneName}</p>
          {hasViolations && (
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[#C25450] shrink-0 animate-pulse">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              {cam.activeViolations} violation{cam.activeViolations > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

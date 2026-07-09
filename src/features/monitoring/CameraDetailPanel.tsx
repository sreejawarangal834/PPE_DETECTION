import { useState } from 'react';
import Drawer from '../../components/ui/Drawer';
import Badge from '../../components/ui/Badge';
import { useAlertStore } from '../../lib/alerts/alertStore';
import type { Camera } from '../../types';
import { Wifi, WifiOff, Clock, Users, AlertTriangle } from 'lucide-react';

interface Props {
  camera: Camera;
  cameras: Camera[];
  onClose?: () => void;
  onCameraChange?: (camera: Camera) => void;
  mode?: 'drawer' | 'full';
}

export default function CameraDetailPanel({ camera, cameras, onClose, onCameraChange, mode = 'drawer' }: Props) {
  const [selectedCamera, setSelectedCamera] = useState(camera);
  const recentAlerts = useAlertStore(s => s.alerts)
    .filter(a => a.cameraId === selectedCamera.id)
    .slice(0, 6);

  const handleCameraSelect = (cam: Camera) => {
    setSelectedCamera(cam);
    onCameraChange?.(cam);
  };

  const isOnline = selectedCamera.status === 'online';

  const Content = () => (
    <div className="flex flex-col gap-4">

      {/* Camera Selector — full mode only */}
      {mode === 'full' && cameras.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {cameras.map(cam => {
            const active = selectedCamera.id === cam.id;
            const online = cam.status === 'online';
            return (
              <button
                key={cam.id}
                onClick={() => handleCameraSelect(cam)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold
                  transition-all duration-200 border
                  ${active
                    ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20'
                    : 'bg-panel-alt border-border text-text-secondary hover:text-text-primary hover:border-accent/50 hover:bg-panel-hover'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${online ? 'bg-status-ok' : 'bg-status-danger'}`} />
                {cam.id}
              </button>
            );
          })}
        </div>
      )}

      {/* ── CAMERA FEED — dominant, fills most of the viewport ── */}
      <div
        className={`relative rounded-2xl border overflow-hidden ${
          isOnline ? 'border-border-soft' : 'border-border-soft bg-panel-alt'
        } ${mode === 'full' ? 'h-[calc(100vh-260px)] min-h-[500px]' : 'h-48 mx-4 mt-4'}`}
        style={isOnline ? {
          backgroundImage: 'repeating-linear-gradient(115deg,#20242D 0,#20242D 2px,#12151A 2px,#12151A 4px)',
        } : {}}
      >
        {/* LIVE badge */}
        {isOnline ? (
          <>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 text-xs font-semibold text-status-ok bg-bg/85 px-3 py-1.5 rounded-lg font-mono backdrop-blur-sm border border-status-ok/20">
              <span className="w-2 h-2 rounded-full bg-status-ok animate-pulse" aria-hidden="true" />
              LIVE
            </div>
            <div className="absolute top-3 right-3 flex items-center gap-2 text-xs font-mono text-text-muted bg-bg/85 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-border-soft/50">
              <Wifi className="w-3 h-3 text-status-ok" aria-hidden="true" />
              {selectedCamera.fps.toFixed(1)} fps · {selectedCamera.latencyMs}ms
            </div>
            {/* Camera ID watermark */}
            <div className="absolute bottom-3 left-3 text-xs font-mono text-text-muted bg-bg/70 px-2 py-1 rounded-md backdrop-blur-sm">
              {selectedCamera.id} · {selectedCamera.zoneName}
            </div>
            {/* Violation bounding box */}
            {selectedCamera.activeViolations > 0 && (
              <>
                <div className="absolute border-2 rounded-sm"
                  style={{ left: '32%', top: '18%', width: '20%', height: '52%', borderColor: 'var(--color-status-danger)' }} />
                <div className="absolute text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg/85 text-status-danger"
                  style={{ left: '32%', top: '13%' }}>
                  no-helmet 0.91
                </div>
              </>
            )}
            <div className="absolute border-2 rounded-sm opacity-70"
              style={{ left: '57%', top: '28%', width: '16%', height: '44%', borderColor: 'var(--color-accent)' }} />
            {/* Centre label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[#5C6480]/40 text-sm font-medium select-none">PPE Monitoring Feed</span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <WifiOff className="w-10 h-10 text-text-muted opacity-25" aria-hidden="true" />
            <p className="text-sm text-text-muted">No Signal — Camera Offline</p>
          </div>
        )}
      </div>

      {/* ── COMPACT STAT STRIP — 4 items in one horizontal row ── */}
      <div className="grid grid-cols-4 gap-2">
        {([
          { icon: <span className="text-[8px]">🗺</span>, label: 'Zone',       value: selectedCamera.zoneName,                     accent: false },
          { icon: <Users className="w-3 h-3" />,        label: 'Workers',   value: String(selectedCamera.workersDetected),      accent: false },
          { icon: <AlertTriangle className="w-3 h-3" />,label: 'Violations',value: String(selectedCamera.activeViolations),     accent: selectedCamera.activeViolations > 0 },
          { icon: isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />,
            label: 'Status', value: selectedCamera.status, accent: false },
        ] as { icon: React.ReactNode; label: string; value: string; accent: boolean }[]).map(stat => (
          <div key={stat.label}
            className="bg-panel-alt border border-border-soft rounded-lg px-2 py-2 flex flex-col gap-0.5 hover:border-accent/20 transition-colors duration-200">
            <div className={`flex items-center gap-1 ${stat.accent ? 'text-status-danger' : 'text-text-muted'}`}>
              {stat.icon}
              <span className="text-[8px] font-medium uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className={`text-xs font-semibold capitalize leading-tight ${
              stat.label === 'Status'
                ? isOnline ? 'text-status-ok' : 'text-status-danger'
                : stat.accent ? 'text-status-danger' : 'text-text-primary'
            }`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── RECENT EVENTS ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Recent Events</p>
        </div>
        {recentAlerts.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">No recent events for this camera.</p>
        ) : (
          <div className="space-y-1">
            {recentAlerts.map(a => (
              <div key={a.id}
                className="flex items-center gap-3 py-2.5 px-3 border-b border-border-soft hover:bg-panel-hover transition-colors duration-150 rounded-lg">
                <Badge variant={a.severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate font-medium">{a.missingPpe.join(', ')}</p>
                  <p className="text-xs text-text-muted font-mono">{a.timestamp} · {a.workerName}</p>
                </div>
                <Badge variant={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (mode === 'drawer') {
    return (
      <Drawer open onClose={onClose!} title={selectedCamera.name} width="w-[440px]">
        <div className="p-4">
          <Content />
        </div>
      </Drawer>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto">
      <Content />
    </div>
  );
}

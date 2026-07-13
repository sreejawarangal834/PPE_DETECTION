import { useState, useEffect, useRef } from 'react';
import Drawer from '../../components/ui/Drawer';
import Badge from '../../components/ui/Badge';
import { useAlertStore } from '../../lib/alerts/alertStore';
import { useDetectionStore } from '../../state/DetectionStore';
import type { Camera } from '../../types';
import { Wifi, WifiOff, Clock, Users, AlertTriangle, Activity } from 'lucide-react';
import type { Detection } from '../../hooks/useDetectionSocket';

interface Props {
  camera: Camera;
  cameras: Camera[];
  onClose?: () => void;
  onCameraChange?: (camera: Camera) => void;
  mode?: 'drawer' | 'full';
}

/* ── Bounding-box overlay drawn on a <canvas> over the JPEG ── */
function BoundingBoxCanvas({
  detections, width, height,
}: { detections: Detection[]; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    detections.forEach(det => {
      const [x1, y1, x2, y2] = det.box;
      const boxW = (x2 - x1) * width;
      const boxH = (y2 - y1) * height;
      const bx   = x1 * width;
      const by   = y1 * height;

      // Colour by confidence
      const isViolation = det.label.toLowerCase().includes('no_') ||
                          det.label.toLowerCase().includes('missing');
      const col = isViolation ? '#C25450' : '#4A8FA3';

      // Box
      ctx.strokeStyle = col;
      ctx.lineWidth   = 2;
      ctx.strokeRect(bx, by, boxW, boxH);

      // Label background
      const label = `${det.label} ${(det.conf * 100).toFixed(0)}%`;
      ctx.font = '11px IBM Plex Mono, monospace';
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = `${col}cc`;
      ctx.fillRect(bx, by - 18, textW + 8, 18);

      // Label text
      ctx.fillStyle = '#fff';
      ctx.fillText(label, bx + 4, by - 5);
    });
  }, [detections, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}

export default function CameraDetailPanel({
  camera, cameras, onClose, onCameraChange, mode = 'drawer',
}: Props) {
  const [selectedCamera, setSelectedCamera] = useState(camera);
  const recentAlerts = useAlertStore(s => s.alerts)
    .filter(a => a.cameraId === selectedCamera.id)
    .slice(0, 6);

  // Live detection data from store
  const { liveCamera } = useDetectionStore();
  const isLiveActive = liveCamera !== null && (
    liveCamera.status === 'streaming' || liveCamera.jpeg !== undefined
  );

  // Feed container dimensions (for canvas overlay scaling)
  const feedRef  = useRef<HTMLDivElement>(null);
  const [feedSize, setFeedSize] = useState({ w: 640, h: 360 });

  useEffect(() => {
    if (!feedRef.current) return;
    const obs = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setFeedSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(feedRef.current);
    return () => obs.disconnect();
  }, []);

  const handleCameraSelect = (cam: Camera) => {
    setSelectedCamera(cam);
    onCameraChange?.(cam);
  };

  const isOnline     = selectedCamera.status === 'online';
  const feedHeight   = mode === 'full' ? 'h-[calc(100vh-280px)] min-h-[360px]' : 'h-48 mx-4 mt-4';

  const Content = () => (
    <div className="flex flex-col gap-4">

      {/* Camera selector */}
      {mode === 'full' && cameras.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {cameras.map(cam => {
            const active = selectedCamera.id === cam.id;
            const online = cam.status === 'online';
            return (
              <button key={cam.id} onClick={() => handleCameraSelect(cam)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold
                  transition-all duration-200 border
                  ${active
                    ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20'
                    : 'bg-panel-alt border-border text-text-secondary hover:text-text-primary hover:border-accent/50 hover:bg-panel-hover'}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${online ? 'bg-status-ok' : 'bg-status-danger'}`} />
                {cam.id}
              </button>
            );
          })}
        </div>
      )}

      {/* ── FEED AREA ── */}
      <div
        ref={feedRef}
        className={`relative rounded-2xl border overflow-hidden ${feedHeight} ${
          isOnline || isLiveActive ? 'border-border-soft' : 'border-border-soft bg-panel-alt'
        }`}
        style={(!isLiveActive && isOnline) ? {
          backgroundImage: 'repeating-linear-gradient(115deg,#20242D 0,#20242D 2px,#12151A 2px,#12151A 4px)',
        } : {}}
      >
        {isLiveActive && liveCamera?.jpeg ? (
          /* ── REAL JPEG FRAME from YOLO26 backend ── */
          <>
            <img
              src={`data:image/jpeg;base64,${liveCamera.jpeg}`}
              alt="Live YOLO26 detection frame"
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
            {/* Bounding-box canvas overlay */}
            {liveCamera.detections.length > 0 && (
              <BoundingBoxCanvas
                detections={liveCamera.detections}
                width={feedSize.w}
                height={feedSize.h}
              />
            )}
            {/* LIVE badge */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 text-xs font-semibold text-status-ok bg-bg/85 px-3 py-1.5 rounded-lg font-mono backdrop-blur-sm border border-status-ok/20">
              <span className="w-2 h-2 rounded-full bg-status-ok animate-pulse" />
              LIVE · YOLO26
            </div>
            {/* Frame counter */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 text-xs font-mono text-text-muted bg-bg/85 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-border-soft/50">
              <Activity className="w-3 h-3" aria-hidden="true" />
              Frame {liveCamera.frameIndex}
            </div>
            {/* Severity badge */}
            {liveCamera.severity && liveCamera.severity !== 'info' && (
              <div className="absolute bottom-3 right-3">
                <Badge variant={liveCamera.severity} />
              </div>
            )}
            {/* Camera watermark */}
            <div className="absolute bottom-3 left-3 text-xs font-mono text-text-muted bg-bg/70 px-2 py-1 rounded-md backdrop-blur-sm">
              {selectedCamera.id} · {selectedCamera.zoneName}
            </div>
            {/* Violation list overlay */}
            {liveCamera.violations.length > 0 && (
              <div className="absolute top-12 left-3 flex flex-col gap-1 max-w-[200px]">
                {liveCamera.violations.slice(0, 4).map((v: string, i: number) => (
                  <span key={i}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg/85 text-status-danger border border-status-danger/30">
                    ⚠ {v}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : isOnline ? (
          /* ── MOCK FEED (no live session active) ── */
          <>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 text-xs font-semibold text-status-ok bg-bg/85 px-3 py-1.5 rounded-lg font-mono backdrop-blur-sm border border-status-ok/20">
              <span className="w-2 h-2 rounded-full bg-status-ok animate-pulse" />
              LIVE
            </div>
            <div className="absolute top-3 right-3 flex items-center gap-2 text-xs font-mono text-text-muted bg-bg/85 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-border-soft/50">
              <Wifi className="w-3 h-3 text-status-ok" />
              {selectedCamera.fps.toFixed(1)} fps · {selectedCamera.latencyMs}ms
            </div>
            <div className="absolute bottom-3 left-3 text-xs font-mono text-text-muted bg-bg/70 px-2 py-1 rounded-md backdrop-blur-sm">
              {selectedCamera.id} · {selectedCamera.zoneName}
            </div>
            {selectedCamera.activeViolations > 0 && (
              <>
                <div className="absolute border-2 rounded-sm"
                  style={{ left:'32%', top:'18%', width:'20%', height:'52%', borderColor:'var(--color-status-danger)' }} />
                <div className="absolute text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg/85 text-status-danger"
                  style={{ left:'32%', top:'13%' }}>no-helmet 0.91</div>
              </>
            )}
            <div className="absolute border-2 rounded-sm opacity-70"
              style={{ left:'57%', top:'28%', width:'16%', height:'44%', borderColor:'var(--color-accent)' }} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[#5C6480]/40 text-sm font-medium select-none">PPE Monitoring Feed</span>
            </div>
          </>
        ) : (
          /* ── OFFLINE ── */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <WifiOff className="w-10 h-10 text-text-muted opacity-25" />
            <p className="text-sm text-text-muted">No Signal — Camera Offline</p>
          </div>
        )}
      </div>

      {/* ── STAT STRIP (live data when available, mock otherwise) ── */}
      <div className="grid grid-cols-4 gap-2">
        {([
          {
            icon: <span className="text-[8px]">🗺</span>,
            label: 'Zone',
            value: selectedCamera.zoneName,
            accent: false,
          },
          {
            icon: <Users className="w-3 h-3" />,
            label: 'Workers',
            value: String(selectedCamera.workersDetected),
            accent: false,
          },
          {
            icon: <AlertTriangle className="w-3 h-3" />,
            label: 'Violations',
            value: isLiveActive
              ? String(liveCamera?.violations.length ?? 0)
              : String(selectedCamera.activeViolations),
            accent: isLiveActive
              ? (liveCamera?.violations.length ?? 0) > 0
              : selectedCamera.activeViolations > 0,
          },
          {
            icon: isOnline || isLiveActive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />,
            label: 'Status',
            value: isLiveActive ? (liveCamera?.status ?? 'streaming') : selectedCamera.status,
            accent: false,
          },
        ] as { icon: React.ReactNode; label: string; value: string; accent: boolean }[]).map(stat => (
          <div key={stat.label}
            className="bg-panel-alt border border-border-soft rounded-lg px-2 py-2 flex flex-col gap-0.5 hover:border-accent/20 transition-colors duration-200">
            <div className={`flex items-center gap-1 ${stat.accent ? 'text-status-danger' : 'text-text-muted'}`}>
              {stat.icon}
              <span className="text-[8px] font-medium uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className={`text-xs font-semibold capitalize leading-tight ${
              stat.label === 'Status'
                ? (isOnline || isLiveActive) ? 'text-status-ok' : 'text-status-danger'
                : stat.accent ? 'text-status-danger' : 'text-text-primary'
            }`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── LIVE DETECTIONS (from YOLO26) when active ── */}
      {isLiveActive && liveCamera && liveCamera.detections.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              YOLO26 Detections · Frame {liveCamera.frameIndex}
            </p>
          </div>
          <div className="space-y-1">
            {liveCamera.detections.map((det: Detection, i: number) => {
              const isViol = det.label.toLowerCase().includes('no_') || det.label.toLowerCase().includes('missing');
              return (
                <div key={i}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-panel-alt border border-border-soft">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isViol ? 'bg-status-danger' : 'bg-status-ok'}`} />
                  <span className="text-xs font-mono text-text-primary flex-1 truncate">{det.label}</span>
                  <span className={`text-xs font-mono font-bold ${isViol ? 'text-status-danger' : 'text-status-ok'}`}>
                    {(det.conf * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── RECENT EVENTS (mock alert store fallback) ── */}
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
        <div className="p-4"><Content /></div>
      </Drawer>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto">
      <Content />
    </div>
  );
}

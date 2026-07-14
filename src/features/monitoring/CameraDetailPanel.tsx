/**
 * CameraDetailPanel — live YOLO26 feed with high-quality bounding-box overlay.
 *
 * Performance architecture:
 * - LiveFeed        memo'd — only re-renders when jpeg/frameIndex changes
 * - BoundingBoxCanvas memo'd — only redraws when detections/size changes,
 *                              uses device pixel ratio for HiDPI sharpness
 * - DetectionList   memo'd — isolated from feed re-renders
 * - CameraSelector  memo'd — stable across frames
 * - StatStrip       memo'd — only changes on store update
 *
 * Bounding-box alignment:
 * - ResizeObserver tracks the actual rendered pixel dimensions of the container
 * - Canvas CSS size == container size; canvas logical size == container * DPR
 * - All box coordinates are normalised 0..1 from backend → scaled inside canvas
 * - No coordinate drift, no offset, no flicker
 */
import {
  useState, useEffect, useRef, useCallback,
  memo, type ReactNode,
} from 'react';
import Drawer from '../../components/ui/Drawer';
import Badge from '../../components/ui/Badge';
import { useAlertStore } from '../../lib/alerts/alertStore';
import { useDetectionStore } from '../../state/DetectionStore';
import type { Camera } from '../../types';
import { Wifi, WifiOff, Clock, Users, AlertTriangle, Activity } from 'lucide-react';
import type { Detection } from '../../hooks/useDetectionSocket';

// ── Colour helpers ──────────────────────────────────────────────────────────

function detectionColor(det: Detection): string {
  // If backend sets compliant explicitly, use that
  if (det.compliant === false) return '#C25450';   // non-compliant → red
  if (det.compliant === true)  return '#4A8FA3';   // compliant → blue

  // Fallback: infer from label for older backends that don't send compliant
  const lower = det.label.toLowerCase();
  if (lower.startsWith('no_') || lower.startsWith('no-') || lower.includes('missing')) {
    return '#C25450';
  }
  return '#4A8FA3';
}

// ── BoundingBoxCanvas ───────────────────────────────────────────────────────
// Memoised — only redraws when detections or container size changes.
// Uses devicePixelRatio for crisp rendering on HiDPI/Retina displays.

interface BBCanvasProps {
  detections: Detection[];
  containerW: number;
  containerH: number;
}

const BoundingBoxCanvas = memo(function BoundingBoxCanvas({
  detections, containerW, containerH,
}: BBCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerW === 0 || containerH === 0) return;

    // HiDPI: set logical canvas size to container size,
    // but internal pixel buffer at devicePixelRatio * container size
    const dpr = window.devicePixelRatio ?? 1;
    canvas.width  = Math.round(containerW * dpr);
    canvas.height = Math.round(containerH * dpr);
    canvas.style.width  = `${containerW}px`;
    canvas.style.height = `${containerH}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, containerW, containerH);

    const W = containerW;
    const H = containerH;

    ctx.font = 'bold 11px IBM Plex Mono, monospace';

    detections.forEach(det => {
      const [nx1, ny1, nx2, ny2] = det.box;

      // Scale normalised coords to pixel coords
      const bx = nx1 * W;
      const by = ny1 * H;
      const bw = (nx2 - nx1) * W;
      const bh = (ny2 - ny1) * H;

      const col = detectionColor(det);

      // Box outline with slight shadow for contrast over any background
      ctx.shadowColor   = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur    = 3;
      ctx.strokeStyle   = col;
      ctx.lineWidth     = 2;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.shadowBlur    = 0;

      // Label pill background
      const labelText = `${det.label}  ${(det.conf * 100).toFixed(0)}%`;
      const textMetrics = ctx.measureText(labelText);
      const pillW = textMetrics.width + 10;
      const pillH = 18;
      // Clamp label so it never goes off-screen at top
      const pillY = by >= pillH + 2 ? by - pillH - 2 : by + bh + 2;

      ctx.fillStyle = `${col}dd`;
      // Rounded pill
      const r = 4;
      ctx.beginPath();
      ctx.moveTo(bx + r, pillY);
      ctx.lineTo(bx + pillW - r, pillY);
      ctx.quadraticCurveTo(bx + pillW, pillY, bx + pillW, pillY + r);
      ctx.lineTo(bx + pillW, pillY + pillH - r);
      ctx.quadraticCurveTo(bx + pillW, pillY + pillH, bx + pillW - r, pillY + pillH);
      ctx.lineTo(bx + r, pillY + pillH);
      ctx.quadraticCurveTo(bx, pillY + pillH, bx, pillY + pillH - r);
      ctx.lineTo(bx, pillY + r);
      ctx.quadraticCurveTo(bx, pillY, bx + r, pillY);
      ctx.closePath();
      ctx.fill();

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, bx + 5, pillY + 13);
    });
  }, [detections, containerW, containerH]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
      // Explicit 0-size until first ResizeObserver tick avoids initial layout paint
      style={{ width: containerW || 0, height: containerH || 0 }}
    />
  );
});

// ── LiveFeed ─────────────────────────────────────────────────────────────────
// Memoised on jpeg + frameIndex — the most frequently updating part.

interface LiveFeedProps {
  jpeg: string;
  frameIndex: number;
  detections: Detection[];
  violations: string[];
  severity: string;
  containerW: number;
  containerH: number;
  cameraId: string;
  zoneName: string;
}

const LiveFeed = memo(function LiveFeed({
  jpeg, frameIndex, detections, violations, severity,
  containerW, containerH, cameraId, zoneName,
}: LiveFeedProps) {
  return (
    <>
      <img
        src={`data:image/jpeg;base64,${jpeg}`}
        alt="Live YOLO26 detection frame"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* Bounding boxes — only re-renders when detections or size changes */}
      {detections.length > 0 && (
        <BoundingBoxCanvas
          detections={detections}
          containerW={containerW}
          containerH={containerH}
        />
      )}

      {/* Overlay badges — stable unless violations/severity change */}
      {/* LIVE badge */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 text-xs font-semibold text-status-ok bg-bg/85 px-3 py-1.5 rounded-lg font-mono backdrop-blur-sm border border-status-ok/20">
        <span className="w-2 h-2 rounded-full bg-status-ok animate-pulse" aria-hidden="true" />
        LIVE · YOLO26
      </div>

      {/* Frame counter */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 text-xs font-mono text-text-muted bg-bg/85 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-border-soft/50">
        <Activity className="w-3 h-3" aria-hidden="true" />
        Frame {frameIndex}
      </div>

      {/* Severity badge */}
      {severity && severity !== 'info' && severity !== 'ok' && (
        <div className="absolute bottom-3 right-3">
          <Badge variant={severity as 'high' | 'medium' | 'low'} />
        </div>
      )}

      {/* Camera watermark */}
      <div className="absolute bottom-3 left-3 text-xs font-mono text-text-muted bg-bg/70 px-2 py-1 rounded-md backdrop-blur-sm">
        {cameraId} · {zoneName}
      </div>

      {/* Violation overlay (top-left, below LIVE badge) */}
      {violations.length > 0 && (
        <div className="absolute top-12 left-3 flex flex-col gap-1 max-w-[220px]">
          {violations.slice(0, 4).map((v, i) => (
            <span key={i}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg/85 text-status-danger border border-status-danger/30">
              ⚠ {v}
            </span>
          ))}
        </div>
      )}
    </>
  );
});

// ── DetectionList ─────────────────────────────────────────────────────────────
// Memoised — uses `compliant` field for colouring, no label heuristics.

const DetectionList = memo(function DetectionList({
  detections, frameIndex,
}: { detections: Detection[]; frameIndex: number }) {
  if (detections.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          YOLO26 Detections · Frame {frameIndex}
        </p>
      </div>
      <div className="space-y-1">
        {detections.map((det, i) => {
          // Use compliant field; fall back to label heuristic for older backends
          const isViol =
            det.compliant === false ||
            (det.compliant === undefined &&
              (det.label.toLowerCase().startsWith('no_') ||
               det.label.toLowerCase().startsWith('no-') ||
               det.label.toLowerCase().includes('missing')));

          return (
            <div key={i}
              className="flex items-center gap-3 py-2 px-3 rounded-lg bg-panel-alt border border-border-soft">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isViol ? 'bg-status-danger' : 'bg-status-ok'}`}
                aria-hidden="true" />
              <span className="text-xs font-mono text-text-primary flex-1 truncate">{det.label}</span>
              <span className={`text-xs font-mono font-bold ${isViol ? 'text-status-danger' : 'text-status-ok'}`}>
                {(det.conf * 100).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ── CameraSelector ────────────────────────────────────────────────────────────

const CameraSelector = memo(function CameraSelector({
  cameras, selectedId, onSelect,
}: { cameras: Camera[]; selectedId: string; onSelect: (cam: Camera) => void }) {
  if (cameras.length <= 1) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {cameras.map(cam => {
        const active = cam.id === selectedId;
        const online = cam.status === 'online';
        return (
          <button key={cam.id} onClick={() => onSelect(cam)}
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
  );
});

// ── StatStrip ─────────────────────────────────────────────────────────────────

const StatStrip = memo(function StatStrip({
  zoneName, workers, violations, isOnline, isLive, liveStatus,
}: {
  zoneName: string; workers: number; violations: number;
  isOnline: boolean; isLive: boolean; liveStatus: string;
}) {
  const stats: { icon: ReactNode; label: string; value: string; accent: boolean }[] = [
    { icon: <span className="text-[8px]">🗺</span>, label: 'Zone',       value: zoneName,            accent: false },
    { icon: <Users className="w-3 h-3" />,          label: 'Workers',    value: String(workers),      accent: false },
    { icon: <AlertTriangle className="w-3 h-3" />,  label: 'Violations', value: String(violations),   accent: violations > 0 },
    {
      icon: (isOnline || isLive) ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />,
      label: 'Status',
      value: isLive ? liveStatus : (isOnline ? 'online' : 'offline'),
      accent: false,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {stats.map(stat => (
        <div key={stat.label}
          className="bg-panel-alt border border-border-soft rounded-lg px-2 py-2 flex flex-col gap-0.5 hover:border-accent/20 transition-colors duration-200">
          <div className={`flex items-center gap-1 ${stat.accent ? 'text-status-danger' : 'text-text-muted'}`}>
            {stat.icon}
            <span className="text-[8px] font-medium uppercase tracking-wider">{stat.label}</span>
          </div>
          <p className={`text-xs font-semibold capitalize leading-tight ${
            stat.label === 'Status'
              ? (isOnline || isLive) ? 'text-status-ok' : 'text-status-danger'
              : stat.accent ? 'text-status-danger' : 'text-text-primary'
          }`}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
});

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  camera: Camera;
  cameras: Camera[];
  onClose?: () => void;
  onCameraChange?: (camera: Camera) => void;
  mode?: 'drawer' | 'full';
}

export default function CameraDetailPanel({
  camera, cameras, onClose, onCameraChange, mode = 'drawer',
}: Props) {
  const [selectedCamera, setSelectedCamera] = useState(camera);
  const recentAlerts = useAlertStore(s => s.alerts)
    .filter(a => a.cameraId === selectedCamera.id)
    .slice(0, 6);

  const { liveCamera } = useDetectionStore();
  const isLiveActive = liveCamera !== null && (
    liveCamera.status === 'streaming' || liveCamera.jpeg !== undefined
  );

  // Track the rendered pixel size of the feed container — used by canvas
  const feedRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const e = entries[0];
      if (!e) return;
      // Use contentRect for the actual renderable area (no border/padding)
      setContainerSize({
        w: Math.round(e.contentRect.width),
        h: Math.round(e.contentRect.height),
      });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleCameraSelect = useCallback((cam: Camera) => {
    setSelectedCamera(cam);
    onCameraChange?.(cam);
  }, [onCameraChange]);

  const isOnline   = selectedCamera.status === 'online';
  const feedHeight = mode === 'full'
    ? 'h-[calc(100vh-280px)] min-h-[360px]'
    : 'h-48 mx-4 mt-4';

  const content = (
    <div className="flex flex-col gap-4">

      {/* Camera selector — stable, memoised */}
      {mode === 'full' && (
        <CameraSelector
          cameras={cameras}
          selectedId={selectedCamera.id}
          onSelect={handleCameraSelect}
        />
      )}

      {/* Feed area */}
      <div
        ref={feedRef}
        className={`relative rounded-2xl border overflow-hidden ${feedHeight} ${
          isLiveActive ? 'border-accent/30 bg-bg' :
          isOnline ? 'border-border-soft' : 'border-border-soft bg-panel-alt'
        }`}
        style={(!isLiveActive && isOnline) ? {
          backgroundImage: 'repeating-linear-gradient(115deg,#20242D 0,#20242D 2px,#12151A 2px,#12151A 4px)',
        } : {}}
      >
        {/* Priority: 1) live stream  2) mock feed  3) offline */}
        {isLiveActive ? (
          liveCamera?.jpeg ? (
            /* Real JPEG frame from YOLO26 — LiveFeed is memoised */
            <LiveFeed
              jpeg={liveCamera.jpeg}
              frameIndex={liveCamera.frameIndex}
              detections={liveCamera.detections}
              violations={liveCamera.violations}
              severity={liveCamera.severity}
              containerW={containerSize.w}
              containerH={containerSize.h}
              cameraId={selectedCamera.id}
              zoneName={selectedCamera.zoneName}
            />
          ) : (
            /* Live session started but first frame not yet received */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <svg className="w-8 h-8 text-accent animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              <p className="text-sm text-accent font-mono">Receiving stream…</p>
              <p className="text-xs text-text-muted font-mono">YOLO26 · {selectedCamera.id}</p>
            </div>
          )
        ) : isOnline ? (
          /* Mock feed */
          <>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 text-xs font-semibold text-status-ok bg-bg/85 px-3 py-1.5 rounded-lg font-mono backdrop-blur-sm border border-status-ok/20">
              <span className="w-2 h-2 rounded-full bg-status-ok animate-pulse" />LIVE
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
          /* Offline */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <WifiOff className="w-10 h-10 text-text-muted opacity-25" />
            <p className="text-sm text-text-muted">No Signal — Camera Offline</p>
          </div>
        )}
      </div>

      {/* Stat strip — memoised */}
      <StatStrip
        zoneName={selectedCamera.zoneName}
        workers={selectedCamera.workersDetected}
        violations={isLiveActive ? (liveCamera?.violations.length ?? 0) : selectedCamera.activeViolations}
        isOnline={isOnline}
        isLive={isLiveActive}
        liveStatus={liveCamera?.status ?? 'streaming'}
      />

      {/* Detection list — memoised, uses compliant field */}
      {isLiveActive && liveCamera && (
        <DetectionList
          detections={liveCamera.detections}
          frameIndex={liveCamera.frameIndex}
        />
      )}

      {/* Recent events (mock alert store fallback) */}
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
        <div className="p-4">{content}</div>
      </Drawer>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto">
      {content}
    </div>
  );
}

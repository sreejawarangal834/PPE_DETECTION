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
import DetectionClassFilter from '../../components/widgets/DetectionClassFilter';
import {
  ALL_DETECTION_CLASS_IDS,
  DETECTION_FILTER_STORAGE_KEY,
  detectionClassColor,
  detectionClassLabel,
  isDetectionClassVisible,
} from '../../constants/detectionClasses';
import { BoundingBoxCanvas, VideoFeed, FeedImage, isViolationDetection } from '../../components/detection/LiveFeedSurface';

// ── LiveFeed ─────────────────────────────────────────────────────────────────
// Memoised on jpeg/stream + frameIndex — the most frequently updating part.

interface LiveFeedProps {
  jpeg?: string;
  stream?: MediaStream;
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
  jpeg, stream, frameIndex, detections, violations, severity,
  containerW, containerH, cameraId, zoneName,
}: LiveFeedProps) {
  return (
    <>
      {stream ? (
        <VideoFeed stream={stream} />
      ) : jpeg ? (
        <FeedImage jpeg={jpeg} />
      ) : null}

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
          const isViol = isViolationDetection(det);
          const col = detectionClassColor(det.label);

          return (
            <div key={i}
              className={`flex items-center gap-3 py-2 px-3 rounded-lg bg-panel-alt border ${
                isViol ? 'border-status-danger/40' : 'border-border-soft'
              }`}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/20" style={{ backgroundColor: col }}
                aria-hidden="true" />
              <span className="text-xs font-mono text-text-primary flex-1 truncate">{detectionClassLabel(det.label)}</span>
              {isViol && <AlertTriangle className="w-3 h-3 text-status-danger shrink-0" aria-hidden="true" />}
              <span className={`text-xs font-mono font-bold ${isViol ? 'text-status-danger' : 'text-text-secondary'}`}>
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

  // ── Detection class filter — which classes get drawn/listed ──────
  const [visibleClasses, setVisibleClasses] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem(DETECTION_FILTER_STORAGE_KEY);
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch {
      // fall through to default
    }
    return new Set(ALL_DETECTION_CLASS_IDS);
  });

  const handleVisibleClassesChange = useCallback((next: Set<string>) => {
    setVisibleClasses(next);
    try {
      sessionStorage.setItem(DETECTION_FILTER_STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // sessionStorage unavailable — filter still works in-memory
    }
  }, []);

  const filteredDetections = (liveCamera?.detections ?? [])
    .filter(d => isDetectionClassVisible(d.label, visibleClasses));

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

      {/* Camera selector + detection-class filter */}
      {mode === 'full' && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CameraSelector
            cameras={cameras}
            selectedId={selectedCamera.id}
            onSelect={handleCameraSelect}
          />
          <DetectionClassFilter
            selected={visibleClasses}
            onChange={handleVisibleClassesChange}
          />
        </div>
      )}

      {/* Feed area */}
      <div
        ref={feedRef}
        className={`relative rounded-2xl border overflow-hidden ${feedHeight} ${
          isOnline || isLiveActive ? 'border-border-soft' : 'border-border-soft bg-panel-alt'
        }`}
        style={(!isLiveActive && isOnline) ? {
          backgroundImage: 'repeating-linear-gradient(115deg,#20242D 0,#20242D 2px,#12151A 2px,#12151A 4px)',
        } : {}}
      >
        {isLiveActive && (liveCamera?.jpeg || liveCamera?.stream) ? (
          /* Real feed — LiveFeed and canvas are memoised for performance */
          <LiveFeed
            jpeg={liveCamera.jpeg}
            stream={liveCamera.stream}
            frameIndex={liveCamera.frameIndex}
            detections={filteredDetections}
            violations={liveCamera.violations}
            severity={liveCamera.severity}
            containerW={containerSize.w}
            containerH={containerSize.h}
            cameraId={selectedCamera.id}
            zoneName={selectedCamera.zoneName}
          />
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

      {/* Detection list — memoised, respects the class filter above */}
      {isLiveActive && liveCamera && (
        <DetectionList
          detections={filteredDetections}
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

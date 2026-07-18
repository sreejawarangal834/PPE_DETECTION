/**
 * Full-size detail view for exactly one live detection session (video or
 * webcam) in Single View — the counterpart to LiveSessionsGrid's compact
 * cards. Previously Single View only understood mock Camera objects; a live
 * session only showed up there as a merged multi-session aggregate that
 * drops jpeg/stream the moment a second session starts, which is why it
 * looked broken with more than one session running.
 */
import { useEffect, useRef, useState } from 'react';
import { Video, FileVideo, Square, Activity, AlertTriangle, Users, Wifi } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import type { LiveSession } from '../../state/DetectionStore';
import { BoundingBoxCanvas, VideoFeed, FeedImage, isViolationDetection } from '../../components/detection/LiveFeedSurface';
import { detectionClassColor, detectionClassLabel } from '../../constants/detectionClasses';

const STATUS_LABEL: Record<LiveSession['status'], string> = {
  idle: 'Idle', uploading: 'Uploading…', connecting: 'Connecting…',
  streaming: 'Streaming', done: 'Complete', error: 'Error',
};

interface Props {
  sessions: LiveSession[];
  selectedId: string;
  onSelect: (id: string) => void;
  onStop: (id: string) => void;
}

export default function LiveSessionDetail({ sessions, selectedId, onSelect, onStop }: Props) {
  const session = sessions.find(s => s.id === selectedId) ?? sessions[0];
  const feedRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (!session) return null;

  const hasFeed = Boolean(session.stream || session.jpeg);
  const personCount = session.detections.filter(d => d.label.toLowerCase() === 'person').length;

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto">
      {/* Session switcher — only worth showing when there's more than one */}
      {sessions.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {sessions.map((s) => {
            const active = s.id === session.id;
            return (
              <button key={s.id} onClick={() => onSelect(s.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold
                  transition-all duration-200 border
                  ${active
                    ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20'
                    : 'bg-panel-alt border-border text-text-secondary hover:text-text-primary hover:border-accent/50 hover:bg-panel-hover'}`}>
                {s.kind === 'webcam' ? <Video className="w-3.5 h-3.5" /> : <FileVideo className="w-3.5 h-3.5" />}
                <span className="max-w-[10rem] truncate">{s.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Feed area */}
      <div ref={feedRef} className="relative rounded-2xl border border-border-soft overflow-hidden h-[calc(100vh-280px)] min-h-[360px] bg-bg">
        {hasFeed ? (
          <>
            {session.stream ? <VideoFeed stream={session.stream} /> : <FeedImage jpeg={session.jpeg!} />}
            {session.detections.length > 0 && (
              <BoundingBoxCanvas detections={session.detections} containerW={size.w} containerH={size.h} />
            )}

            <div className="absolute top-3 left-3 flex items-center gap-1.5 text-xs font-semibold text-status-ok bg-bg/85 px-3 py-1.5 rounded-lg font-mono backdrop-blur-sm border border-status-ok/20">
              <span className="w-2 h-2 rounded-full bg-status-ok animate-pulse" />
              LIVE · YOLO26
            </div>
            <div className="absolute top-3 right-3 flex items-center gap-1.5 text-xs font-mono text-text-muted bg-bg/85 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-border-soft/50">
              <Activity className="w-3 h-3" />
              Frame {session.frameIndex}
            </div>
            {(session.severity === 'high' || session.severity === 'medium') && (
              <div className="absolute bottom-3 right-3">
                <Badge variant={session.severity} />
              </div>
            )}
            <div className="absolute bottom-3 left-3 text-xs font-mono text-text-muted bg-bg/70 px-2 py-1 rounded-md backdrop-blur-sm">
              {session.name}
            </div>
            {session.violations.length > 0 && (
              <div className="absolute top-12 left-3 flex flex-col gap-1 max-w-[220px]">
                {session.violations.slice(0, 4).map((v, i) => (
                  <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg/85 text-status-danger border border-status-danger/30">
                    ⚠ {v}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            {session.status === 'error'
              ? <AlertTriangle className="w-10 h-10 text-status-danger opacity-60" />
              : <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />}
            <p className="text-sm text-text-muted">{STATUS_LABEL[session.status]}</p>
          </div>
        )}
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: <Users className="w-3 h-3" />, label: 'People', value: String(personCount), accent: false },
          { icon: <AlertTriangle className="w-3 h-3" />, label: 'Violations', value: String(session.violations.length), accent: session.violations.length > 0 },
          { icon: <Wifi className="w-3 h-3" />, label: 'Status', value: STATUS_LABEL[session.status], accent: session.status === 'error' },
          { icon: session.kind === 'webcam' ? <Video className="w-3 h-3" /> : <FileVideo className="w-3 h-3" />, label: 'Source', value: session.kind, accent: false },
        ].map((stat) => (
          <div key={stat.label} className="bg-panel-alt border border-border-soft rounded-lg px-2 py-2 flex flex-col gap-0.5">
            <div className={`flex items-center gap-1 ${stat.accent ? 'text-status-danger' : 'text-text-muted'}`}>
              {stat.icon}
              <span className="text-[8px] font-medium uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className={`text-xs font-semibold capitalize leading-tight ${stat.accent ? 'text-status-danger' : 'text-text-primary'}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Detection list */}
      {session.detections.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-3.5 h-3.5 text-text-muted" />
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              YOLO26 Detections · Frame {session.frameIndex}
            </p>
          </div>
          <div className="space-y-1">
            {session.detections.map((det, i) => {
              const isViol = isViolationDetection(det);
              return (
                <div key={i} className={`flex items-center gap-3 py-2 px-3 rounded-lg bg-panel-alt border ${isViol ? 'border-status-danger/40' : 'border-border-soft'}`}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/20" style={{ backgroundColor: detectionClassColor(det.label) }} />
                  <span className="text-xs font-mono text-text-primary flex-1 truncate">{detectionClassLabel(det.label)}</span>
                  {isViol && <AlertTriangle className="w-3 h-3 text-status-danger shrink-0" />}
                  <span className={`text-xs font-mono font-bold ${isViol ? 'text-status-danger' : 'text-text-secondary'}`}>
                    {(det.conf * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => onStop(session.id)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-status-danger bg-status-danger/10 border border-status-danger/30 hover:bg-status-danger/20 transition-all duration-200"
      >
        <Square className="w-3.5 h-3.5" />
        Stop This Session
      </button>
    </div>
  );
}

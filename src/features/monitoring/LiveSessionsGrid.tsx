/**
 * Grid of all concurrently-running detection sessions — uploaded videos and
 * the browser webcam, each with its own WebSocket, its own bounding-box
 * overlay, and an independent Stop control. This is what makes "upload
 * several videos and run the webcam at the same time" visible on screen.
 */
import { useEffect, useRef, useState, memo } from 'react';
import { Video, FileVideo, Square, Activity, AlertTriangle } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import type { LiveSession } from '../../state/DetectionStore';
import { BoundingBoxCanvas, VideoFeed, FeedImage } from '../../components/detection/LiveFeedSurface';

const STATUS_LABEL: Record<LiveSession['status'], string> = {
  idle:       'Idle',
  uploading:  'Uploading…',
  connecting: 'Connecting…',
  streaming:  'Streaming',
  done:       'Complete',
  error:      'Error',
};

interface CardProps {
  session: LiveSession;
  onStop: (id: string) => void;
}

const SessionCard = memo(function SessionCard({ session, onStop }: CardProps) {
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

  const hasFeed = Boolean(session.stream || session.jpeg);
  const isBusy = session.status === 'uploading' || session.status === 'connecting';

  return (
    <div className="rounded-2xl border border-border-soft overflow-hidden bg-panel-alt flex flex-col">
      <div ref={feedRef} className="relative aspect-video bg-bg">
        {hasFeed ? (
          <>
            {session.stream ? <VideoFeed stream={session.stream} /> : <FeedImage jpeg={session.jpeg!} />}
            {session.detections.length > 0 && (
              <BoundingBoxCanvas detections={session.detections} containerW={size.w} containerH={size.h} />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-muted">
            {isBusy
              ? <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              : <AlertTriangle className="w-6 h-6 opacity-40" />}
            <p className="text-xs">{STATUS_LABEL[session.status]}</p>
          </div>
        )}

        {/* Kind badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[10px] font-semibold text-status-ok bg-bg/85 px-2 py-1 rounded-md font-mono backdrop-blur-sm border border-status-ok/20">
          {session.kind === 'webcam' ? <Video className="w-3 h-3" /> : <FileVideo className="w-3 h-3" />}
          {session.status === 'streaming' && <span className="w-1.5 h-1.5 rounded-full bg-status-ok animate-pulse" />}
          {STATUS_LABEL[session.status]}
        </div>

        {/* Frame counter */}
        {hasFeed && (
          <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-mono text-text-muted bg-bg/85 px-2 py-1 rounded-md backdrop-blur-sm">
            <Activity className="w-3 h-3" />
            {session.frameIndex}
          </div>
        )}

        {/* Severity — backend only ever sends "ok" | "medium" | "high" */}
        {(session.severity === 'high' || session.severity === 'medium') && (
          <div className="absolute bottom-2 right-2">
            <Badge variant={session.severity} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-primary truncate" title={session.name}>{session.name}</p>
          {session.violations.length > 0 && (
            <p className="text-[10px] font-mono text-status-danger truncate">{session.violations[0]}</p>
          )}
        </div>
        <button
          onClick={() => onStop(session.id)}
          title="Stop this session"
          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-status-danger bg-status-danger/10 border border-status-danger/30 hover:bg-status-danger/20 transition-colors duration-150"
        >
          <Square className="w-3 h-3" />
          Stop
        </button>
      </div>
    </div>
  );
});

interface Props {
  sessions: LiveSession[];
  onStop: (id: string) => void;
}

export default function LiveSessionsGrid({ sessions, onStop }: Props) {
  if (sessions.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {sessions.map((s) => (
        <SessionCard key={s.id} session={s} onStop={onStop} />
      ))}
    </div>
  );
}

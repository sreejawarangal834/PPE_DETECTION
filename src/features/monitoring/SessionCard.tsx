/**
 * One live detection session (uploaded video, webcam, or RTSP stream), rendered as a grid
 * tile — shared by CameraGrid (a camera slot with a session bound to it) and
 * MonitoringPage's "Unassigned Sessions" fallback row (a session started
 * without picking a camera slot). Previously this lived only inside
 * LiveSessionsGrid as a parallel section to the mock camera grid; lifting it
 * out is what lets a live session render *inside* its camera's own grid
 * cell instead of a separate area.
 */
import { useEffect, useRef, useState, memo } from 'react';
import { Video, FileVideo, Smartphone, Square, Trash2, Activity, AlertTriangle } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import type { LiveSession } from '../../state/DetectionStore';
import { BoundingBoxCanvas, VideoFeed, FeedImage } from '../../components/detection/LiveFeedSurface';
import { ALL_DETECTION_CLASS_IDS, isDetectionClassVisible } from '../../constants/detectionClasses';

const ALL_DETECTION_CLASS_IDS_SET = new Set(ALL_DETECTION_CLASS_IDS);

const STATUS_LABEL: Record<LiveSession['status'], string> = {
  idle:       'Idle',
  uploading:  'Uploading…',
  connecting: 'Connecting…',
  streaming:  'Streaming',
  done:       'Complete',
  error:      'Error',
};

interface SessionCardProps {
  session: LiveSession;
  onStop: (id: string) => void;
  visibleClasses?: Set<string>;
  /** Open this session's full single-view — omit to keep the card static. */
  onClick?: () => void;
}

const SessionCard = memo(function SessionCard({
  session, onStop, visibleClasses = ALL_DETECTION_CLASS_IDS_SET, onClick,
}: SessionCardProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const filteredDetections = session.detections.filter(d => isDetectionClassVisible(d.label, visibleClasses));

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
  // Uploaded videos have a server-side file to clean up on stop — call that
  // action "Remove" so it's clear it cancels inference *and* deletes the
  // upload, not just pauses viewing. Webcam sessions have nothing to delete.
  const isVideo = session.kind === 'video';

  return (
    <div
      className={`rounded-2xl border border-border-soft overflow-hidden bg-panel-alt flex flex-col ${onClick ? 'cursor-pointer hover:border-accent transition-colors duration-150' : ''}`}
      onClick={onClick}
    >
      <div ref={feedRef} className="relative aspect-video bg-bg">
        {hasFeed ? (
          <>
            {session.stream ? <VideoFeed stream={session.stream} /> : <FeedImage jpeg={session.jpeg!} />}
            <BoundingBoxCanvas detections={filteredDetections} containerW={size.w} containerH={size.h} />
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
          {session.kind === 'webcam' ? <Video className="w-3 h-3" />
            : session.kind === 'rtsp' ? <Smartphone className="w-3 h-3" />
            : <FileVideo className="w-3 h-3" />}
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
          onClick={(e) => { e.stopPropagation(); onStop(session.id); }}
          title={isVideo ? 'Cancel inference and delete this upload' : 'Stop this session'}
          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-status-danger bg-status-danger/10 border border-status-danger/30 hover:bg-status-danger/20 transition-colors duration-150"
        >
          {isVideo ? <Trash2 className="w-3 h-3" /> : <Square className="w-3 h-3" />}
          {isVideo ? 'Remove' : 'Stop'}
        </button>
      </div>
    </div>
  );
});

export default SessionCard;

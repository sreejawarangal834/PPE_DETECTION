import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../lib/auth/authStore';
import { VIEW_MODE_STORAGE_KEY, VIEW_MODE_DEFAULT } from '../../constants/app';
import { ViewModeToggle, type ViewMode } from '../../components/widgets/ViewModeToggle';
import CameraGrid from './CameraGrid';
import CameraDetailPanel from './CameraDetailPanel';
import LiveSessionsGrid from './LiveSessionsGrid';
import LiveSessionDetail from './LiveSessionDetail';
import AlertFeedWidget from '../../components/widgets/AlertFeedWidget';
import LiveWorkerList from './LiveWorkerList';
import Card from '../../components/ui/Card';
import { useQuery } from '@tanstack/react-query';
import { getCameras } from '../../api/camerasApi';
import type { Camera } from '../../types';
import PageShell from '../../components/ui/PageShell';
import { useLiveSessions, WEBCAM_SESSION_ID } from '../../hooks/useLiveSessions';
import { useDetectionStore } from '../../state/DetectionStore';
import { Upload, Video, WifiOff, Play, Square } from 'lucide-react';

const HEALTH_CHECK_INTERVAL_MS = 5000;

/** Check whether the FastAPI backend is reachable */
async function checkBackendHealth(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch('/api/health', { signal: ctrl.signal });
    clearTimeout(id);
    return res.ok;
  } catch {
    return false;
  }
}

export default function MonitoringPage() {
  const user = useAuthStore(s => s.user);
  const [viewMode, setViewMode]         = useState<ViewMode>(VIEW_MODE_DEFAULT as ViewMode);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedZone]                  = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null); // null = checking
  const fileInputRef                    = useRef<HTMLInputElement>(null);
  const consecutiveFailuresRef          = useRef(0);

  // Backend detection pipeline — supports any number of concurrent sessions
  // (multiple uploaded videos + one browser webcam), each independent.
  const { startVideoSession, startWebcamSession, stopSession, stopAllSessions } = useLiveSessions();
  const { sessions } = useDetectionStore();
  const streamingCount = sessions.filter(s => s.status === 'streaming').length;

  /* ── Check backend availability — polls so a transient restart (e.g. the
   * dev server's --reload) doesn't leave the badge stuck on "Offline"
   * forever; it self-heals within one poll interval instead of requiring
   * a manual page refresh.
   *
   * A single missed poll (a slow request during heavy concurrent inference,
   * a one-off dev-proxy hiccup) does NOT flip the badge to "Offline" — that
   * requires two consecutive failures. Any success recovers immediately. ── */
  useEffect(() => {
    async function poll() {
      const ok = await checkBackendHealth();
      if (ok) {
        consecutiveFailuresRef.current = 0;
        setBackendOnline(true);
      } else {
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= 2) setBackendOnline(false);
      }
    }
    poll();
    const id = setInterval(poll, HEALTH_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  /* ── Persist view mode ── */
  useEffect(() => {
    const stored = sessionStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === 'grid' || stored === 'single') setViewMode(stored as ViewMode);
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  };

  /* ── Camera list ── */
  const { data: cameras = [] } = useQuery({
    queryKey: ['cameras'],
    queryFn: getCameras,
    staleTime: 30000,
  });

  const filteredCameras = user?.role === 'site_supervisor' && user.assignedZones?.length
    ? cameras.filter(c => user.assignedZones!.includes(c.zoneId))
    : cameras;

  useEffect(() => {
    if (viewMode === 'single' && !selectedCamera && filteredCameras.length > 0) {
      setSelectedCamera(filteredCameras[0]);
    }
  }, [viewMode, selectedCamera, filteredCameras]);

  /* ── Video upload handler — one dialog can pick several files, and the
   * button can be clicked again any time to add more; each becomes its own
   * independent session rather than replacing whatever is already running.
   * A single file jumps to Single View focused on it; multiple files jump
   * to Grid View so all of them are visible at once. ── */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = ''; // reset so the same file(s) can be re-selected later
    const ids = await Promise.all(files.map(startVideoSession));
    if (ids.length === 1) {
      setSelectedSessionId(ids[0]);
      setViewMode('single');
      sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, 'single');
    } else {
      setViewMode('grid');
      sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, 'grid');
    }
  }

  /* ── Webcam handler — browser camera permission, not the backend host's ── */
  function handleUseWebcam() {
    startWebcamSession();
    setSelectedSessionId(WEBCAM_SESSION_ID);
    setViewMode('single');
    sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, 'single');
  }

  const handleCameraSelect = (camera: Camera) => {
    setSelectedCamera(camera);
    if (viewMode === 'grid') {
      setViewMode('single');
      sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, 'single');
    }
  };

  return (
    <PageShell noPadding>
      <div className="flex h-full bg-gray-900">

        {/* ── Main Content ──────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Page Header */}
          <div className="px-8 py-5 border-b border-gray-700 flex items-center justify-between bg-gray-800 shrink-0">
            <div>
              <h1 className="text-3xl font-bold text-white">Live Monitoring</h1>
              <p className="text-base text-gray-400 mt-1">
                Real-time camera feeds and violation tracking
                {user?.role === 'site_supervisor' && user.assignedZones?.length
                  ? ` · Zones: ${user.assignedZones.join(', ')}`
                  : ''}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Backend status indicator */}
              {backendOnline !== null && (
                <div className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-lg border
                  ${backendOnline
                    ? 'text-status-ok border-status-ok/30 bg-status-ok/10'
                    : 'text-status-danger border-status-danger/30 bg-status-danger/10'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? 'bg-status-ok' : 'bg-status-danger'}`} />
                  {backendOnline ? 'Backend Online' : 'Backend Offline'}
                </div>
              )}

              {/* Live session count badge */}
              {sessions.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-lg bg-panel-alt border border-border-soft text-status-ok">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-ok animate-pulse" />
                  {streamingCount}/{sessions.length} Live
                </div>
              )}

              {/* Upload video button — always rendered when backend check is done */}
              {backendOnline !== null && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="video/*,.mp4,.avi,.mov,.mkv,.webm"
                    onChange={handleFileChange}
                    className="hidden"
                    aria-label="Upload video(s) for YOLO26 detection"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white
                      transition-all duration-200 shadow-lg
                      ${backendOnline
                        ? 'bg-accent hover:bg-accent-hover shadow-accent/20'
                        : 'bg-status-warn/80 hover:bg-status-warn shadow-status-warn/20'}`}
                    title={backendOnline
                      ? 'Upload one or more videos for YOLO26 PPE detection — each runs as its own session'
                      : 'Backend offline — start FastAPI server on port 8000 first'}
                  >
                    <Upload className="w-4 h-4" aria-hidden="true" />
                    Upload Video
                  </button>

                  <button
                    onClick={handleUseWebcam}
                    disabled={!backendOnline}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white
                      disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg
                      ${backendOnline
                        ? 'bg-accent hover:bg-accent-hover shadow-accent/20'
                        : 'bg-status-warn/80 hover:bg-status-warn shadow-status-warn/20'}`}
                    title={backendOnline
                      ? 'Run live YOLO26 PPE detection on your browser webcam alongside any other sessions'
                      : 'Backend offline — start FastAPI server on port 8000 first'}
                  >
                    <Video className="w-4 h-4" aria-hidden="true" />
                    Use Webcam
                  </button>
                </>
              )}

              <ViewModeToggle viewMode={viewMode} onViewModeChange={handleViewModeChange} />
            </div>
          </div>

          {/* Backend offline notice */}
          {backendOnline === false && (
            <div className="mx-6 mt-4 flex items-start gap-3 bg-status-warn/10 border border-status-warn/30 rounded-xl px-4 py-3 shrink-0">
              <WifiOff className="w-4 h-4 text-status-warn shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-status-warn">Backend Offline</p>
                <p className="text-xs text-text-muted mt-0.5">
                  The YOLO26 detection server is not reachable. Live video analysis is unavailable.
                  Mock data is shown as a fallback. Start the FastAPI backend at <code className="font-mono text-xs bg-panel-alt px-1 rounded">localhost:8000</code> to enable real detection.
                  Rechecking every {HEALTH_CHECK_INTERVAL_MS / 1000}s.
                </p>
              </div>
            </div>
          )}

          {/* Camera View */}
          <div className="flex-1 overflow-auto p-6">
            {viewMode === 'grid' ? (
              <div className="space-y-8">
                {sessions.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-4">
                      Live Detection Sessions
                    </p>
                    <LiveSessionsGrid sessions={sessions} onStop={stopSession} />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-4">Camera Grid</p>
                  <CameraGrid selectedZone={selectedZone} onCameraSelect={handleCameraSelect} />
                </div>
              </div>
            ) : sessions.length > 0 ? (
              <LiveSessionDetail
                sessions={sessions}
                selectedId={selectedSessionId ?? sessions[0].id}
                onSelect={setSelectedSessionId}
                onStop={stopSession}
              />
            ) : selectedCamera ? (
              <CameraDetailPanel
                camera={selectedCamera}
                cameras={filteredCameras}
                onCameraChange={handleCameraSelect}
                mode="full"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
                <Play className="w-12 h-12 opacity-20" aria-hidden="true" />
                <p className="text-base">No cameras available</p>
                {backendOnline && (
                  <p className="text-sm text-text-muted">Upload a video above to start live detection</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Side Panel ──────────────────────────── */}
        <div className="w-96 border-l border-gray-700 flex flex-col bg-gray-800 shrink-0">
          <div className="flex-1 overflow-auto p-4 space-y-4">

            {/* Stop-all button when any session is active */}
            {sessions.length > 0 && (
              <button
                onClick={stopAllSessions}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-status-danger bg-status-danger/10 border border-status-danger/30 hover:bg-status-danger/20 transition-all duration-200"
              >
                <Square className="w-3.5 h-3.5" aria-hidden="true" />
                Stop All Sessions ({sessions.length})
              </button>
            )}

            <Card
              header={<span className="text-sm font-semibold uppercase tracking-wide text-gray-400">Recent Alerts</span>}
              padding={false}
            >
              <AlertFeedWidget />
            </Card>

            <Card
              header={<span className="text-sm font-semibold uppercase tracking-wide text-gray-400">Live Workers</span>}
              padding={false}
            >
              <LiveWorkerList selectedZone={selectedZone} />
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

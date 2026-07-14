import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../lib/auth/authStore';
import { VIEW_MODE_STORAGE_KEY, VIEW_MODE_DEFAULT } from '../../constants/app';
import { ViewModeToggle, type ViewMode } from '../../components/widgets/ViewModeToggle';
import CameraGrid from './CameraGrid';
import CameraDetailPanel from './CameraDetailPanel';
import AlertFeedWidget from '../../components/widgets/AlertFeedWidget';
import LiveWorkerList from './LiveWorkerList';
import Card from '../../components/ui/Card';
import { useQuery } from '@tanstack/react-query';
import { getCameras } from '../../api/camerasApi';
import type { Camera } from '../../types';
import PageShell from '../../components/ui/PageShell';
import { useDetectionSocket } from '../../hooks/useDetectionSocket';
import { useDetectionStore } from '../../state/DetectionStore';
import { Upload, WifiOff, Play, Square } from 'lucide-react';

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
  const [selectedZone]                  = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null); // null = checking
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  // Backend detection pipeline
  const { state: socketState, latest, error: socketError, start } = useDetectionSocket();
  const { setLiveCamera, resetLiveCamera } = useDetectionStore();

  /* ── Check backend availability on mount ── */
  useEffect(() => {
    checkBackendHealth().then(setBackendOnline);
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

  /* ── Auto-select first camera on initial load ── */
  useEffect(() => {
    if (!selectedCamera && filteredCameras.length > 0) {
      setSelectedCamera(filteredCameras[0]);
    }
  }, [filteredCameras, selectedCamera]);

  /* ── Set liveCamera to 'streaming' as soon as socket connects ── */
  useEffect(() => {
    if (socketState === 'streaming' && !latest) {
      // Mark camera as live even before first frame arrives
      setLiveCamera(prev => prev ? prev : {
        id:         selectedCamera?.id ?? 'live',
        name:       selectedCamera?.name ?? 'Live Feed',
        status:     'streaming',
        jpeg:       undefined,
        detections: [],
        severity:   'info' as const,
        violations: [],
        frameIndex: 0,
      });
    }
  }, [socketState, latest, selectedCamera, setLiveCamera]);

  /* ── Push each arriving frame into DetectionStore ── */
  useEffect(() => {
    if (!latest) return;
    setLiveCamera(() => ({
      id:         selectedCamera?.id ?? 'live',
      name:       selectedCamera?.name ?? 'Live Feed',
      status:     'streaming',
      jpeg:       latest.jpeg,
      detections: latest.detections,
      severity:   latest.severity,
      violations: latest.violations,
      frameIndex: latest.frameIndex,
    }));
  }, [latest, selectedCamera, setLiveCamera]);

  /* ── Clean up store when detection ends ── */
  useEffect(() => {
    if (socketState === 'done' || socketState === 'idle') {
      // Keep the last frame visible; only reset on explicit new session
    }
    if (socketState === 'error') {
      resetLiveCamera();
    }
  }, [socketState, resetLiveCamera]);

  /* ── Video upload handler ── */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    start(file);
    // Ensure a camera is selected so CameraDetailPanel renders
    if (!selectedCamera && filteredCameras.length > 0) {
      setSelectedCamera(filteredCameras[0]);
    }
    // Switch to Single View so the live feed is immediately visible
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

  /* ── Socket state label ── */
  const stateLabel: Record<typeof socketState, string> = {
    idle:       '',
    uploading:  'Uploading…',
    connecting: 'Connecting…',
    streaming:  'Streaming',
    done:       'Analysis complete',
    error:      'Error',
  };

  const stateColor: Record<typeof socketState, string> = {
    idle:       '',
    uploading:  'text-status-warn',
    connecting: 'text-status-warn',
    streaming:  'text-status-ok',
    done:       'text-text-muted',
    error:      'text-status-danger',
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

              {/* Socket state badge */}
              {socketState !== 'idle' && (
                <div className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-lg bg-panel-alt border border-border-soft ${stateColor[socketState]}`}>
                  {socketState === 'streaming' && <span className="w-1.5 h-1.5 rounded-full bg-status-ok animate-pulse" />}
                  {stateLabel[socketState]}
                  {socketState === 'streaming' && latest && (
                    <span className="text-text-muted ml-1">· Frame {latest.frameIndex}</span>
                  )}
                </div>
              )}

              {/* Upload video button — always rendered when backend check is done */}
              {backendOnline !== null && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,.mp4,.avi,.mov,.mkv,.webm"
                    onChange={handleFileChange}
                    className="hidden"
                    aria-label="Upload video for YOLO26 detection"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={socketState === 'uploading' || socketState === 'connecting'}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white
                      disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg
                      ${backendOnline
                        ? 'bg-accent hover:bg-accent-hover shadow-accent/20'
                        : 'bg-status-warn/80 hover:bg-status-warn shadow-status-warn/20'}`}
                    title={backendOnline
                      ? 'Upload a video file for YOLO26 PPE detection'
                      : 'Backend offline — start FastAPI server on port 8000 first'}
                  >
                    <Upload className="w-4 h-4" aria-hidden="true" />
                    Upload Video
                  </button>
                </>
              )}

              <ViewModeToggle viewMode={viewMode} onViewModeChange={handleViewModeChange} />
            </div>
          </div>

          {/* Socket error banner */}
          {socketState === 'error' && socketError && (
            <div className="mx-6 mt-4 flex items-start gap-3 bg-status-danger/10 border border-status-danger/30 rounded-xl px-4 py-3 shrink-0">
              <WifiOff className="w-4 h-4 text-status-danger shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-status-danger">Detection Pipeline Error</p>
                <p className="text-xs text-text-muted mt-0.5">{socketError}</p>
                {socketError.includes('404') && (
                  <p className="text-xs text-text-muted mt-1">
                    The backend returned 404. Ensure the FastAPI server is running on port 8000 and the
                    <code className="font-mono bg-panel-alt px-1 rounded mx-1">/api/videos/upload</code>
                    route is registered.
                  </p>
                )}
                {(socketError.includes('Upload failed') || socketError.includes('fetch')) && (
                  <p className="text-xs text-text-muted mt-1">
                    Could not reach the backend. Start the server:{' '}
                    <code className="font-mono bg-panel-alt px-1 rounded">cd backend && uvicorn main:app --reload</code>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Backend offline notice */}
          {backendOnline === false && (
            <div className="mx-6 mt-4 flex items-start gap-3 bg-status-warn/10 border border-status-warn/30 rounded-xl px-4 py-3 shrink-0">
              <WifiOff className="w-4 h-4 text-status-warn shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-status-warn">Backend Offline</p>
                <p className="text-xs text-text-muted mt-0.5">
                  The YOLO26 detection server is not reachable. Live video analysis is unavailable.
                  Mock data is shown as a fallback. Start the FastAPI backend at <code className="font-mono text-xs bg-panel-alt px-1 rounded">localhost:8000</code> to enable real detection.
                </p>
              </div>
            </div>
          )}

          {/* Camera View */}
          <div className="flex-1 overflow-auto p-6">
            {viewMode === 'grid' ? (
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-4">Camera Grid</p>
                <CameraGrid selectedZone={selectedZone} onCameraSelect={handleCameraSelect} />
              </div>
            ) : (
              selectedCamera ? (
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
              )
            )}
          </div>
        </div>

        {/* ── Right Side Panel ──────────────────────────── */}
        <div className="w-96 border-l border-gray-700 flex flex-col bg-gray-800 shrink-0">
          <div className="flex-1 overflow-auto p-4 space-y-4">

            {/* Stop session button when streaming */}
            {socketState === 'streaming' && (
              <button
                onClick={resetLiveCamera}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-status-danger bg-status-danger/10 border border-status-danger/30 hover:bg-status-danger/20 transition-all duration-200"
              >
                <Square className="w-3.5 h-3.5" aria-hidden="true" />
                Stop Live Session
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

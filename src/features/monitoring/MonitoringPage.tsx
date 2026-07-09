import { useState, useEffect } from 'react';
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

export default function MonitoringPage() {
  const user = useAuthStore(s => s.user);
  const [viewMode, setViewMode] = useState<ViewMode>(VIEW_MODE_DEFAULT as ViewMode);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  // Initialize view mode from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored && (stored === 'grid' || stored === 'single')) {
      setViewMode(stored as ViewMode);
    }
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  };

  const { data: cameras = [] } = useQuery({
    queryKey: ['cameras'],
    queryFn: getCameras,
    staleTime: 30000,
  });

  // Filter cameras by assigned zones for site supervisor
  const filteredCameras = user?.role === 'site_supervisor' && user.assignedZones?.length
    ? cameras.filter(c => user.assignedZones!.includes(c.zoneId))
    : cameras;

  // Set initial selected camera for single view
  useEffect(() => {
    if (viewMode === 'single' && !selectedCamera && filteredCameras.length > 0) {
      setSelectedCamera(filteredCameras[0]);
    }
  }, [viewMode, selectedCamera, filteredCameras]);

  const handleCameraSelect = (camera: Camera) => {
    setSelectedCamera(camera);
    // Switch to single view when a camera is selected in grid view
    if (viewMode === 'grid') {
      setViewMode('single');
      sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, 'single');
    }
  };

  return (
    <div className="flex h-full bg-[#0f1117]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page Header */}
        <div className="px-8 py-6 border-b border-[#21252D] flex items-center justify-between bg-[#161a22]">
          <div>
            <h1 className="text-4xl font-bold text-[#E8EAF0]">Live Monitoring</h1>
            <p className="text-lg text-[#9BA3B8] mt-2">
              Real-time camera feeds and violation tracking
              {user?.role === 'site_supervisor' && user.assignedZones?.length
                ? ` · Zones: ${user.assignedZones.join(', ')}`
                : ''
              }
            </p>
          </div>
          <ViewModeToggle viewMode={viewMode} onViewModeChange={handleViewModeChange} />
        </div>

        {/* Camera View */}
        <div className="flex-1 overflow-auto p-8">
          {viewMode === 'grid' ? (
            <div>
              <p className="text-base font-semibold uppercase tracking-wide text-[#9BA3B8] mb-5">Camera Grid</p>
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
              <div className="flex items-center justify-center h-full text-[#9BA3B8] text-lg">
                No cameras available
              </div>
            )
          )}
        </div>
      </div>

      {/* Right Side Panel */}
      <div className="w-96 border-l border-[#21252D] flex flex-col bg-[#161a22]">
        <div className="flex-1 overflow-auto p-5 space-y-5">
          <Card header={<span className="text-sm font-semibold uppercase tracking-wide text-[#9BA3B8]">Recent Alerts</span>} padding={false}>
            <AlertFeedWidget />
          </Card>
          <Card header={<span className="text-sm font-semibold uppercase tracking-wide text-[#9BA3B8]">Live Workers</span>} padding={false}>
            <LiveWorkerList selectedZone={selectedZone} />
          </Card>
        </div>
      </div>
    </div>
  );
}

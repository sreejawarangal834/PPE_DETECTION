import { useState } from 'react';
import ComplianceStats from '../monitoring/ComplianceStats';
import ZoneGrid from '../monitoring/ZoneGrid';
import CameraGrid from '../monitoring/CameraGrid';
import LiveWorkerList from '../monitoring/LiveWorkerList';
import TopViolatingZonesWidget from '../../components/widgets/TopViolatingZonesWidget';
import AlertFeedWidget from '../../components/widgets/AlertFeedWidget';
import WorkerStatusWidget from '../../components/widgets/WorkerStatusWidget';
import CameraStatusWidget from '../../components/widgets/CameraStatusWidget';
import ErrorBoundary from '../../components/ui/ErrorBoundary';
import Card from '../../components/ui/Card';

export default function SafetyOfficerDashboard() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  function handleZoneClick(zoneId: string | null) {
    setSelectedZone(prev => prev === zoneId ? null : zoneId);
  }

  return (
    <div className="space-y-6">

      {/* Row 1 — Compliance Stats (gauge + bar + area) */}
      <ErrorBoundary>
        <ComplianceStats />
      </ErrorBoundary>

      {/* Row 2 — Workers | Cameras | Top Violating Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <ErrorBoundary>
          <WorkerStatusWidget />
        </ErrorBoundary>
        <ErrorBoundary>
          <CameraStatusWidget />
        </ErrorBoundary>
        <div className="lg:col-span-2">
          <ErrorBoundary>
            <TopViolatingZonesWidget onZoneClick={handleZoneClick} />
          </ErrorBoundary>
        </div>
      </div>

      {/* Row 3 — Zone Cards */}
      <ErrorBoundary>
        <ZoneGrid selectedZone={selectedZone} onZoneSelect={handleZoneClick} />
      </ErrorBoundary>

      {/* Row 4 — Camera Grid + Alert Feed + Live Workers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Camera Grid</p>
          <ErrorBoundary>
            <CameraGrid selectedZone={selectedZone} />
          </ErrorBoundary>
        </div>
        <div className="space-y-4">
          <ErrorBoundary>
            <AlertFeedWidget />
          </ErrorBoundary>
          <Card header={<span className="text-xs font-medium uppercase tracking-wide text-text-muted">Live Workers</span>} padding={false}>
            <ErrorBoundary>
              <LiveWorkerList selectedZone={selectedZone} />
            </ErrorBoundary>
          </Card>
        </div>
      </div>
    </div>
  );
}

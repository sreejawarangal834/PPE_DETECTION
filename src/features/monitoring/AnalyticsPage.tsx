import { useState } from 'react';
import { useAuthStore } from '../../lib/auth/authStore';
import ComplianceStats from './ComplianceStats';
import ZoneGrid from './ZoneGrid';
import WorkerStatusWidget from '../../components/widgets/WorkerStatusWidget';
import CameraStatusWidget from '../../components/widgets/CameraStatusWidget';
import TopViolatingZonesWidget from '../../components/widgets/TopViolatingZonesWidget';
import ErrorBoundary from '../../components/ui/ErrorBoundary';
import PageShell from '../../components/ui/PageShell';

export default function AnalyticsPage() {
  const user = useAuthStore(s => s.user);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const assignedZones = user?.role === 'site_supervisor' ? user.assignedZones : undefined;

  function handleZoneClick(zoneId: string | null) {
    setSelectedZone(prev => prev === zoneId ? null : zoneId);
  }

  return (
    <PageShell><div className="space-y-4">
      {/* Page Header */}
      <div className="mb-2">
        <h1 className="text-4xl font-bold text-text-primary">Analytics</h1>
        <p className="text-lg text-text-secondary mt-2">
          Compliance statistics, zone performance, and violation trends
          {user?.role === 'site_supervisor' && user.assignedZones?.length
            ? ` · Zones: ${user.assignedZones.join(', ')}`
            : ''
          }
        </p>
      </div>

      {/* Row 1 — Compliance Stats */}
      <ErrorBoundary>
        <ComplianceStats />
      </ErrorBoundary>

      {/* Row 2 — Workers | Cameras | Top Violating Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <ErrorBoundary>
          <WorkerStatusWidget assignedZones={assignedZones} />
        </ErrorBoundary>
        <ErrorBoundary>
          <CameraStatusWidget assignedZones={assignedZones} />
        </ErrorBoundary>
        <div className="lg:col-span-2">
          <ErrorBoundary>
            <TopViolatingZonesWidget onZoneClick={handleZoneClick} assignedZones={assignedZones} />
          </ErrorBoundary>
        </div>
      </div>

      {/* Row 3 — Zone Cards */}
      <ErrorBoundary>
        <ZoneGrid selectedZone={selectedZone} onZoneSelect={handleZoneClick} assignedZones={assignedZones} />
      </ErrorBoundary>
    </div>
    </PageShell>
  );
}
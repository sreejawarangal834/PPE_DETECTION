/**
 * Site Supervisor Dashboard — identical layout to SafetyOfficerDashboard
 * but ALL widgets receive assignedZones so data is automatically scoped.
 * The zone filter cannot be removed by the user.
 */
import { useState } from 'react';
import { useAuthStore } from '../../lib/auth/authStore';
import { Lock } from 'lucide-react';
import ComplianceStats from '../monitoring/ComplianceStats';
import ZoneGrid from '../monitoring/ZoneGrid';
import CameraGrid from '../monitoring/CameraGrid';
import LiveWorkerList from '../monitoring/LiveWorkerList';
import TopViolatingZonesWidget from '../../components/widgets/TopViolatingZonesWidget';
import AlertFeedWidget from '../../components/widgets/AlertFeedWidget';
import WorkerStatusWidget from '../../components/widgets/WorkerStatusWidget';
import CameraStatusWidget from '../../components/widgets/CameraStatusWidget';
import Card from '../../components/ui/Card';
import ErrorBoundary from '../../components/ui/ErrorBoundary';

export default function SiteSupervisorDashboard() {
  const user          = useAuthStore(s => s.user);
  const assignedZones = user?.assignedZones ?? [];

  // Supervisors can select within their zones but cannot see other zones
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  function handleZoneClick(zoneId: string | null) {
    // Only allow selecting zones that are in the supervisor's assigned list
    if (zoneId && !assignedZones.includes(zoneId)) return;
    setSelectedZone(prev => prev === zoneId ? null : zoneId);
  }

  return (
    <div className="space-y-6">
      {/* Scope indicator */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Lock className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Showing your assigned zones:</span>
        {assignedZones.map(z => (
          <span key={z} className="bg-accent/15 text-accent px-2 py-0.5 rounded-full">{z}</span>
        ))}
      </div>

      {/* Row 1 — stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ErrorBoundary><ComplianceStats /></ErrorBoundary>
      </div>

      {/* Row 2 — status widgets (zone-scoped) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ErrorBoundary><WorkerStatusWidget assignedZones={assignedZones} /></ErrorBoundary>
        <ErrorBoundary><CameraStatusWidget /></ErrorBoundary>
        <div className="lg:col-span-2">
          <ErrorBoundary>
            <TopViolatingZonesWidget onZoneClick={handleZoneClick} assignedZones={assignedZones} />
          </ErrorBoundary>
        </div>
      </div>

      {/* Row 3 — Zone grid (scoped) */}
      <ErrorBoundary>
        <ZoneGrid
          selectedZone={selectedZone}
          onZoneSelect={handleZoneClick}
          assignedZones={assignedZones}
        />
      </ErrorBoundary>

      {/* Row 4 — cameras + alerts + workers (all scoped) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Camera Grid</p>
          <ErrorBoundary><CameraGrid selectedZone={selectedZone} /></ErrorBoundary>
        </div>
        <div className="space-y-4">
          <ErrorBoundary><AlertFeedWidget assignedZones={assignedZones} /></ErrorBoundary>
          <Card header={<span className="text-xs font-medium uppercase tracking-wide text-text-muted">Live Workers</span>} padding={false}>
            <ErrorBoundary>
              <LiveWorkerList selectedZone={selectedZone} assignedZones={assignedZones} />
            </ErrorBoundary>
          </Card>
        </div>
      </div>
    </div>
  );
}

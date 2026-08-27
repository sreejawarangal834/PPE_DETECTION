import { useQuery } from '@tanstack/react-query';
import { getZones } from '../../api/zonesApi';
import { getLiveStats } from '../../api/analyticsApi';
import ZoneCard from './ZoneCard';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import EmptyState from '../../components/ui/EmptyState';

interface ZoneGridProps {
  selectedZone: string | null;
  onZoneSelect: (zoneId: string | null) => void;
  assignedZones?: string[];
}

export default function ZoneGrid({ selectedZone, onZoneSelect, assignedZones }: ZoneGridProps) {
  const { data: zones = [], isLoading } = useQuery({ queryKey: ['zones'], queryFn: getZones, staleTime: 60_000 });
  // Real per-zone compliance/violations/workers-seen (backend/repositories/live_stats.py),
  // refetched periodically — replaces the old hardcoded initial={{compliance:78,...}} +
  // ZoneCard's own fake WS-driven "updates" entirely.
  const { data: liveStats } = useQuery({
    queryKey: ['analytics', 'live-stats'],
    queryFn: () => getLiveStats(60),
    refetchInterval: 20_000,
    staleTime: 15_000,
  });

  const visible = assignedZones?.length ? zones.filter(z => assignedZones.includes(z.id)) : zones;
  const statsByZone = new Map((liveStats?.zoneStats ?? []).map(s => [s.zoneId, s]));

  if (isLoading) return <LoadingSkeleton variant="card" count={6} />;
  if (visible.length === 0) return <EmptyState heading="No zones configured" message="Ask your administrator to configure zones." />;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {visible.map(z => {
        const stat = statsByZone.get(z.id);
        return (
          <ZoneCard key={z.id}
            data={{
              zoneId: z.id, zoneName: z.name,
              compliance: stat?.compliancePercent ?? null,
              workers: stat?.workersSeen ?? 0,
              violations: stat?.violations ?? 0,
            }}
            isSelected={selectedZone === z.id}
            onClick={id => onZoneSelect(selectedZone === id ? null : id)}
          />
        );
      })}
    </div>
  );
}

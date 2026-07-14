import { useQuery } from '@tanstack/react-query';
import { getZones } from '../../api/zonesApi';
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

  const visible = assignedZones?.length ? zones.filter(z => assignedZones.includes(z.id)) : zones;

  if (isLoading) return <LoadingSkeleton variant="card" count={6} />;
  if (visible.length === 0) return <EmptyState heading="No zones configured" message="Ask your administrator to configure zones." />;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {visible.map(z => (
        <ZoneCard key={z.id}
          initial={{ zoneId: z.id, zoneName: z.name, compliance: 78, workers: 3, violations: 0 }}
          isSelected={selectedZone === z.id}
          onClick={id => onZoneSelect(selectedZone === id ? null : id)}
        />
      ))}
    </div>
  );
}

interface SkeletonProps {
  variant?: 'table' | 'card' | 'chart' | 'kpi' | 'line';
  rows?: number;
  count?: number;
  className?: string;
}

function ShimmerBox({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-700/50 animate-pulse rounded ${className}`} />;
}

export default function LoadingSkeleton({ variant = 'line', rows = 5, count = 4, className = '' }: SkeletonProps) {
  if (variant === 'table') {
    return (
      <div className={`space-y-2 ${className}`} aria-busy="true" aria-label="Loading data">
        <ShimmerBox className="h-12 w-full bg-gray-700" />
        {Array.from({ length: rows }).map((_, i) => (
          <ShimmerBox key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (variant === 'card') {
    return (
      <div className={`grid grid-cols-2 gap-4 ${className}`} aria-busy="true">
        {Array.from({ length: count }).map((_, i) => (
          <ShimmerBox key={i} className="h-40 w-full rounded-xl bg-gray-800/50" />
        ))}
      </div>
    );
  }
  if (variant === 'chart') {
    return <ShimmerBox className={`h-64 w-full rounded-xl bg-gray-800/50 ${className}`} aria-busy={true} />;
  }
  if (variant === 'kpi') {
    return (
      <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-4 ${className}`} aria-busy="true">
        {Array.from({ length: count }).map((_, i) => (
          <ShimmerBox key={i} className="h-28 w-full rounded-xl bg-gray-800/50" />
        ))}
      </div>
    );
  }
  return <ShimmerBox className={`h-4 w-full ${className}`} />;
}

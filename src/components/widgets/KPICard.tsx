import type { ReactNode } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Trend {
  direction: 'up' | 'down' | 'neutral';
  delta: string;
  positive: boolean;
}

interface KPICardProps {
  title: string;
  value: string;
  trend?: Trend;
  sparklineData?: number[];
  icon?: ReactNode;
  isLoading?: boolean;
  className?: string;
}

export default function KPICard({ title, value, trend, sparklineData, icon, isLoading, className = '' }: KPICardProps) {
  if (isLoading) {
    return (
      <div className={`bg-panel border border-border-soft rounded-xl p-5 flex flex-col gap-3 ${className}`}>
        <LoadingSkeleton variant="kpi" count={1} />
      </div>
    );
  }

  // Determine trend colour
  let trendColorClass = 'text-text-muted';
  if (trend && trend.direction !== 'neutral') {
    const good = (trend.positive && trend.direction === 'up') || (!trend.positive && trend.direction === 'down');
    trendColorClass = good ? 'text-status-ok' : 'text-status-danger';
  }

  const TrendIcon = trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus;

  return (
    <div className={`bg-panel border border-border-soft rounded-xl p-5 flex flex-col gap-3 ${className}`}>
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted leading-snug">{title}</p>
        {icon && <span className="text-text-muted opacity-50 shrink-0">{icon}</span>}
      </div>

      {/* Value + trend */}
      <div className="flex items-end justify-between gap-2">
        <p className="text-3xl font-bold text-text-primary leading-none tracking-tight">{value}</p>
        {trend && (
          <div className={`flex items-center gap-1 shrink-0 ${trendColorClass}`}>
            <TrendIcon className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="text-xs font-medium font-mono">{trend.delta}</span>
          </div>
        )}
      </div>

      {/* Sparkline */}
      {sparklineData && sparklineData.length > 1 && (
        <div className="h-9 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData.map((v, i) => ({ i, v }))}>
              <Line
                type="monotone" dataKey="v"
                stroke="var(--color-accent)" strokeWidth={1.5}
                dot={false} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

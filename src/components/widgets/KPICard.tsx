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
      <div className={`bg-panel rounded-xl p-6 border border-border-soft flex flex-col gap-3 ${className}`}>
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
    <div className={`bg-panel rounded-xl p-6 border border-border-soft hover:shadow-[0_0_15px_var(--color-accent-subtle)] transition-all flex flex-col gap-3 ${className}`}>
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-text-muted">{title}</p>
        {icon && <div className="p-3 rounded-lg bg-panel-alt shrink-0">{icon}</div>}
      </div>

      {/* Value + trend */}
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        {trend && (
          <div className={`flex items-center gap-1 shrink-0 ${trendColorClass}`}>
            <TrendIcon className="w-4 h-4" aria-hidden="true" />
            <span className="text-sm font-medium">{trend.delta}</span>
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

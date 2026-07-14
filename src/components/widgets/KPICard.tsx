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
      <div className={`bg-gray-800/50 rounded-xl p-6 border border-gray-700 flex flex-col gap-3 ${className}`}>
        <LoadingSkeleton variant="kpi" count={1} />
      </div>
    );
  }

  // Determine trend colour
  let trendColorClass = 'text-gray-400';
  if (trend && trend.direction !== 'neutral') {
    const good = (trend.positive && trend.direction === 'up') || (!trend.positive && trend.direction === 'down');
    trendColorClass = good ? 'text-green-400' : 'text-red-400';
  }

  const TrendIcon = trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus;

  return (
    <div className={`bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all flex flex-col gap-3 ${className}`}>
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-400">{title}</p>
        {icon && <div className="p-3 rounded-lg bg-gray-700 shrink-0">{icon}</div>}
      </div>

      {/* Value + trend */}
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-bold text-white">{value}</p>
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
                stroke="#3b82f6" strokeWidth={1.5}
                dot={false} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

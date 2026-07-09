import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface Props { workerId: string; complianceRate: number; }

export default function ComplianceHistoryChart({ complianceRate }: Props) {
  // Generate 30 days of mock data centred around the worker's rate
  const data = Array.from({ length: 30 }, (_, i) => ({
    day: `D${i + 1}`,
    rate: Math.max(0, Math.min(100, complianceRate + Math.round((Math.random() - 0.5) * 30))),
  }));

  return (
    <div className="bg-panel border border-border-soft rounded-xl p-4">
      <p className="text-xs text-text-muted font-medium uppercase tracking-wide mb-3">Compliance — Last 30 Days</p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border-soft)" />
          <XAxis dataKey="day" tick={{ fill: 'var(--color-text-muted)', fontSize: 9 }} interval={4} />
          <YAxis domain={[0, 100]} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
          <Tooltip contentStyle={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 11 }} />
          <ReferenceLine y={80} stroke="var(--color-status-ok)" strokeDasharray="4 2" strokeOpacity={0.5} />
          <Line type="monotone" dataKey="rate" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-text-muted mt-1">Dashed line = 80% compliance target</p>
    </div>
  );
}

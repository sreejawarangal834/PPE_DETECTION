import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';

interface ComplianceGaugeProps {
  value: number; // 0-100
  size?: number;
  label?: string;
}

function complianceColor(v: number) {
  if (v >= 80) return '#22c55e';
  if (v >= 60) return '#eab308';
  return '#ef4444';
}

export default function ComplianceGauge({ value, size = 160, label = 'Compliance' }: ComplianceGaugeProps) {
  const color = complianceColor(value);
  const halfH = Math.round(size * 0.58);

  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      )}
      <div className="relative" style={{ width: size, height: halfH }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="100%"
            innerRadius="72%" outerRadius="100%"
            startAngle={180} endAngle={0}
            data={[{ value, fill: color }]}
            barSize={14}
          >
            <RadialBar
              dataKey="value"
              cornerRadius={6}
              background={{ fill: '#374151' }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* Centre percentage label */}
        <div className="absolute inset-x-0 bottom-0 flex justify-center pb-1">
          <span className="text-2xl font-bold leading-none tracking-tight" style={{ color }}>
            {value}%
          </span>
        </div>
      </div>
    </div>
  );
}

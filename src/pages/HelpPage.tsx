import { Monitor, AlertTriangle, HardHat, BarChart2, Settings, Bell, Wifi } from 'lucide-react';
import type { ReactNode } from 'react';

const SECTIONS: { icon: ReactNode; title: string; content: string }[] = [
  {
    icon: <Monitor className="w-5 h-5 text-accent" aria-hidden="true" />,
    title: 'Live Monitoring',
    content: 'Shows real-time safety compliance across all zones. Zone cards update as workers are detected and violations occur. Use the zone filter to focus on a specific area. The Top Violating Zones widget highlights which areas need the most attention right now.',
  },
  {
    icon: <AlertTriangle className="w-5 h-5 text-status-danger" aria-hidden="true" />,
    title: 'Alerts & Violations',
    content: 'Lists all safety violations detected by the cameras. New violations appear at the top automatically. Click any row to see the full details, acknowledge it to confirm you\'ve seen it, or resolve it once corrective action has been taken. Escalated alerts appear in bold red — these require immediate attention.',
  },
  {
    icon: <HardHat className="w-5 h-5 text-status-warn" aria-hidden="true" />,
    title: 'Workers',
    content: 'Browse all workers currently on site or recently detected. Click a worker to see their individual compliance history, which zones they\'ve visited today, and a list of recent violations.',
  },
  {
    icon: <BarChart2 className="w-5 h-5 text-chart-2" aria-hidden="true" />,
    title: 'Reports',
    content: 'View daily, weekly, and monthly compliance summaries. The By Worker tab shows individual compliance rates across any date range. The Ad-Hoc tab lets you query by zone, PPE type, and date. All reports can be exported to Excel or PDF.',
  },
  {
    icon: <BarChart2 className="w-5 h-5 text-chart-5" aria-hidden="true" />,
    title: 'KPI Summary',
    content: 'A high-level view of site safety performance designed for management. Shows overall compliance rate, active violations, areas of concern, workers tracked today, and average time taken to respond to alerts.',
  },
  {
    icon: <Settings className="w-5 h-5 text-text-muted" aria-hidden="true" />,
    title: 'Admin Console',
    content: '(System Administrators only) Manage users, zones, cameras, and alert thresholds. All changes are recorded in the Audit Log for accountability.',
  },
  {
    icon: <Bell className="w-5 h-5 text-text-muted" aria-hidden="true" />,
    title: 'Notifications',
    content: 'The bell icon in the top-right shows a count of unread alerts. Click it to open the Notification Centre and see recent events. Escalated alerts appear with a warning icon and require immediate action.',
  },
  {
    icon: <Wifi className="w-5 h-5 text-text-muted" aria-hidden="true" />,
    title: 'Connection Status',
    content: 'The indicator in the header shows whether the real-time data feed is active. "Live" (green) means data is updating in real time. If it shows "Reconnecting…" or "Disconnected", data on the monitoring and alerts pages may be delayed.',
  },
];

export default function HelpPage() {
  return (
    <div className="p-6 max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Help &amp; Guide</h1>
        <p className="text-sm text-text-muted mt-1">A quick guide to each section of PPE Monitor</p>
      </div>

      {SECTIONS.map(s => (
        <div key={s.title} className="bg-panel border border-border-soft rounded-xl p-5 flex gap-4">
          <div className="w-9 h-9 rounded-lg bg-panel-alt flex items-center justify-center shrink-0 mt-0.5">
            {s.icon}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary mb-1.5">{s.title}</h2>
            <p className="text-sm text-text-secondary leading-relaxed">{s.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

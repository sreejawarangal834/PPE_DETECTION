import { useState } from "react";
import { detectionEvents, type Severity } from "../data/mockData";

const severityStyles: Record<Severity, string> = {
  ok: "text-status-ok",
  medium: "text-status-warn",
  high: "text-status-danger",
};

const filters: { id: Severity | "all"; label: string }[] = [
  { id: "all", label: "All events" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "ok", label: "Compliant" },
];

export default function DetectionFeed() {
  const [filter, setFilter] = useState<Severity | "all">("all");
  const rows =
    filter === "all" ? detectionEvents : detectionEvents.filter((e) => e.severity === filter);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-border-soft flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-text-primary">Detection feed</h1>
          <p className="text-lg text-text-muted mt-0.5">Timestamped events from the inference pipeline</p>
        </div>
        <div className="flex items-center gap-1.5 bg-panel-alt rounded-md p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded text-base transition-colors ${
                filter === f.id
                  ? "bg-accent/15 text-accent"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <table className="w-full text-lg border-collapse">
          <thead>
            <tr className="text-left text-base text-text-muted tracking-wide">
              <th className="pb-2 font-normal w-24">Time</th>
              <th className="pb-2 font-normal w-24">Camera</th>
              <th className="pb-2 font-normal w-36">Zone</th>
              <th className="pb-2 font-normal">Detection</th>
              <th className="pb-2 font-normal w-20 text-right">Conf.</th>
              <th className="pb-2 font-normal w-20 text-right">Severity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => (
              <tr key={i} className="border-t border-border-soft">
                <td className="py-3 font-mono text-text-muted">{e.timestamp}</td>
                <td className="py-3 font-mono text-text-secondary">{e.camera}</td>
                <td className="py-3 text-text-secondary">{e.zone}</td>
                <td className="py-3 text-text-primary">{e.message}</td>
                <td className="py-3 font-mono text-text-muted text-right">{e.confidence.toFixed(2)}</td>
                <td className={`py-3 font-mono text-right uppercase text-base ${severityStyles[e.severity]}`}>
                  {e.severity}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

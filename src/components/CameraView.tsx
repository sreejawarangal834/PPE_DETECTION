import { useState } from "react";
import { cameras, detectionEvents, type Camera } from "../data/mockData";

const severityColor = {
  ok: "text-status-ok",
  medium: "text-status-warn",
  high: "text-status-danger",
} as const;

type ViewMode = "single" | "grid";

export default function CameraView() {
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [activeCam, setActiveCam] = useState(cameras[0].id);
  const camera = cameras.find((c) => c.id === activeCam)!;
  const camEvents = detectionEvents.filter((e) => e.camera === activeCam);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-border-soft flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-text-primary">Camera view</h1>
          <p className="text-lg text-text-muted mt-0.5">
            {viewMode === "single" ? "Single-feed detection focus" : "All cameras at a glance"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-panel-alt rounded-md p-1">
            <button
              onClick={() => setViewMode("single")}
              className={`px-3 py-1.5 rounded text-base transition-colors ${
                viewMode === "single"
                  ? "bg-accent/15 text-accent"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              Single
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 rounded text-base transition-colors ${
                viewMode === "grid"
                  ? "bg-accent/15 text-accent"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              Grid
            </button>
          </div>
          {viewMode === "single" && (
            <div className="flex items-center gap-1.5 bg-panel-alt rounded-md p-1">
              {cameras.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCam(c.id)}
                  className={`px-3 py-1.5 rounded text-base font-mono transition-colors ${
                    c.id === activeCam
                      ? "bg-accent/15 text-accent"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {c.id}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {viewMode === "single" ? (
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-6 flex flex-col">
            <CameraFeed camera={camera} />

            <div className="mt-4 grid grid-cols-4 gap-4">
              <Stat label="Zone" value={camera.zone} mono={false} />
              <Stat label="Workers detected" value={String(camera.workersDetected)} />
              <Stat
                label="Active violations"
                value={String(camera.activeViolations)}
                tone={camera.activeViolations > 0 ? "danger" : "ok"}
              />
              <Stat label="Status" value={camera.status} tone="ok" />
            </div>
          </div>

          <div className="w-96 border-l border-border-soft flex flex-col">
            <div className="px-5 py-4 border-b border-border-soft">
              <p className="text-base text-text-muted tracking-wide">RECENT EVENTS · {camera.id}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {camEvents.length === 0 && (
                <p className="px-5 py-6 text-base text-text-muted">No events recorded for this camera yet.</p>
              )}
              {camEvents.map((e, i) => (
                <div key={i} className="px-5 py-3 border-b border-border-soft">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-base text-text-muted">{e.timestamp}</span>
                    <span className={`font-mono text-sm uppercase ${severityColor[e.severity]}`}>
                      {e.severity}
                    </span>
                  </div>
                  <p className="text-lg text-text-secondary leading-snug">{e.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 p-6">
          <div className="grid grid-cols-2 grid-rows-2 gap-6 h-full">
            {cameras.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCam(c.id);
                  setViewMode("single");
                }}
                className="flex flex-col text-left min-h-0"
              >
                <CameraFeed camera={c} compact />
                <div className="mt-2 flex items-center justify-between px-0.5 shrink-0">
                  <span className="text-lg text-text-secondary">{c.name}</span>
                  <span
                    className={`text-base font-mono ${
                      c.activeViolations > 0 ? "text-status-danger" : "text-status-ok"
                    }`}
                  >
                    {c.activeViolations > 0 ? `${c.activeViolations} violation${c.activeViolations > 1 ? "s" : ""}` : "clear"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CameraFeed({ camera, compact = false }: { camera: Camera; compact?: boolean }) {
  return (
    <div
      className={`relative rounded-lg overflow-hidden border border-border bg-panel-alt ${
        compact ? "flex-1 min-h-0" : "flex-1 min-h-[380px]"
      }`}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(115deg, #1f242d 0px, #1f242d 2px, #171a20 2px, #171a20 4px)",
        }}
      />
      <div className="absolute top-3 left-3 flex items-center gap-1.5 font-mono text-base text-status-ok bg-bg/70 px-2 py-1 rounded">
        <span className="w-1.5 h-1.5 rounded-full bg-status-ok" />
        LIVE
      </div>
      <div className="absolute top-3 right-3 font-mono text-base text-text-muted bg-bg/70 px-2 py-1 rounded">
        {camera.fps.toFixed(1)} fps · {camera.latencyMs}ms
      </div>
      <div className="absolute bottom-3 left-3 font-mono text-base text-text-secondary bg-bg/70 px-2 py-1 rounded">
        {camera.id}
      </div>

      {camera.activeViolations > 0 && (
        <>
          <div
            className="absolute border-2 rounded-sm"
            style={{
              left: "38%",
              top: "30%",
              width: "16%",
              height: "42%",
              borderColor: "#C25450",
            }}
          />
          {!compact && (
            <div
              className="absolute font-mono text-base px-1.5 py-0.5 rounded bg-bg/80"
              style={{ left: "38%", top: "26%", color: "#C25450" }}
            >
              no-helmet 0.89
            </div>
          )}
        </>
      )}
      {camera.workersDetected > 0 && (
        <div
          className="absolute border-2 rounded-sm"
          style={{
            left: "58%",
            top: "34%",
            width: "14%",
            height: "38%",
            borderColor: "#4A8FA3",
          }}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  mono = true,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "ok" | "danger";
}) {
  const toneClass = tone === "ok" ? "text-status-ok" : tone === "danger" ? "text-status-danger" : "text-text-primary";
  return (
    <div className="bg-panel-alt rounded-md px-4 py-3 border border-border-soft">
      <p className="text-base text-text-muted mb-1.5">{label}</p>
      <p className={`text-xl capitalize ${mono ? "font-mono" : ""} ${toneClass}`}>{value}</p>
    </div>
  );
}

import type { ReactNode } from "react";

export type Screen = "camera" | "detections";

interface NavItem {
  id: Screen;
  label: string;
  icon: ReactNode;
}

const CameraIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="3" y="7" width="13" height="10" rx="1.5" />
    <path d="M16 10l5-2.5v9L16 14" />
  </svg>
);
const ListIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);

const items: NavItem[] = [
  { id: "camera", label: "Camera view", icon: <CameraIcon /> },
  { id: "detections", label: "Detection feed", icon: <ListIcon /> },
];

export default function Sidebar({
  active,
  onSelect,
}: {
  active: Screen;
  onSelect: (s: Screen) => void;
}) {
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-panel flex flex-col">
      <div className="px-5 py-5 border-b border-border-soft">
        <p className="text-lg font-semibold leading-tight text-text-primary tracking-wide">Innovision Limited</p>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-lg transition-colors ${
                isActive
                  ? "bg-accent/12 text-accent"
                  : "text-text-secondary hover:bg-panel-alt hover:text-text-primary"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

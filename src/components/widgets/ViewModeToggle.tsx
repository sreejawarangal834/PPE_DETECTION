import React from 'react';
import { LayoutGrid, Monitor } from 'lucide-react';
import { VIEW_MODE_DEFAULT, VIEW_MODE_STORAGE_KEY } from '../../constants/app';

export type ViewMode = 'grid' | 'single';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ viewMode, onViewModeChange }: ViewModeToggleProps) {
  // Initialize from sessionStorage on mount, default to VIEW_MODE_DEFAULT
  React.useEffect(() => {
    const stored = sessionStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored && (stored === 'grid' || stored === 'single')) {
      onViewModeChange(stored as ViewMode);
    } else {
      onViewModeChange(VIEW_MODE_DEFAULT as ViewMode);
    }
  }, [onViewModeChange]);

  const handleModeChange = (mode: ViewMode) => {
    onViewModeChange(mode);
    sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  };

  return (
    <div className="flex items-center bg-panel-alt rounded-xl p-1.5 border border-border shadow-lg">
      <button
        onClick={() => handleModeChange('grid')}
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 transform hover:scale-105 ${
          viewMode === 'grid'
            ? 'bg-accent text-white shadow-lg shadow-accent/30'
            : 'text-text-secondary hover:text-text-primary hover:bg-panel-hover'
        }`}
        aria-label="Grid View"
        aria-pressed={viewMode === 'grid'}
      >
        <LayoutGrid className="w-5 h-5" />
        <span>Grid View</span>
      </button>
      <button
        onClick={() => handleModeChange('single')}
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 transform hover:scale-105 ${
          viewMode === 'single'
            ? 'bg-accent text-white shadow-lg shadow-accent/30'
            : 'text-text-secondary hover:text-text-primary hover:bg-panel-hover'
        }`}
        aria-label="Single View"
        aria-pressed={viewMode === 'single'}
      >
        <Monitor className="w-5 h-5" />
        <span>Single View</span>
      </button>
    </div>
  );
}

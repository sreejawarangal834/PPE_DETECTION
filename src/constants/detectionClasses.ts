/**
 * Detection class registry — mirrors best.pt's exact 13-class schema.
 *
 * Classes:
 *   0 gloves  1 goggles  2 helmet  3 mask  4 no-gloves  5 no-goggles
 *   6 no-helmet  7 no-mask  8 no-shoe  9 no-vest  10 person  11 shoe  12 vest
 *
 * Each class gets a fixed, visually distinct color for its bounding-box
 * outline, label pill, and filter swatch. `no-*` classes use red variants
 * so violation boxes are immediately visually distinct.
 */

export type DetectionCategory = 'ppe' | 'violation' | 'body' | 'other';

export interface DetectionClassDef {
  /** Raw label the model / backend emits */
  id: string;
  /** Human-readable name shown in the UI */
  label: string;
  /** Hex color used for box outline, label pill, and filter swatch */
  color: string;
  category: DetectionCategory;
}

export const DETECTION_CLASSES: DetectionClassDef[] = [
  // ── Positive PPE detections (class present = compliant) ───────────────
  { id: 'helmet',   label: 'Helmet',        color: '#FFC53D', category: 'ppe' },
  { id: 'vest',     label: 'Safety Vest',   color: '#FF8A3D', category: 'ppe' },
  { id: 'gloves',   label: 'Gloves',        color: '#4ADE80', category: 'ppe' },
  { id: 'shoe',     label: 'Safety Shoe',   color: '#38BDF8', category: 'ppe' },
  { id: 'goggles',  label: 'Goggles',       color: '#F472B6', category: 'ppe' },
  { id: 'mask',     label: 'Mask',          color: '#2DD4BF', category: 'ppe' },

  // ── Violation classes (no-* = PPE absent = non-compliant) ────────────
  { id: 'no-helmet',  label: 'No Helmet',      color: '#EF4444', category: 'violation' },
  { id: 'no-vest',    label: 'No Vest',         color: '#F97316', category: 'violation' },
  { id: 'no-gloves',  label: 'No Gloves',       color: '#EF4444', category: 'violation' },
  { id: 'no-shoe',    label: 'No Safety Shoe',  color: '#EF4444', category: 'violation' },
  { id: 'no-goggles', label: 'No Goggles',      color: '#EF4444', category: 'violation' },
  { id: 'no-mask',    label: 'No Mask',         color: '#EF4444', category: 'violation' },

  // ── Body / person ─────────────────────────────────────────────────────
  { id: 'person', label: 'Person', color: '#94A3B8', category: 'body' },
];

const BY_ID: Record<string, DetectionClassDef> = Object.fromEntries(
  DETECTION_CLASSES.map(c => [c.id, c])
);

/** Normalise a raw model label to a lookup key.
 *  Handles underscore variants (no_helmet → no-helmet) the model may emit. */
function normaliseLabel(label: string): string {
  return label.trim().toLowerCase().replace(/_/g, '-');
}

/** Fallback palette for any label not in the registry */
const FALLBACK_COLOR = '#A8A296';

export function getDetectionClass(label: string): DetectionClassDef | undefined {
  return BY_ID[normaliseLabel(label)];
}

/** Color for a detection's bounding box / label pill. */
export function detectionClassColor(label: string): string {
  return getDetectionClass(label)?.color ?? FALLBACK_COLOR;
}

/** Human-readable name for a detection's raw label. */
export function detectionClassLabel(label: string): string {
  return getDetectionClass(label)?.label ?? label;
}

export const ALL_DETECTION_CLASS_IDS = DETECTION_CLASSES.map(c => c.id);

export const DETECTION_FILTER_STORAGE_KEY = 'monitoring_detection_filter';

/**
 * True if a raw detection label falls inside the currently-selected class set.
 * Labels not in the registry are shown by default.
 */
export function isDetectionClassVisible(label: string, selected: Set<string>): boolean {
  const cls = getDetectionClass(label);
  if (!cls) return true;
  return selected.has(cls.id);
}

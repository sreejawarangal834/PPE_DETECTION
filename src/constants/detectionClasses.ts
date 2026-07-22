/**
 * Detection class registry — mirrors the YOLO model's class list
 * (see backend/main.py → model.names / app/main.py → CLASS_NAMES).
 *
 * Each class gets a fixed, visually distinct color used for both its
 * bounding-box outline and its label pill on the live feed canvas, and
 * for the color swatch in the detection-class filter control. Colors
 * are chosen to stay legible against dark video frames.
 */

export type DetectionCategory = 'ppe' | 'body' | 'other';

export interface DetectionClassDef {
  /** Raw label the model / backend emits (lower-case, hyphenated) */
  id: string;
  /** Human-readable name shown in the UI */
  label: string;
  /** Hex color used for box outline, label pill, and filter swatch */
  color: string;
  category: DetectionCategory;
}

export const DETECTION_CLASSES: DetectionClassDef[] = [
  // ── PPE items ──────────────────────────────────────────────────
  { id: 'helmet',              label: 'Helmet',            color: '#FFC53D', category: 'ppe' },
  { id: 'safety-vest',         label: 'Safety Vest',       color: '#FF8A3D', category: 'ppe' },
  { id: 'gloves',               label: 'Gloves',             color: '#4ADE80', category: 'ppe' },
  { id: 'shoes',                 label: 'Safety Shoes',       color: '#38BDF8', category: 'ppe' },
  { id: 'glasses',               label: 'Safety Glasses',     color: '#F472B6', category: 'ppe' },
  { id: 'face-mask-medical',     label: 'Face Mask',          color: '#2DD4BF', category: 'ppe' },
  { id: 'face-guard',            label: 'Face Guard',         color: '#34D399', category: 'ppe' },
  { id: 'ear-mufs',               label: 'Ear Muffs',          color: '#EAB308', category: 'ppe' },
  { id: 'medical-suit',           label: 'Medical Suit',       color: '#22D3EE', category: 'ppe' },
  { id: 'safety-suit',            label: 'Safety Suit',        color: '#FB7185', category: 'ppe' },

  // ── Body parts (used for compliance association, not PPE itself) ─
  { id: 'person', label: 'Person', color: '#94A3B8', category: 'body' },
  { id: 'head',    label: 'Head',   color: '#C084FC', category: 'body' },
  { id: 'face',    label: 'Face',   color: '#818CF8', category: 'body' },
  { id: 'ear',     label: 'Ear',    color: '#FB923C', category: 'body' },
  { id: 'hands',   label: 'Hands',  color: '#60A5FA', category: 'body' },
  { id: 'foot',    label: 'Foot',   color: '#F87171', category: 'body' },

  // ── Other ──────────────────────────────────────────────────────
  { id: 'tools', label: 'Tools / Equipment', color: '#A78BFA', category: 'other' },
];

const BY_ID: Record<string, DetectionClassDef> = Object.fromEntries(
  DETECTION_CLASSES.map(c => [c.id, c])
);

/** Normalise a raw model label ("Safety_Vest", "SAFETY-VEST", …) to a lookup key */
function normaliseLabel(label: string): string {
  return label.trim().toLowerCase().replace(/_/g, '-');
}

/** Fallback palette for any label not in the registry (keeps rendering stable) */
const FALLBACK_COLOR = '#A8A296';

export function getDetectionClass(label: string): DetectionClassDef | undefined {
  return BY_ID[normaliseLabel(label)];
}

/** Color for a detection's bounding box / label pill, keyed by its raw label. */
export function detectionClassColor(label: string): string {
  return getDetectionClass(label)?.color ?? FALLBACK_COLOR;
}

/** Human-readable name for a detection's raw label, falling back to the raw text. */
export function detectionClassLabel(label: string): string {
  return getDetectionClass(label)?.label ?? label;
}

export const ALL_DETECTION_CLASS_IDS = DETECTION_CLASSES.map(c => c.id);

export const DETECTION_FILTER_STORAGE_KEY = 'monitoring_detection_filter';

/**
 * True if a raw detection label falls inside the currently-selected class
 * set. Labels not present in the registry (unknown/future classes) are
 * shown by default so nothing silently disappears.
 */
export function isDetectionClassVisible(label: string, selected: Set<string>): boolean {
  const cls = getDetectionClass(label);
  if (!cls) return true;
  return selected.has(cls.id);
}

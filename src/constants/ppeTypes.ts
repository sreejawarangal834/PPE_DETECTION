export const PPE_TYPES = [
  { id: 'helmet',       label: 'Helmet',          color: 'var(--color-severity-high)'   },
  { id: 'vest',         label: 'Safety Vest',      color: 'var(--color-severity-medium)' },
  { id: 'mask',         label: 'Mask',             color: 'var(--color-status-info)'     },
  { id: 'safety_shoes', label: 'Safety Shoes',     color: 'var(--color-status-ok)'       },
  { id: 'gloves',       label: 'Gloves',           color: 'var(--color-severity-low)'    },
  { id: 'eye_prot',     label: 'Eye Protection',   color: 'var(--color-accent)'          },
] as const;

export type PpeTypeId = typeof PPE_TYPES[number]['id'];

export const PPE_LABEL: Record<PpeTypeId, string> = Object.fromEntries(
  PPE_TYPES.map(p => [p.id, p.label])
) as Record<PpeTypeId, string>;

import type { Zone } from '../types';

export const ZONES: Zone[] = [
  {
    id: 'z-assembly',
    name: 'Assembly Line',
    description: 'Main production assembly line — north wing',
    requiredPpe: ['helmet', 'vest', 'gloves', 'safety_shoes'],
    cameraCount: 2,
    active: true,
    svgCoordinates: { x: 20, y: 20, w: 160, h: 100 },
  },
  {
    id: 'z-welding',
    name: 'Welding Zone',
    description: 'Hot work area — welding and cutting operations',
    requiredPpe: ['helmet', 'vest', 'gloves', 'eye_prot', 'safety_shoes'],
    cameraCount: 2,
    active: true,
    svgCoordinates: { x: 200, y: 20, w: 140, h: 100 },
  },
  {
    id: 'z-chemical',
    name: 'Chemical Zone',
    description: 'Chemical handling and storage — east section',
    requiredPpe: ['helmet', 'vest', 'gloves', 'mask', 'eye_prot', 'safety_shoes'],
    cameraCount: 1,
    active: true,
    svgCoordinates: { x: 360, y: 20, w: 120, h: 100 },
  },
  {
    id: 'z-storage',
    name: 'Storage Area',
    description: 'Raw material and finished goods storage',
    requiredPpe: ['helmet', 'vest', 'safety_shoes'],
    cameraCount: 1,
    active: true,
    svgCoordinates: { x: 20, y: 140, w: 160, h: 100 },
  },
  {
    id: 'z-loading',
    name: 'Loading Bay',
    description: 'Inbound and outbound logistics dock',
    requiredPpe: ['helmet', 'vest', 'safety_shoes'],
    cameraCount: 1,
    active: true,
    svgCoordinates: { x: 200, y: 140, w: 140, h: 100 },
  },
  {
    id: 'z-maintenance',
    name: 'Maintenance Workshop',
    description: 'Equipment repair and maintenance area',
    requiredPpe: ['helmet', 'vest', 'gloves', 'safety_shoes'],
    cameraCount: 1,
    active: true,
    svgCoordinates: { x: 360, y: 140, w: 120, h: 100 },
  },
];

export const ZONE_MAP = Object.fromEntries(ZONES.map(z => [z.id, z]));

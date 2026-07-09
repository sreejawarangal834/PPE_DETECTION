import type { Worker, WorkerZoneLog } from '../types';

export const WORKERS: Worker[] = [
  { id: 'W-007', name: 'Chen Wei',        department: 'Production',  currentZoneId: 'z-assembly',    currentZoneName: 'Assembly Line',       lastSeen: new Date().toISOString(), complianceRate: 74, totalViolations: 8,  activeViolations: 1, zonesVisited: ['z-assembly', 'z-storage'] },
  { id: 'W-012', name: 'David Osei',      department: 'Maintenance', currentZoneId: 'z-maintenance', currentZoneName: 'Maintenance Workshop', lastSeen: new Date().toISOString(), complianceRate: 61, totalViolations: 14, activeViolations: 1, zonesVisited: ['z-maintenance', 'z-assembly'] },
  { id: 'W-019', name: 'James Okafor',    department: 'Welding',     currentZoneId: 'z-welding',     currentZoneName: 'Welding Zone',         lastSeen: new Date().toISOString(), complianceRate: 45, totalViolations: 22, activeViolations: 1, zonesVisited: ['z-welding'] },
  { id: 'W-028', name: 'Fatima Al-Hassan',department: 'Logistics',   currentZoneId: null,            currentZoneName: null,                  lastSeen: new Date(Date.now() - 3600000).toISOString(), complianceRate: 88, totalViolations: 3, activeViolations: 0, zonesVisited: ['z-storage', 'z-loading'] },
  { id: 'W-031', name: 'Arjun Mehta',     department: 'Chemical',    currentZoneId: 'z-chemical',    currentZoneName: 'Chemical Zone',        lastSeen: new Date().toISOString(), complianceRate: 55, totalViolations: 18, activeViolations: 0, zonesVisited: ['z-chemical'] },
  { id: 'W-042', name: 'Priya Nair',      department: 'Production',  currentZoneId: 'z-assembly',    currentZoneName: 'Assembly Line',        lastSeen: new Date().toISOString(), complianceRate: 66, totalViolations: 11, activeViolations: 1, zonesVisited: ['z-assembly', 'z-welding'] },
  { id: 'W-055', name: 'Maria Santos',    department: 'Production',  currentZoneId: null,            currentZoneName: null,                  lastSeen: new Date(Date.now() - 1800000).toISOString(), complianceRate: 92, totalViolations: 2, activeViolations: 0, zonesVisited: ['z-assembly'] },
  { id: 'W-063', name: 'Robert Kim',      department: 'Welding',     currentZoneId: 'z-welding',     currentZoneName: 'Welding Zone',         lastSeen: new Date().toISOString(), complianceRate: 97, totalViolations: 1,  activeViolations: 0, zonesVisited: ['z-welding', 'z-maintenance'] },
  { id: 'W-071', name: 'Aisha Diallo',    department: 'Logistics',   currentZoneId: 'z-loading',     currentZoneName: 'Loading Bay',          lastSeen: new Date().toISOString(), complianceRate: 83, totalViolations: 5,  activeViolations: 0, zonesVisited: ['z-loading', 'z-storage'] },
  { id: 'W-084', name: 'Tom Eriksen',     department: 'Production',  currentZoneId: 'z-assembly',    currentZoneName: 'Assembly Line',        lastSeen: new Date().toISOString(), complianceRate: 79, totalViolations: 7,  activeViolations: 0, zonesVisited: ['z-assembly'] },
  { id: 'W-092', name: 'Lindiwe Dube',    department: 'Chemical',    currentZoneId: 'z-chemical',    currentZoneName: 'Chemical Zone',        lastSeen: new Date().toISOString(), complianceRate: 48, totalViolations: 25, activeViolations: 0, zonesVisited: ['z-chemical', 'z-storage'] },
  { id: 'W-101', name: 'Miguel Torres',   department: 'Maintenance', currentZoneId: null,            currentZoneName: null,                  lastSeen: new Date(Date.now() - 7200000).toISOString(), complianceRate: 95, totalViolations: 1, activeViolations: 0, zonesVisited: ['z-maintenance'] },
  { id: 'W-115', name: 'Yuki Tanaka',     department: 'Production',  currentZoneId: 'z-assembly',    currentZoneName: 'Assembly Line',        lastSeen: new Date().toISOString(), complianceRate: 71, totalViolations: 9,  activeViolations: 0, zonesVisited: ['z-assembly', 'z-welding'] },
  { id: 'W-128', name: 'Kofi Asante',     department: 'Welding',     currentZoneId: 'z-welding',     currentZoneName: 'Welding Zone',         lastSeen: new Date().toISOString(), complianceRate: 88, totalViolations: 4,  activeViolations: 0, zonesVisited: ['z-welding'] },
  { id: 'W-140', name: 'Natasha Ivanova', department: 'Logistics',   currentZoneId: 'z-storage',     currentZoneName: 'Storage Area',         lastSeen: new Date().toISOString(), complianceRate: 100, totalViolations: 0, activeViolations: 0, zonesVisited: ['z-storage', 'z-loading'] },
];

export const WORKER_MAP = Object.fromEntries(WORKERS.map(w => [w.id, w]));

export const ZONE_LOGS: WorkerZoneLog[] = [
  { workerId: 'W-042', zoneId: 'z-assembly', zoneName: 'Assembly Line', entryTime: '08:00', exitTime: '10:30', duration: '2h 30m', complianceStatus: 'partial' },
  { workerId: 'W-042', zoneId: 'z-welding',  zoneName: 'Welding Zone',  entryTime: '10:45', exitTime: '12:00', duration: '1h 15m', complianceStatus: 'non_compliant' },
  { workerId: 'W-042', zoneId: 'z-assembly', zoneName: 'Assembly Line', entryTime: '12:30', exitTime: null,   duration: 'In zone', complianceStatus: 'non_compliant' },
  { workerId: 'W-019', zoneId: 'z-welding',  zoneName: 'Welding Zone',  entryTime: '07:30', exitTime: null,   duration: 'In zone', complianceStatus: 'non_compliant' },
  { workerId: 'W-007', zoneId: 'z-assembly', zoneName: 'Assembly Line', entryTime: '08:00', exitTime: '11:00', duration: '3h',      complianceStatus: 'partial' },
  { workerId: 'W-007', zoneId: 'z-storage',  zoneName: 'Storage Area',  entryTime: '11:15', exitTime: '12:00', duration: '45m',     complianceStatus: 'compliant' },
];

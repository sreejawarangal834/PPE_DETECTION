import type { Camera, Alert } from '../types';

export type { Camera };

export const CAMERAS: Camera[] = [
  { id: 'CAM-01', name: 'Assembly Line — North', rtspUrl: 'rtsp://***', zoneId: 'z-assembly', zoneName: 'Assembly Line', status: 'online', fps: 24.1, latencyMs: 42, workersDetected: 7, activeViolations: 2, lastSeen: new Date().toISOString() },
  { id: 'CAM-02', name: 'Welding Bay', rtspUrl: 'rtsp://***', zoneId: 'z-welding', zoneName: 'Welding Zone', status: 'online', fps: 23.6, latencyMs: 47, workersDetected: 1, activeViolations: 1, lastSeen: new Date().toISOString() },
  { id: 'CAM-03', name: 'Storage — East Gate', rtspUrl: 'rtsp://***', zoneId: 'z-storage', zoneName: 'Storage Area', status: 'online', fps: 24.8, latencyMs: 39, workersDetected: 0, activeViolations: 0, lastSeen: new Date().toISOString() },
  { id: 'CAM-04', name: 'Chemical Handling', rtspUrl: 'rtsp://***', zoneId: 'z-chemical', zoneName: 'Chemical Zone', status: 'online', fps: 22.9, latencyMs: 51, workersDetected: 0, activeViolations: 0, lastSeen: new Date().toISOString() },
  { id: 'CAM-05', name: 'Loading Bay — Main', rtspUrl: 'rtsp://***', zoneId: 'z-loading', zoneName: 'Loading Bay', status: 'offline', fps: 0, latencyMs: 0, workersDetected: 0, activeViolations: 0, lastSeen: new Date(Date.now() - 3600000).toISOString() },
  { id: 'CAM-06', name: 'Maintenance Workshop', rtspUrl: 'rtsp://***', zoneId: 'z-maintenance', zoneName: 'Maintenance Workshop', status: 'online', fps: 24.0, latencyMs: 44, workersDetected: 2, activeViolations: 0, lastSeen: new Date().toISOString() },
];

const now = Date.now();
const min = 60_000;

export const ALERTS: Alert[] = [
  { id: 'ALT-001', createdAt: now - 2 * min, timestamp: '12:49:20', cameraId: 'CAM-02', zoneId: 'z-welding', zoneName: 'Welding Zone', workerId: 'W-019', workerName: 'James Okafor', missingPpe: ['helmet', 'vest', 'gloves'], confidence: 0.91, severity: 'high', status: 'escalated', acknowledgedBy: undefined, acknowledgedAt: undefined, resolvedBy: undefined, resolvedAt: undefined, escalatedAt: new Date(now - min).toISOString() },
  { id: 'ALT-002', createdAt: now - 5 * min, timestamp: '12:49:18', cameraId: 'CAM-01', zoneId: 'z-assembly', zoneName: 'Assembly Line', workerId: 'W-042', workerName: 'Priya Nair', missingPpe: ['helmet', 'vest'], confidence: 0.88, severity: 'high', status: 'open' },
  { id: 'ALT-003', createdAt: now - 8 * min, timestamp: '12:48:50', cameraId: 'CAM-01', zoneId: 'z-assembly', zoneName: 'Assembly Line', workerId: 'W-007', workerName: 'Chen Wei', missingPpe: ['gloves'], confidence: 0.83, severity: 'medium', status: 'acknowledged', acknowledgedBy: 'Safety Officer', acknowledgedAt: new Date(now - 6 * min).toISOString() },
  { id: 'ALT-004', createdAt: now - 20 * min, timestamp: '12:40:10', cameraId: 'CAM-04', zoneId: 'z-chemical', zoneName: 'Chemical Zone', workerId: 'W-031', workerName: 'Arjun Mehta', missingPpe: ['mask', 'eye_prot'], confidence: 0.95, severity: 'high', status: 'resolved', acknowledgedBy: 'John Smith', acknowledgedAt: new Date(now - 18 * min).toISOString(), resolvedBy: 'John Smith', resolvedAt: new Date(now - 15 * min).toISOString(), resolutionNotes: 'Worker was instructed to put on PPE. Confirmed compliance before re-entry.' },
  { id: 'ALT-005', createdAt: now - 35 * min, timestamp: '12:25:00', cameraId: 'CAM-01', zoneId: 'z-assembly', zoneName: 'Assembly Line', workerId: 'W-055', workerName: 'Maria Santos', missingPpe: ['helmet'], confidence: 0.87, severity: 'medium', status: 'resolved', acknowledgedBy: 'Officer Kumar', acknowledgedAt: new Date(now - 33 * min).toISOString(), resolvedBy: 'Officer Kumar', resolvedAt: new Date(now - 30 * min).toISOString(), resolutionNotes: 'Helmet was located and worn. Worker briefed on PPE policy.' },
  { id: 'ALT-006', createdAt: now - 50 * min, timestamp: '12:10:05', cameraId: 'CAM-06', zoneId: 'z-maintenance', zoneName: 'Maintenance Workshop', workerId: 'W-012', workerName: 'David Osei', missingPpe: ['gloves', 'safety_shoes'], confidence: 0.79, severity: 'medium', status: 'open' },
  { id: 'ALT-007', createdAt: now - 65 * min, timestamp: '11:55:30', cameraId: 'CAM-01', zoneId: 'z-assembly', zoneName: 'Assembly Line', workerId: 'W-042', workerName: 'Priya Nair', missingPpe: ['vest'], confidence: 0.82, severity: 'medium', status: 'acknowledged', acknowledgedBy: 'Safety Officer', acknowledgedAt: new Date(now - 63 * min).toISOString() },
  { id: 'ALT-008', createdAt: now - 120 * min, timestamp: '11:00:00', cameraId: 'CAM-03', zoneId: 'z-storage', zoneName: 'Storage Area', workerId: 'W-028', workerName: 'Fatima Al-Hassan', missingPpe: ['helmet', 'vest'], confidence: 0.90, severity: 'high', status: 'resolved', acknowledgedBy: 'Supervisor Lee', acknowledgedAt: new Date(now - 118 * min).toISOString(), resolvedBy: 'Supervisor Lee', resolvedAt: new Date(now - 115 * min).toISOString(), resolutionNotes: 'PPE provided from site store. Worker compliant on next inspection.' },
];

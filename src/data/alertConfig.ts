import type { AlertConfig } from '../types';

export const DEFAULT_ALERT_CONFIG: AlertConfig[] = [
  { zoneId: 'z-assembly',    zoneName: 'Assembly Line',       confidenceThreshold: 0.75, escalationDelayMinutes: 10, severityMap: { 'helmet': 'high', 'vest': 'medium', 'gloves': 'medium', 'safety_shoes': 'medium' } },
  { zoneId: 'z-welding',     zoneName: 'Welding Zone',        confidenceThreshold: 0.80, escalationDelayMinutes: 5,  severityMap: { 'helmet': 'high', 'vest': 'high',   'gloves': 'high',   'eye_prot': 'high', 'safety_shoes': 'high' } },
  { zoneId: 'z-chemical',    zoneName: 'Chemical Zone',       confidenceThreshold: 0.80, escalationDelayMinutes: 5,  severityMap: { 'helmet': 'high', 'vest': 'high',   'mask': 'high',     'eye_prot': 'high', 'gloves': 'high', 'safety_shoes': 'high' } },
  { zoneId: 'z-storage',     zoneName: 'Storage Area',        confidenceThreshold: 0.70, escalationDelayMinutes: 15, severityMap: { 'helmet': 'medium', 'vest': 'medium', 'safety_shoes': 'medium' } },
  { zoneId: 'z-loading',     zoneName: 'Loading Bay',         confidenceThreshold: 0.70, escalationDelayMinutes: 15, severityMap: { 'helmet': 'medium', 'vest': 'medium', 'safety_shoes': 'medium' } },
  { zoneId: 'z-maintenance', zoneName: 'Maintenance Workshop',confidenceThreshold: 0.75, escalationDelayMinutes: 10, severityMap: { 'helmet': 'high',   'vest': 'medium', 'gloves': 'medium', 'safety_shoes': 'medium' } },
];

// Mutable config store (mimics backend state)
let _config = [...DEFAULT_ALERT_CONFIG];

export function getAlertConfig(): AlertConfig[] { return _config; }
export function saveAlertConfig(config: AlertConfig[]): void { _config = config; }
export function getEscalationDelayMs(zoneId: string): number {
  const cfg = _config.find(c => c.zoneId === zoneId);
  return (cfg?.escalationDelayMinutes ?? 10) * 60_000;
}

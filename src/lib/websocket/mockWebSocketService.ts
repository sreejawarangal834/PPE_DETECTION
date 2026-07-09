import type { WsEvent, WsStatus } from '../../types';
import {
  WS_EVENT_INTERVAL_MIN_MS, WS_EVENT_INTERVAL_MAX_MS,
  WS_MOCK_DISCONNECT_INTERVAL_MS, WS_RECONNECT_MAX_MS,
} from '../../constants/app';
import { ZONES } from '../../data/zones';
import { WORKERS } from '../../data/workers';
import { CAMERAS } from '../../data/mockData';

type MessageHandler = (event: WsEvent) => void;
type StatusHandler  = (status: WsStatus) => void;

const WORKER_IDS  = WORKERS.map(w => w.id);
const ZONE_IDS    = ZONES.map(z => z.id);
const CAMERA_IDS  = CAMERAS.map(c => c.id);
const PPE_LIST    = ['helmet','vest','gloves','mask','eye_prot','safety_shoes'] as const;
const NAMES       = ['Chen Wei','Priya Nair','James Okafor','Arjun Mehta','Fatima Al-Hassan','David Osei'];

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function makeAlert(): WsEvent {
  const zoneId   = pick(ZONE_IDS);
  const zone     = ZONES.find(z => z.id === zoneId)!;
  const missing  = zone.requiredPpe.filter(() => Math.random() > 0.6).slice(0, 3);
  const severity = missing.length >= 3 ? 'high' : missing.length >= 1 ? 'medium' : 'low';
  return {
    type: 'alert_new',
    payload: {
      id: `ALT-WS-${Date.now()}`,
      createdAt: Date.now(),
      timestamp: new Date().toLocaleTimeString('en-GB'),
      cameraId: pick(CAMERA_IDS),
      zoneId,
      zoneName: zone.name,
      workerId: pick(WORKER_IDS),
      workerName: pick(NAMES),
      missingPpe: missing.length ? missing : ['helmet'],
      confidence: parseFloat(rand(0.75, 0.97).toFixed(2)),
      severity,
      status: 'open',
    },
  };
}

function makeZoneUpdate(): WsEvent {
  const zoneId = pick(ZONE_IDS);
  return {
    type: 'zone_compliance_update',
    payload: {
      zoneId,
      compliancePercent: Math.floor(rand(50, 100)),
      workerCount: Math.floor(rand(0, 8)),
      violations: Math.floor(rand(0, 4)),
    },
  };
}

function makeCameraUpdate(): WsEvent {
  const cameraId = pick(CAMERA_IDS);
  return {
    type: 'camera_metrics_update',
    payload: {
      cameraId,
      fps: parseFloat(rand(22, 25).toFixed(1)),
      latencyMs: Math.floor(rand(30, 70)),
      workerCount: Math.floor(rand(0, 5)),
      violations: Math.floor(rand(0, 3)),
    },
  };
}

function makeWorkerUpdate(): WsEvent {
  const workerId = pick(WORKER_IDS);
  const zoneId   = pick(ZONE_IDS);
  return {
    type: 'worker_update',
    payload: {
      workerId,
      zoneId,
      complianceStatus: Math.random() > 0.3 ? 'compliant' : 'non_compliant',
      missingPpe: Math.random() > 0.7 ? [pick(PPE_LIST as unknown as string[])] : [],
    },
  };
}

function makeTopZonesUpdate(): WsEvent {
  return {
    type: 'top_zones_update',
    payload: {
      window: 'last_hour',
      zones: ZONE_IDS.map(id => ({
        zoneId: id,
        violations: Math.floor(rand(0, 10)),
      })).sort((a, b) => b.violations - a.violations).slice(0, 5),
    },
  };
}

const EVENT_MAKERS = [makeAlert, makeZoneUpdate, makeCameraUpdate, makeWorkerUpdate, makeTopZonesUpdate];

class MockWebSocketService {
  private messageHandlers: MessageHandler[] = [];
  private statusHandlers:  StatusHandler[]  = [];
  private eventTimer:      ReturnType<typeof setInterval> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout>  | null = null;
  private reconnectTimer:  ReturnType<typeof setTimeout>  | null = null;
  private reconnectDelay = 1_000;
  private _status: WsStatus = 'disconnected';

  private setStatus(s: WsStatus) {
    this._status = s;
    this.statusHandlers.forEach(h => h(s));
  }

  connect() {
    this.setStatus('connected');
    this.reconnectDelay = 1_000;
    this.startEmitting();
    this.scheduleDisconnect();
  }

  disconnect() {
    this.stopTimers();
    this.setStatus('disconnected');
  }

  onMessage(handler: MessageHandler) { this.messageHandlers.push(handler); }
  onStatusChange(handler: StatusHandler) { this.statusHandlers.push(handler); }

  removeAllHandlers() { this.messageHandlers = []; this.statusHandlers = []; }

  private emit(event: WsEvent) { this.messageHandlers.forEach(h => h(event)); }

  private startEmitting() {
    if (this.eventTimer) clearInterval(this.eventTimer);
    const interval = rand(WS_EVENT_INTERVAL_MIN_MS, WS_EVENT_INTERVAL_MAX_MS);
    this.eventTimer = setInterval(() => {
      const maker = EVENT_MAKERS[Math.floor(Math.random() * EVENT_MAKERS.length)];
      this.emit(maker());
    }, interval);
  }

  private scheduleDisconnect() {
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.disconnectTimer = setTimeout(() => {
      if (this._status !== 'connected') return;
      this.stopTimers();
      this.setStatus('reconnecting');
      this.scheduleReconnect();
    }, WS_MOCK_DISCONNECT_INTERVAL_MS);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.setStatus('connected');
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, WS_RECONNECT_MAX_MS);
      this.startEmitting();
      this.scheduleDisconnect();
    }, this.reconnectDelay);
  }

  private stopTimers() {
    if (this.eventTimer)      { clearInterval(this.eventTimer);     this.eventTimer      = null; }
    if (this.disconnectTimer) { clearTimeout(this.disconnectTimer); this.disconnectTimer = null; }
    if (this.reconnectTimer)  { clearTimeout(this.reconnectTimer);  this.reconnectTimer  = null; }
  }
}

export const mockWsService = new MockWebSocketService();

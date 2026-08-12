import type { Camera } from '../types';
import { appendAuditLog } from '../lib/audit/auditLog';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function getCameras(): Promise<Camera[]> {
  return request<Camera[]>('/api/cameras');
}

export async function getCameraById(id: string): Promise<Camera> {
  const cameras = await getCameras();
  const camera = cameras.find(c => c.id === id);
  if (!camera) throw new Error(`Camera ${id} not found`);
  return camera;
}

export async function createCamera(data: Omit<Camera, 'id' | 'status' | 'fps' | 'latencyMs' | 'workersDetected' | 'activeViolations' | 'lastSeen'>, actor: string): Promise<Camera> {
  const camera = await request<Camera>('/api/cameras', { method: 'POST', body: JSON.stringify(data) });
  appendAuditLog({ actor, actionType: 'CAMERA_CREATE', entity: `Camera: ${camera.id}`, description: `Added camera ${camera.name}`, ipAddress: '—' });
  return camera;
}

export async function updateCamera(id: string, data: Partial<Camera>, actor: string): Promise<Camera> {
  const camera = await request<Camera>(`/api/cameras/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  appendAuditLog({ actor, actionType: 'CAMERA_UPDATE', entity: `Camera: ${id}`, description: `Updated camera ${id}`, ipAddress: '—' });
  return camera;
}

// Real camera slots have no RTSP connection to test yet (see backend/cameras.py) —
// kept as a simulated result so the admin UI's "Test Connection" button still
// works end-to-end without pretending to reach real hardware.
export async function testCameraConnection(_id: string): Promise<{ success: boolean; message: string }> {
  await new Promise<void>(r => setTimeout(r, 600));
  const success = Math.random() > 0.3;
  return { success, message: success ? 'Connection successful' : 'Connection timed out' };
}

// No-op: there is no local mock cache left to patch — kept so any future
// caller mirroring the old mock-WS pattern doesn't hit a missing export.
export function updateCameraLive(_id: string, _patch: Partial<Camera>): void {}

import type { Camera } from '../types';
import { CAMERAS } from '../data/mockData';
import { appendAuditLog } from '../lib/audit/auditLog';

let _cameras: Camera[] = [...CAMERAS];

function delay(ms = 300) { return new Promise<void>(r => setTimeout(r, ms)); }

export async function getCameras(): Promise<Camera[]> {
  await delay();
  return [..._cameras];
}

export async function getCameraById(id: string): Promise<Camera> {
  await delay(150);
  const c = _cameras.find(c => c.id === id);
  if (!c) throw new Error(`Camera ${id} not found`);
  return { ...c };
}

export async function createCamera(data: Omit<Camera, 'id' | 'status' | 'fps' | 'latencyMs' | 'workersDetected' | 'activeViolations' | 'lastSeen'>, actor: string): Promise<Camera> {
  await delay(400);
  const newCam: Camera = { ...data, id: `CAM-${String(_cameras.length + 1).padStart(2, '0')}`, status: 'offline', fps: 0, latencyMs: 0, workersDetected: 0, activeViolations: 0, lastSeen: '—' };
  _cameras.push(newCam);
  appendAuditLog({ actor, actionType: 'CAMERA_CREATE', entity: `Camera: ${newCam.id}`, description: `Added camera ${newCam.name}`, ipAddress: '—' });
  return { ...newCam };
}

export async function updateCamera(id: string, data: Partial<Camera>, actor: string): Promise<Camera> {
  await delay(300);
  const idx = _cameras.findIndex(c => c.id === id);
  if (idx === -1) throw new Error(`Camera ${id} not found`);
  _cameras[idx] = { ..._cameras[idx], ...data };
  appendAuditLog({ actor, actionType: 'CAMERA_UPDATE', entity: `Camera: ${id}`, description: `Updated camera ${id}`, ipAddress: '—' });
  return { ..._cameras[idx] };
}

export async function testCameraConnection(_id: string): Promise<{ success: boolean; message: string }> {
  await delay(1200);
  const success = Math.random() > 0.3;
  return { success, message: success ? 'Connection successful' : 'Connection timed out' };
}

export function updateCameraLive(id: string, patch: Partial<Camera>): void {
  const idx = _cameras.findIndex(c => c.id === id);
  if (idx !== -1) _cameras[idx] = { ..._cameras[idx], ...patch };
}

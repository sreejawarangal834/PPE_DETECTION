import type { AuthUser, MockToken } from '../types';
import { SESSION_TTL_MS } from '../constants/app';

const SEED_USERS: (AuthUser & { password: string })[] = [
  { id: 'u-1', username: 'admin',      password: 'admin123',   name: 'Alex Admin',         email: 'admin@innovision.com',      role: 'admin',           assignedZones: [],                         lastLogin: '2026-07-09 08:00', status: 'active' },
  { id: 'u-2', username: 'officer',    password: 'officer123', name: 'Sarah Officer',      email: 'sarah@innovision.com',      role: 'safety_officer',  assignedZones: [],                         lastLogin: '2026-07-09 07:30', status: 'active' },
  { id: 'u-3', username: 'supervisor', password: 'super123',   name: 'Mike Supervisor',    email: 'mike@innovision.com',       role: 'site_supervisor', assignedZones: ['z-assembly', 'z-welding'], lastLogin: '2026-07-09 07:45', status: 'active' },
  { id: 'u-4', username: 'ehs',        password: 'ehs123',     name: 'Emma EHS',           email: 'emma@innovision.com',       role: 'ehs_manager',     assignedZones: [],                         lastLogin: '2026-07-09 09:00', status: 'active' },
  { id: 'u-5', username: 'manager',    password: 'mgmt123',    name: 'Peter Management',   email: 'peter@innovision.com',      role: 'plant_mgmt',      assignedZones: [],                         lastLogin: '2026-07-08 16:00', status: 'active' },
];

let _users = SEED_USERS.map(u => ({ ...u }));

function delay(ms = 400): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export interface LoginResult { user: AuthUser; token: MockToken }

export async function login(username: string, password: string): Promise<LoginResult> {
  await delay();
  const found = _users.find(u => u.username === username && u.password === password && u.status === 'active');
  if (!found) throw new Error('Invalid username or password');
  const now = Date.now();
  const token: MockToken = { userId: found.id, issuedAt: now, expiresAt: now + SESSION_TTL_MS };
  const { password: _, ...user } = found;
  return { user, token };
}

export async function getProfile(userId: string): Promise<AuthUser> {
  await delay(200);
  const found = _users.find(u => u.id === userId);
  if (!found) throw new Error('User not found');
  const { password: _, ...user } = found;
  return user;
}

export async function updateProfile(userId: string, data: Partial<Pick<AuthUser, 'name' | 'email'>>): Promise<AuthUser> {
  await delay(300);
  const idx = _users.findIndex(u => u.id === userId);
  if (idx === -1) throw new Error('User not found');
  _users[idx] = { ..._users[idx], ...data };
  const { password: _, ...user } = _users[idx];
  return user;
}

export async function forgotPassword(_email: string): Promise<void> {
  await delay(600);
  // Mock: always succeeds silently
}

export async function resetPassword(token: string, _newPassword: string): Promise<void> {
  await delay(500);
  if (!token) throw new Error('Invalid reset token');
}

export function getAllUsers() { return _users.map(({ password: _, ...u }) => u); }
export function updateUserRecord(id: string, data: Partial<AuthUser>) {
  const idx = _users.findIndex(u => u.id === id);
  if (idx !== -1) _users[idx] = { ..._users[idx], ...data };
}
export function createUserRecord(data: Omit<AuthUser, 'id' | 'lastLogin'> & { password: string }) {
  const newUser = { ...data, id: `u-${Date.now()}`, lastLogin: '—' };
  _users.push(newUser);
  return newUser;
}
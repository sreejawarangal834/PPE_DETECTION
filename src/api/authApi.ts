import type { AuthUser, AuthToken } from '../types';

// Real backend auth (Phase 4) — the plaintext seed users that used to live here
// (admin/admin123, officer/officer123, supervisor/super123, ehs/ehs123, manager/mgmt123)
// are gone. Every credential now round-trips through backend/auth/ (argon2id + JWT), which
// is also the only place that actually enforces anything — see
// backend/auth/dependencies.py's docstring.

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

/** Decode a JWT's `exp` claim (seconds since epoch) without a JWT library — this app only
 * ever needs to read the expiry of a token it just received, never to verify a signature
 * (the backend already did that before issuing it). */
function decodeJwtExpiryMs(jwt: string): number {
  const payload = jwt.split('.')[1];
  const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  return (json.exp as number) * 1000;
}

interface BackendUser { id: string; name: string; email: string; role: AuthUser['role']; assignedZones: string[] }

function toAuthUser(u: BackendUser): AuthUser {
  return {
    id: u.id, username: u.email, name: u.name, email: u.email, role: u.role,
    assignedZones: u.assignedZones, lastLogin: new Date().toISOString(), status: 'active',
  };
}

export interface LoginResult { user: AuthUser; token: AuthToken }

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await request<{ accessToken: string; refreshToken: string; user: BackendUser }>(
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  );
  return {
    user: toAuthUser(res.user),
    token: { accessToken: res.accessToken, refreshToken: res.refreshToken, expiresAt: decodeJwtExpiryMs(res.accessToken) },
  };
}

/** Refresh-token rotation (backend/main.py's /api/auth/refresh — see
 * backend/repositories/users.py for the reuse-detection this depends on). Called from
 * authStore's expiry-check interval before the access token actually expires. */
export async function refresh(refreshToken: string): Promise<AuthToken> {
  const res = await request<{ accessToken: string; refreshToken: string }>(
    '/api/auth/refresh',
    { method: 'POST', body: JSON.stringify({ refreshToken }) },
  );
  return { accessToken: res.accessToken, refreshToken: res.refreshToken, expiresAt: decodeJwtExpiryMs(res.accessToken) };
}

export async function logout(accessToken: string, refreshToken: string): Promise<void> {
  await request('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ refreshToken }),
  });
}

export async function getProfile(accessToken: string): Promise<AuthUser> {
  const res = await request<BackendUser>('/api/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } });
  return toAuthUser(res);
}

// Real backend endpoints (fake-frontend audit — these three used to always throw
// "not implemented" behind a caught error, which is better than a fake success but still
// left dead-end forms in the product; PUT /api/auth/me and the password-reset endpoints
// below now genuinely work, verified via MailHog end-to-end).

export async function updateProfile(accessToken: string, name: string, email: string): Promise<AuthUser> {
  const res = await request<BackendUser>('/api/auth/me', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ name, email }),
  });
  return toAuthUser(res);
}

export async function forgotPassword(email: string): Promise<void> {
  // Always resolves the same way regardless of whether the email exists — the backend
  // deliberately returns an identical response either way (no account enumeration).
  await request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) });
}

import { useAuthStore } from './auth/authStore';

/**
 * fetch() wrapper that attaches the current access token, for every API module whose backend
 * endpoints now enforce `Depends(get_current_user)` / `require_role(...)` (Phase 4 —
 * backend/auth/dependencies.py). Reads the token via zustand's `getState()` rather than a
 * hook, since API modules are plain functions, not components.
 *
 * Does not itself retry on a 401 with a refreshed token — authStore's own expiry-check
 * interval proactively refreshes before the access token expires (see authStore.ts), so a
 * 401 here means something more fundamental than "token happened to expire mid-request"
 * (revoked session, tampered token) and the caller should treat it as a real auth failure.
 */
export async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = useAuthStore.getState().token?.accessToken;
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

export async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

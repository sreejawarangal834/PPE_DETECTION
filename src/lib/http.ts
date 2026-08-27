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

/**
 * Fetches an authenticated image endpoint (e.g. GET /api/snapshots/{id}) and hands back an
 * object URL — the only way to put an auth-gated image into an <img src>, since <img> tags
 * can't attach an Authorization header themselves. Caller owns the returned URL's lifetime
 * (revokeObjectURL it, e.g. in a useEffect cleanup) to avoid leaking blob memory.
 * Returns null on any failure (404 no snapshot, 401, network error) — callers render an
 * honest empty state on null, never a broken-image icon.
 */
export async function fetchSnapshotBlobUrl(path: string): Promise<string | null> {
  try {
    const res = await authFetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Same fetch, but returns a base64 data: URL instead of a blob: URL — needed anywhere the
 * image has to survive outside this page's lifetime/origin (an iframe's srcdoc for
 * printReport, or a detached PDF/HTML export) where a blob: URL wouldn't resolve.
 */
export async function fetchSnapshotDataUrl(path: string): Promise<string | null> {
  try {
    const res = await authFetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

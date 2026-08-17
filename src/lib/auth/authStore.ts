import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, AuthToken } from '../../types';
import { EXPIRY_CHECK_MS } from '../../constants/app';
import { refresh as refreshTokenApi } from '../../api/authApi';

interface AuthState {
  user: AuthUser | null;
  token: AuthToken | null;
  login: (user: AuthUser, token: AuthToken) => void;
  logout: () => void;
  checkExpiry: () => boolean;
  updateUser: (patch: Partial<AuthUser>) => void;
}

let _expiryInterval: ReturnType<typeof setInterval> | null = null;
let _navigateFn: ((path: string) => void) | null = null;
let _refreshing = false;

export function setNavigate(fn: (path: string) => void): void {
  _navigateFn = fn;
}

// Proactively rotate the refresh token this far ahead of the access token's actual expiry
// (backend/repositories/users.py's rotate-with-reuse-detection means only ONE refresh token
// is ever valid at a time, so this must complete before expiry, not after).
const REFRESH_LEAD_MS = 60_000;

async function tryProactiveRefresh(): Promise<boolean> {
  const { token, login, user } = useAuthStore.getState();
  if (!token || !user || _refreshing) return true;
  if (token.expiresAt - Date.now() > REFRESH_LEAD_MS) return true; // not due yet
  _refreshing = true;
  try {
    const newToken = await refreshTokenApi(token.refreshToken);
    login(user, newToken);
    return true;
  } catch {
    return false; // refresh token invalid/expired/revoked — real logout, not a transient blip
  } finally {
    _refreshing = false;
  }
}

function startExpiryInterval(get: () => AuthState): void {
  if (_expiryInterval) clearInterval(_expiryInterval);
  _expiryInterval = setInterval(async () => {
    const ok = await tryProactiveRefresh();
    if (!ok) {
      get().logout();
      if (_navigateFn) _navigateFn('/login');
      return;
    }
    const expired = get().checkExpiry();
    if (expired && _navigateFn) _navigateFn('/login');
  }, EXPIRY_CHECK_MS);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      login(user, token) {
        set({ user, token });
        startExpiryInterval(get);
      },

      logout() {
        set({ user: null, token: null });
        if (_expiryInterval) { clearInterval(_expiryInterval); _expiryInterval = null; }
        // queryClient.clear() is called from App.tsx via a listener
      },

      checkExpiry(): boolean {
        const { token } = get();
        if (!token) return true;
        if (Date.now() >= token.expiresAt) {
          get().logout();
          return true;
        }
        return false;
      },

      updateUser(patch) {
        const { user } = get();
        if (user) set({ user: { ...user, ...patch } });
      },
    }),
    {
      name: 'ppe_auth',
      partialize: (s) => ({ user: s.user, token: s.token }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const { token, logout } = state;
        if (token && Date.now() >= token.expiresAt) {
          logout();
          return;
        }
        if (token) startExpiryInterval(() => useAuthStore.getState());
      },
    }
  )
);

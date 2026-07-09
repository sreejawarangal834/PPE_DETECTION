import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, MockToken } from '../../types';
import { EXPIRY_CHECK_MS } from '../../constants/app';

interface AuthState {
  user: AuthUser | null;
  token: MockToken | null;
  login: (user: AuthUser, token: MockToken) => void;
  logout: () => void;
  checkExpiry: () => boolean;
  updateUser: (patch: Partial<AuthUser>) => void;
}

let _expiryInterval: ReturnType<typeof setInterval> | null = null;
let _navigateFn: ((path: string) => void) | null = null;

export function setNavigate(fn: (path: string) => void): void {
  _navigateFn = fn;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      login(user, token) {
        set({ user, token });
        // Start expiry interval
        if (_expiryInterval) clearInterval(_expiryInterval);
        _expiryInterval = setInterval(() => {
          const expired = get().checkExpiry();
          if (expired && _navigateFn) _navigateFn('/login');
        }, EXPIRY_CHECK_MS);
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
        if (token) {
          if (_expiryInterval) clearInterval(_expiryInterval);
          _expiryInterval = setInterval(() => {
            const expired = state.checkExpiry();
            if (expired && _navigateFn) _navigateFn('/login');
          }, EXPIRY_CHECK_MS);
        }
      },
    }
  )
);

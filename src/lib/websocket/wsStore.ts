import { create } from 'zustand';
import type { WsStatus } from '../../types';

interface WsState {
  status: WsStatus;
  setStatus: (s: WsStatus) => void;
}

export const useWsStore = create<WsState>()((set) => ({
  status: 'disconnected',
  setStatus: (status) => set({ status }),
}));

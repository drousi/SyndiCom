import { create } from 'zustand';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  errorMessage: string | null;

  setStatus: (status: SyncStatus) => void;
  setPendingCount: (count: number) => void;
  setSyncSuccess: () => void;
  setSyncError: (msg: string) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  pendingCount: 0,
  lastSyncedAt: null,
  errorMessage: null,

  setStatus: (status) => set({ status }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setSyncSuccess: () => set({
    status: 'success',
    lastSyncedAt: new Date().toISOString(),
    errorMessage: null,
  }),
  setSyncError: (errorMessage) => set({ status: 'error', errorMessage }),
}));

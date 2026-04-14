import { create } from 'zustand';
import type { User } from '@/db/schema';

interface SessionStore {
  currentUser: User | null;
  isLoading: boolean;
  setUser: (user: User) => void;
  clearUser: () => void;
  setLoadingDone: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  currentUser: null,
  isLoading: true,
  setUser: (user) => set({ currentUser: user, isLoading: false }),
  clearUser: () => set({ currentUser: null, isLoading: false }),
  setLoadingDone: () => set({ isLoading: false }),
}));

import { create } from "zustand";

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  setAuth: (payload) => set(payload),
  clearAuth: () => set({ user: null, token: null }),
}));

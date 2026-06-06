import { create } from "zustand";

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  // true on first load — prevents ProtectedRoute from redirecting before
  // the hydration API call completes
  isHydrating: true,

  // setAuth also marks hydration as done
  setAuth: (payload) => set({ ...payload, isHydrating: false }),

  clearAuth: () => set({ user: null, token: null, isHydrating: false }),
}));

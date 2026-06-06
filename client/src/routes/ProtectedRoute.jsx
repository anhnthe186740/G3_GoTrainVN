import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function ProtectedRoute({ children }) {
  const { user, isHydrating } = useAuthStore();

  // Wait for the hydration API call before deciding to redirect
  if (isHydrating) return null;

  return user ? children : <Navigate to="/login" replace />;
}

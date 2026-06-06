import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function PublicRoute({ children }) {
  const { user, isHydrating } = useAuthStore();

  // While hydrating, show the page (don't redirect away from login/register)
  if (isHydrating) return null;

  return user ? <Navigate to="/dashboard" replace /> : children;
}

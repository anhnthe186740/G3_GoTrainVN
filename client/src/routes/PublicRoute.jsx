import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function PublicRoute({ children }) {
  const token = useAuthStore((state) => state.token);
  return token ? <Navigate to="/dashboard" replace /> : children;
}

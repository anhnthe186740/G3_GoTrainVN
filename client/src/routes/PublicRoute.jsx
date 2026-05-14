import { Navigate } from "react-router-dom";

const isAuthenticated = false;

export function PublicRoute({ children }) {
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

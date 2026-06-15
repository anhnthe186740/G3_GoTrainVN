import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function ProtectedRoute({ children }) {
  const { user, isHydrating } = useAuthStore();

  // Wait for the hydration API call before deciding to redirect
  if (isHydrating) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-primary">
        <span className="material-symbols-outlined text-4xl animate-spin">
          progress_activity
        </span>
        <p className="mt-3 text-sm font-semibold text-slate-500">
          Đang khôi phục phiên đăng nhập...
        </p>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

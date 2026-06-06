import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { PublicRoute } from "./routes/PublicRoute";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { Wallet } from "./pages/Wallet";
import { NotFound } from "./pages/NotFound";
import { useAuthStore } from "./store/authStore";
import { api } from "./services/api";

export default function App() {
  const { setAuth, clearAuth } = useAuthStore();

  // On every page load/refresh, attempt to restore session from the httpOnly
  // cookie. If /users/profile responds successfully, the cookie is still valid
  // and we re-populate the in-memory auth state without asking the user to
  // log in again. On failure (401/network error) we call clearAuth() so
  // ProtectedRoute stops waiting and redirects to /login.
  useEffect(() => {
    api
      .get("/users/profile")
      .then(({ data }) => {
        const u = data.user;
        setAuth({
          user: {
            id: u.id,
            name: u.fullName,
            email: u.email,
            role: u.userType,
          },
          token: "session",
        });
      })
      .catch(() => {
        clearAuth();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Routes>
      <Route
        path="login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="wallet"
          element={
            <ProtectedRoute>
              <Wallet />
            </ProtectedRoute>
          }
        />
        <Route path="home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

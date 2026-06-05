import { useAuth } from "../hooks/useAuth";
import { AdminDashboard } from "../components/dashboard/AdminDashboard";
import { Card } from "../components/ui/Card";

export function Dashboard() {
  const { user } = useAuth();

  if (user?.role === "ADMIN") {
    return <AdminDashboard />;
  }

  return (
    <div className="grid gap-6 p-6">
      <Card>
        <h1 className="text-2xl font-bold">Trang cá nhân khách hàng</h1>
        <p className="mt-2 text-slate-600">
          Chào mừng {user?.fullName || user?.email || "Khách"} quay trở lại. Bạn
          có thể tra cứu vé và lịch trình ở đây.
        </p>
      </Card>
    </div>
  );
}

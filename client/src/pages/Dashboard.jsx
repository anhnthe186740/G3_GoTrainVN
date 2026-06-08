import { useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AdminDashboard } from "../components/dashboard/AdminDashboard";
import { CustomerBooking } from "../components/booking/CustomerBooking";
import { Card } from "../components/ui/Card";

export function Dashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  if (user?.role === "ADMIN") {
    return <AdminDashboard />;
  }

  // Check if we are in the customer booking flow
  const isBookingFlow = searchParams.get("from") && searchParams.get("to");

  if (isBookingFlow) {
    return <CustomerBooking />;
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

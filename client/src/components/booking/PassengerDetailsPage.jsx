import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Clock3, UserRound } from "lucide-react";
import { seatSelectionApi } from "../../services/seatSelectionApi";

export function PassengerDetailsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("sessionId");
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setError("Không tìm thấy phiên giữ ghế.");
      return;
    }
    seatSelectionApi
      .getSession(sessionId)
      .then(({ data }) => {
        if (
          data.session.status !== "ACTIVE" ||
          new Date(data.session.expiresAt).getTime() <= Date.now()
        ) {
          setError("Phiên giữ ghế đã hết hạn. Vui lòng chọn lại ghế.");
          return;
        }
        setSession(data.session);
      })
      .catch((requestError) =>
        setError(
          requestError.response?.data?.message ||
            "Không thể tải thông tin giữ chỗ.",
        ),
      );
  }, [sessionId]);

  const passengers = useMemo(() => {
    if (!session) return [];
    const outbound = session.holds.filter(
      (hold) => hold.scheduleId === session.outboundScheduleId,
    );
    const inbound = session.returnScheduleId
      ? session.holds.filter(
          (hold) => hold.scheduleId === session.returnScheduleId,
        )
      : [];
    return outbound.map((outboundHold, index) => ({
      outbound: outboundHold,
      return: inbound[index] || null,
    }));
  }, [session]);

  if (error) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center">
        <p className="font-bold text-red-600">{error}</p>
      </div>
    );
  }

  if (!session) {
    return <div className="h-72 animate-pulse rounded-3xl bg-white" />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-bold text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại sơ đồ ghế
      </button>

      <header className="rounded-[24px] border border-slate-200 bg-white p-6">
        <p className="font-utility-mono text-[10px] uppercase tracking-[0.18em] text-primary">
          Bước tiếp theo
        </p>
        <h1 className="mt-2 font-headline-md text-2xl font-bold text-slate-900">
          Nhập thông tin hành khách
        </h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <Clock3 className="h-4 w-4" />
          Ghế vẫn được giữ đến{" "}
          {new Date(session.expiresAt).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </header>

      <div className="space-y-4">
        {passengers.map((passenger, index) => (
          <section
            key={passenger.outbound.id}
            className="rounded-[24px] border border-slate-200 bg-white p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">
                    Hành khách {index + 1}
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    Lượt đi: Toa{" "}
                    {passenger.outbound.seat.carriage.carriageNumber} · Ghế{" "}
                    {passenger.outbound.seat.seatNumber}
                    {passenger.return &&
                      ` · Lượt về: Toa ${passenger.return.seat.carriage.carriageNumber} · Ghế ${passenger.return.seat.seatNumber}`}
                  </p>
                </div>
              </div>
              <span className="text-sm font-extrabold text-primary">
                {new Intl.NumberFormat("vi-VN", {
                  style: "currency",
                  currency: "VND",
                  maximumFractionDigits: 0,
                }).format(
                  Number(passenger.outbound.priceSnapshot) +
                    Number(passenger.return?.priceSnapshot || 0),
                )}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-600">
                  Họ và tên
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="Nguyễn Văn A"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-600">
                  Nhóm hành khách
                </span>
                <select className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary">
                  <option>Người lớn</option>
                  <option>Trẻ em</option>
                  <option>Sinh viên</option>
                  <option>Người cao tuổi</option>
                </select>
              </label>
            </div>
          </section>
        ))}
      </div>

      <button
        type="button"
        disabled
        className="w-full rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-500"
      >
        Thanh toán sẽ được triển khai ở bước tiếp theo
      </button>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../services/api";

const STATUS = {
  PENDING: { label: "Chờ duyệt", className: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "Đã duyệt", className: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Đã từ chối", className: "bg-red-100 text-red-700" },
};

function money(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value || 0);
}

function dateTime(value) {
  return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

export function AdminCancellationPanel() {
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/bookings/admin/cancellations", {
        params: status ? { status } : {},
      });
      setRequests(data.requests || []);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Không thể tải yêu cầu hủy vé.",
      );
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const review = async (request, action) => {
    const approving = action === "APPROVE";
    let rejectionReason;
    if (approving) {
      if (
        !window.confirm(
          `Duyệt hủy vé ${request.booking?.bookingCode}? Ghế sẽ được giải phóng và khoản hoàn sẽ được xử lý.`,
        )
      ) {
        return;
      }
    } else {
      rejectionReason = window.prompt("Nhập lý do từ chối yêu cầu:");
      if (rejectionReason === null) return;
      if (!rejectionReason.trim()) {
        toast.error("Vui lòng nhập lý do từ chối.");
        return;
      }
    }

    setProcessingId(request.id);
    try {
      const { data } = await api.patch(
        `/bookings/admin/cancellations/${request.id}`,
        { action, rejectionReason },
      );
      toast.success(data.message);
      fetchRequests();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Không thể xử lý yêu cầu hủy vé.",
      );
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#191c1e]">
            Duyệt Yêu Cầu Hủy Vé
          </h2>
          <p className="mt-1 text-sm text-[#3f4852]">
            Kiểm tra yêu cầu trước khi hủy vé, giải phóng ghế và hoàn tiền.
          </p>
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"
        >
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Đã từ chối</option>
          <option value="">Tất cả</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Đang tải yêu cầu...
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300">
              task_alt
            </span>
            <p className="mt-2 font-semibold text-slate-500">
              Không có yêu cầu phù hợp.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-4">Mã đặt vé</th>
                  <th className="px-5 py-4">Khách hàng</th>
                  <th className="px-5 py-4">Hành trình</th>
                  <th className="px-5 py-4">Yêu cầu</th>
                  <th className="px-5 py-4">Hoàn dự kiến</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((request) => {
                  const booking = request.booking;
                  const statusInfo = STATUS[request.status] || STATUS.PENDING;
                  const customer =
                    booking?.user?.fullName ||
                    request.passenger?.fullName ||
                    "Khách vãng lai";
                  return (
                    <tr
                      key={request.id}
                      className="align-top hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <p className="font-mono font-bold text-[#00629d]">
                          {booking?.bookingCode}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {dateTime(request.createdAt)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">
                          {customer}
                        </p>
                        <p className="text-xs text-slate-500">
                          {booking?.user?.email ||
                            request.passenger?.email ||
                            "—"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        <p className="font-semibold text-slate-800">
                          {booking?.schedule?.startStation?.stationName || "—"}{" "}
                          → {booking?.schedule?.endStation?.stationName || "—"}
                        </p>
                        <p className="mt-1 text-xs">
                          Khởi hành:{" "}
                          {dateTime(booking?.schedule?.departureTime)}
                        </p>
                      </td>
                      <td className="max-w-56 px-5 py-4 text-sm text-slate-600">
                        <p className="line-clamp-2">
                          {request.requestReason || "—"}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          {request.passengerIds?.length || 1} hành khách ·{" "}
                          {request.refundMethod || "WALLET"}
                        </p>
                        {request.rejectionReason && (
                          <p className="mt-2 text-xs font-semibold text-red-600">
                            Lý do: {request.rejectionReason}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-800">
                        {money(request.refundAmount)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {request.status === "PENDING" && (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={processingId === request.id}
                              onClick={() => review(request, "REJECT")}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              Từ chối
                            </button>
                            <button
                              type="button"
                              disabled={processingId === request.id}
                              onClick={() => review(request, "APPROVE")}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {processingId === request.id
                                ? "Đang xử lý..."
                                : "Duyệt"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [audience, setAudience] = useState("REGISTERED");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [reviewDialog, setReviewDialog] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/bookings/admin/cancellations", {
        params: { status: status || undefined, audience },
      });
      setRequests(data.requests || []);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Không thể tải yêu cầu hủy vé.",
      );
    } finally {
      setLoading(false);
    }
  }, [status, audience]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openReviewDialog = (request, action) => {
    setRejectionReason("");
    setReviewDialog({ request, action });
  };

  const review = async () => {
    if (!reviewDialog) return;
    const { request, action } = reviewDialog;
    if (action === "REJECT" && !rejectionReason.trim()) {
      toast.error("Vui lòng nhập lý do từ chối.");
      return;
    }

    setProcessingId(request.id);
    try {
      const { data } = await api.patch(
        `/bookings/admin/cancellations/${request.id}`,
        { action, rejectionReason: rejectionReason.trim() || undefined },
      );
      toast.success(data.message);
      setReviewDialog(null);
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

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setAudience("REGISTERED")}
          className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
            audience === "REGISTERED"
              ? "bg-[#00629d] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          Yêu cầu của khách hàng có tài khoản
        </button>
        <button
          type="button"
          onClick={() => setAudience("GUEST")}
          className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
            audience === "GUEST"
              ? "bg-[#00629d] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          Yêu cầu của khách vãng lai
        </button>
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
                  const isGuestRequest =
                    request.requesterType === "GUEST" ||
                    (!request.requesterType &&
                      (request.refundBankAccount ||
                        request.refundMethod === "BANK_TRANSFER" ||
                        !booking?.userId));
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
                          {booking?.fromStation?.stationName ||
                            booking?.schedule?.startStation?.stationName ||
                            "—"}{" "}
                          →{" "}
                          {booking?.toStation?.stationName ||
                            booking?.schedule?.endStation?.stationName ||
                            "—"}
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
                        {isGuestRequest && (
                          <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-2 text-xs text-blue-800">
                            <p className="font-bold">
                              {request.refundAccountHolder ||
                                "Chưa có tên chủ tài khoản"}
                            </p>
                            <p>
                              {request.refundBankName || "Chưa có ngân hàng"}
                            </p>
                            <p className="font-mono">
                              {request.refundBankAccount ||
                                "Chưa có số tài khoản"}
                            </p>
                          </div>
                        )}
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
                              onClick={() =>
                                openReviewDialog(request, "REJECT")
                              }
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              Từ chối
                            </button>
                            <button
                              type="button"
                              disabled={processingId === request.id}
                              onClick={() =>
                                openReviewDialog(request, "APPROVE")
                              }
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

      {reviewDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-cancellation-title"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              processingId !== reviewDialog.request.id
            ) {
              setReviewDialog(null);
            }
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl">
            <div
              className={
                "flex items-start gap-4 px-6 py-5 " +
                (reviewDialog.action === "APPROVE"
                  ? "bg-emerald-50"
                  : "bg-red-50")
              }
            >
              <div
                className={
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm " +
                  (reviewDialog.action === "APPROVE"
                    ? "bg-emerald-600"
                    : "bg-red-600")
                }
              >
                <span className="material-symbols-outlined text-2xl">
                  {reviewDialog.action === "APPROVE" ? "verified" : "cancel"}
                </span>
              </div>
              <div className="flex-1">
                <h3
                  id="review-cancellation-title"
                  className="text-xl font-black text-slate-900"
                >
                  {reviewDialog.action === "APPROVE"
                    ? "Xác nhận duyệt hủy vé"
                    : "Từ chối yêu cầu hủy vé"}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Mã đặt vé{" "}
                  <span className="font-mono font-bold text-[#00629d]">
                    {reviewDialog.request.booking?.bookingCode}
                  </span>
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                disabled={processingId === reviewDialog.request.id}
                onClick={() => setReviewDialog(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-500 transition hover:bg-white disabled:opacity-50"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">
                    Hành trình
                  </p>
                  <p className="mt-1 font-bold text-slate-800">
                    {reviewDialog.request.booking?.fromStation?.stationName ||
                      reviewDialog.request.booking?.schedule?.startStation
                        ?.stationName ||
                      "—"}{" "}
                    →{" "}
                    {reviewDialog.request.booking?.toStation?.stationName ||
                      reviewDialog.request.booking?.schedule?.endStation
                        ?.stationName ||
                      "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">
                    Tiền hoàn dự kiến
                  </p>
                  <p className="mt-1 text-lg font-black text-emerald-700">
                    {money(reviewDialog.request.refundAmount)}
                  </p>
                </div>
              </div>

              {(reviewDialog.request.requesterType === "GUEST" ||
                (!reviewDialog.request.requesterType &&
                  (reviewDialog.request.refundBankAccount ||
                    reviewDialog.request.refundMethod ===
                      "BANK_TRANSFER"))) && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-blue-600">
                    Tài khoản hoàn tiền khách vãng lai
                  </p>
                  <p className="font-bold">
                    {reviewDialog.request.refundAccountHolder ||
                      "Chưa cung cấp"}
                  </p>
                  <p>{reviewDialog.request.refundBankName || "—"}</p>
                  <p className="font-mono font-bold">
                    {reviewDialog.request.refundBankAccount || "—"}
                  </p>
                </div>
              )}

              {reviewDialog.action === "APPROVE" ? (
                <div className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
                  <span className="material-symbols-outlined shrink-0">
                    warning
                  </span>
                  <p>
                    Sau khi duyệt, vé được chọn sẽ bị hủy, ghế được giải phóng
                    và khoản hoàn tiền được chuyển sang bước xử lý. Thao tác này
                    không thể hoàn tác.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Lý do từ chối <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    autoFocus
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="Nhập lý do để khách hàng biết và bổ sung thông tin..."
                    className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={processingId === reviewDialog.request.id}
                onClick={() => setReviewDialog(null)}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={processingId === reviewDialog.request.id}
                onClick={review}
                className={
                  "flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-sm transition disabled:opacity-50 " +
                  (reviewDialog.action === "APPROVE"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700")
                }
              >
                {processingId === reviewDialog.request.id ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <span className="material-symbols-outlined text-lg">
                    {reviewDialog.action === "APPROVE" ? "check" : "close"}
                  </span>
                )}
                {reviewDialog.action === "APPROVE"
                  ? "Xác nhận duyệt"
                  : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

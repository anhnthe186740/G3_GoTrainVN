import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Wallet, X } from "lucide-react";

export function CancellationPolicyModal({
  open,
  audience = "registered",
  onClose,
  onAccept,
}) {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (open) setAccepted(false);
  }, [open]);

  if (!open) return null;

  const isGuest = audience === "guest";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancellation-policy-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h2
                id="cancellation-policy-title"
                className="text-lg font-black text-slate-800"
              >
                Chính sách hủy vé GoTrain VN
              </h2>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                Vui lòng đọc kỹ trước khi tiếp tục
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng chính sách hủy vé"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5 text-sm text-slate-600">
          <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="mb-2 flex items-center gap-2 font-extrabold text-blue-800">
              <Clock3 className="h-4 w-4" />
              Thời gian và mức hoàn tiền
            </div>
            <ul className="list-disc space-y-1.5 pl-5 leading-relaxed">
              <li>Trước khi thanh toán: được thay đổi hoặc hủy miễn phí.</li>
              <li>Từ 24 giờ trở lên trước giờ tàu chạy: hoàn 80%.</li>
              <li>Từ 4 đến dưới 24 giờ trước giờ tàu chạy: hoàn 50%.</li>
              <li>
                Dưới 4 giờ hoặc tàu đã khởi hành: không thể hủy trực tuyến.
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-2 flex items-center gap-2 font-extrabold text-slate-800">
              <Wallet className="h-4 w-4" />
              Phương thức nhận tiền hoàn
            </div>
            {isGuest ? (
              <p className="leading-relaxed">
                Khách vãng lai cần cung cấp thông tin tài khoản ngân hàng nhận
                tiền. Sau khi Admin duyệt, hệ thống sẽ xử lý chuyển khoản theo
                thông tin đã khai báo.
              </p>
            ) : (
              <p className="leading-relaxed">
                Thành viên gửi yêu cầu trong lịch sử đặt vé; khoản hoàn hợp lệ
                sẽ được chuyển vào ví điện tử GoTrain của tài khoản.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 leading-relaxed text-amber-800">
            Yêu cầu có thể ở trạng thái chờ duyệt, đã duyệt hoặc bị từ chối. Khi
            hủy thành công, ghế sẽ được giải phóng, email thông báo sẽ được gửi
            và thao tác không thể hoàn tác.
          </section>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/30">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
            />
            <span className="font-semibold leading-relaxed text-slate-700">
              Tôi đã đọc, hiểu chính sách hủy vé và đồng ý với mức phí hoàn tiền
              được áp dụng tại thời điểm gửi yêu cầu.
            </span>
          </label>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            Không hủy vé
          </button>
          <button
            type="button"
            disabled={!accepted}
            onClick={onAccept}
            className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4" />
            Tôi đã đọc và tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
}

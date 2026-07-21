import { useState } from "react";
import {
  X,
  Banknote,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { walletApi } from "../../services/walletApi.js";
import { api } from "../../services/api.js";
import { toast } from "sonner";

const fmt = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    n ?? 0,
  );

export function WithdrawModal({ balance = 0, onClose }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState("form"); // form | success

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: () => api.get("/users/profile").then((r) => r.data.user),
  });

  const mutation = useMutation({
    mutationFn: (amt) => walletApi.withdraw(amt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["walletTransactions"] });
      setStep("success");
    },
    onError: (err) => {
      const msg = err.response?.data?.message || "Yêu cầu rút tiền thất bại";
      toast.error(msg);
    },
  });

  const parsedAmount = amount ? parseInt(amount.replace(/\D/g, ""), 10) : 0;
  const isValid =
    parsedAmount >= 50000 &&
    parsedAmount <= balance &&
    parsedAmount % 1000 === 0;

  const handleInput = (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    setAmount(raw ? parseInt(raw, 10).toLocaleString("vi-VN") : "");
  };

  const handleSubmit = () => {
    if (!isValid) return;
    mutation.mutate(parsedAmount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between bg-gradient-to-r from-slate-700 to-slate-800">
          <div className="flex items-center gap-3">
            <Banknote className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-lg">Rút Tiền</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="p-6">
          {step === "success" ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-16 h-16 text-orange-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-on-surface mb-2">
                Yêu cầu đã ghi nhận!
              </h3>
              <p className="text-on-surface-variant text-sm mb-1">
                Yêu cầu rút{" "}
                <span className="font-bold text-orange-600">
                  {fmt(parsedAmount)}
                </span>{" "}
                đang chờ admin duyệt
              </p>
              <p className="text-on-surface-variant text-xs mb-6">
                Thông thường xử lý trong 1–3 ngày làm việc
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition"
              >
                Đóng
              </button>
            </div>
          ) : (
            <>
              {/* Balance display */}
              <div className="flex justify-between items-center p-4 rounded-2xl bg-surface-container mb-5">
                <span className="text-on-surface-variant text-sm">
                  Số dư khả dụng
                </span>
                <span className="font-bold text-primary text-lg">
                  {fmt(balance)}
                </span>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 mb-5">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-amber-700 text-xs leading-relaxed">
                  Yêu cầu rút tiền cần được{" "}
                  <span className="font-semibold">admin phê duyệt</span> trước
                  khi xử lý. Số tiền sẽ bị giữ tạm thời.
                </p>
              </div>

              {/* Bank info display */}
              <div className="mb-5 border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Thông tin nhận tiền
                  </span>
                </div>
                <div className="p-4 bg-white text-sm">
                  {profileLoading ? (
                    <div className="text-center text-slate-400 py-2">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    </div>
                  ) : profileData?.bankAccount ? (
                    <div className="flex flex-col gap-1 text-slate-700">
                      <p>
                        <span className="font-semibold text-slate-500 w-28 inline-block">
                          Ngân hàng:
                        </span>
                        <span className="font-bold">
                          {profileData.bankName}
                        </span>
                      </p>
                      <p>
                        <span className="font-semibold text-slate-500 w-28 inline-block">
                          Số tài khoản:
                        </span>
                        <span className="font-bold">
                          {profileData.bankAccount}
                        </span>
                      </p>
                      <p>
                        <span className="font-semibold text-slate-500 w-28 inline-block">
                          Chủ tài khoản:
                        </span>
                        <span className="font-bold uppercase">
                          {profileData.accountHolder}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-amber-600 mb-2">
                        Chưa cập nhật thông tin ngân hàng
                      </p>
                      <p className="text-xs text-slate-500">
                        Vui lòng cập nhật trong phần{" "}
                        <span className="font-bold">Hồ sơ cá nhân</span> trước
                        khi rút tiền.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount input */}
              <p className="text-sm font-semibold text-on-surface mb-2">
                Số tiền muốn rút
              </p>
              <div className="relative mb-1">
                <input
                  type="text"
                  value={amount}
                  onChange={handleInput}
                  placeholder="Ví dụ: 200,000"
                  className="w-full px-4 py-3 pr-16 border-2 rounded-xl outline-none text-sm font-semibold text-on-surface transition-all focus:border-primary"
                  style={{
                    borderColor:
                      parsedAmount > 0
                        ? parsedAmount > balance
                          ? "#ba1a1a"
                          : isValid
                            ? "#00629d"
                            : "#bec7d4"
                        : "#bec7d4",
                  }}
                  inputMode="numeric"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm font-semibold">
                  VND
                </span>
              </div>

              {parsedAmount > balance && parsedAmount > 0 && (
                <p className="text-xs text-error mb-1">
                  Số tiền vượt quá số dư khả dụng
                </p>
              )}
              {parsedAmount > 0 && parsedAmount < 50000 && (
                <p className="text-xs text-error mb-1">
                  Số tiền rút tối thiểu 50,000 VND
                </p>
              )}
              <p className="text-xs text-on-surface-variant mb-5">
                Tối thiểu 50,000 · Bội số 1,000
              </p>

              <button
                onClick={handleSubmit}
                disabled={
                  !isValid || mutation.isPending || !profileData?.bankAccount
                }
                className="w-full py-3.5 rounded-xl font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ backgroundColor: "#374151" }}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang gửi yêu cầu...
                  </>
                ) : (
                  `Gửi yêu cầu rút ${parsedAmount > 0 ? fmt(parsedAmount) : ""}`
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

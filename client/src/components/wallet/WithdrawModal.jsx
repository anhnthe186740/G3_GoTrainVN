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
import { useLanguage } from "../../context/LanguageContext";

const fmt = (n, language = "vi") =>
  new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: "VND",
  }).format(n ?? 0);

export function WithdrawModal({ balance = 0, onClose }) {
  const { language } = useLanguage();
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
      const msg =
        err.response?.data?.message ||
        (language === "vi"
          ? "Yêu cầu rút tiền thất bại"
          : "Withdrawal request failed");
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
    setAmount(
      raw
        ? parseInt(raw, 10).toLocaleString(
            language === "vi" ? "vi-VN" : "en-US",
          )
        : "",
    );
  };

  const handleSubmit = () => {
    if (!isValid) return;
    mutation.mutate(parsedAmount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden text-left">
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between bg-gradient-to-r from-slate-700 to-slate-800">
          <div className="flex items-center gap-3">
            <Banknote className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-lg">
              {language === "vi" ? "Rút Tiền" : "Withdraw Money"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors border-none cursor-pointer"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="p-6">
          {step === "success" ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-16 h-16 text-orange-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-on-surface mb-2">
                {language === "vi"
                  ? "Yêu cầu đã ghi nhận!"
                  : "Request recorded!"}
              </h3>
              <p className="text-on-surface-variant text-sm mb-1">
                {language === "vi" ? "Yêu cầu rút " : "Withdrawal request of "}
                <span className="font-bold text-orange-600">
                  {fmt(parsedAmount, language)}
                </span>{" "}
                {language === "vi"
                  ? "đang chờ admin duyệt"
                  : "is pending admin approval"}
              </p>
              <p className="text-on-surface-variant text-xs mb-6">
                {language === "vi"
                  ? "Thông thường xử lý trong 1–3 ngày làm việc"
                  : "Usually processed within 1–3 business days"}
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition border-none cursor-pointer"
              >
                {language === "vi" ? "Đóng" : "Close"}
              </button>
            </div>
          ) : (
            <>
              {/* Balance display */}
              <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-100 mb-5 text-left">
                <span className="text-on-surface-variant text-sm">
                  {language === "vi" ? "Số dư khả dụng" : "Available balance"}
                </span>
                <span className="font-bold text-primary text-lg">
                  {fmt(balance, language)}
                </span>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 mb-5 text-left">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-amber-700 text-xs leading-relaxed mb-0">
                  {language === "vi"
                    ? "Yêu cầu rút tiền cần được admin phê duyệt trước khi xử lý. Số tiền sẽ bị giữ tạm thời."
                    : "Withdrawal requests must be approved by an admin. The amount will be temporarily on hold."}
                </p>
              </div>

              {/* Bank info display */}
              <div className="mb-5 border border-slate-200 rounded-xl overflow-hidden text-left">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {language === "vi"
                      ? "Thông tin nhận tiền"
                      : "Payout Details"}
                  </span>
                </div>
                <div className="p-4 bg-white text-sm">
                  {profileLoading ? (
                    <div className="text-center text-slate-400 py-2">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    </div>
                  ) : profileData?.bankAccount ? (
                    <div className="flex flex-col gap-1 text-slate-700">
                      <p className="mb-1">
                        <span className="font-semibold text-slate-500 w-28 inline-block">
                          {language === "vi" ? "Ngân hàng:" : "Bank:"}
                        </span>
                        <span className="font-bold">
                          {profileData.bankName}
                        </span>
                      </p>
                      <p className="mb-1">
                        <span className="font-semibold text-slate-500 w-28 inline-block">
                          {language === "vi"
                            ? "Số tài khoản:"
                            : "Account Number:"}
                        </span>
                        <span className="font-bold">
                          {profileData.bankAccount}
                        </span>
                      </p>
                      <p className="mb-0">
                        <span className="font-semibold text-slate-500 w-28 inline-block">
                          {language === "vi"
                            ? "Chủ tài khoản:"
                            : "Account Owner:"}
                        </span>
                        <span className="font-bold uppercase">
                          {profileData.accountHolder}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-amber-600 mb-2 font-bold">
                        {language === "vi"
                          ? "Chưa cập nhật thông tin ngân hàng"
                          : "Bank account details not updated"}
                      </p>
                      <p className="text-xs text-slate-500 mb-0">
                        {language === "vi"
                          ? "Vui lòng cập nhật trong phần Hồ sơ cá nhân trước khi rút tiền."
                          : "Please update in your profile details before withdrawing."}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount input */}
              <p className="text-sm font-semibold text-on-surface mb-2">
                {language === "vi" ? "Số tiền muốn rút" : "Amount to withdraw"}
              </p>
              <div className="relative mb-1">
                <input
                  type="text"
                  value={amount}
                  onChange={handleInput}
                  placeholder={
                    language === "vi" ? "Ví dụ: 200,000" : "Example: 200,000"
                  }
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
                <p className="text-xs text-red-600 mb-1 text-left">
                  {language === "vi"
                    ? "Số tiền vượt quá số dư khả dụng"
                    : "Amount exceeds available balance"}
                </p>
              )}
              {parsedAmount > 0 && parsedAmount < 50000 && (
                <p className="text-xs text-red-600 mb-1 text-left">
                  {language === "vi"
                    ? "Số tiền rút tối thiểu 50,000 VND"
                    : "Minimum withdrawal amount is 50,000 VND"}
                </p>
              )}
              <p className="text-xs text-on-surface-variant mb-5 text-left">
                {language === "vi"
                  ? "Tối thiểu 50,000 · Bội số 1,000"
                  : "Min 50,000 · Multiple of 1,000"}
              </p>

              <button
                onClick={handleSubmit}
                disabled={
                  !isValid || mutation.isPending || !profileData?.bankAccount
                }
                className="w-full py-3.5 rounded-xl font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 border-none cursor-pointer"
                style={{ backgroundColor: "#374151" }}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    {language === "vi"
                      ? "Đang gửi yêu cầu..."
                      : "Submitting request..."}
                  </>
                ) : (
                  (language === "vi"
                    ? "Gửi yêu cầu rút "
                    : "Submit withdrawal request ") +
                  (parsedAmount > 0 ? fmt(parsedAmount, language) : "")
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

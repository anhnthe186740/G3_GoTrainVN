import { useState } from "react";
import { X, CreditCard, Loader2, CheckCircle2, Zap } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { walletApi } from "../../services/walletApi.js";
import { toast } from "sonner";

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];

const fmt = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    n,
  );

export function DepositModal({ onClose }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState("form"); // form | confirm | processing | success

  const mutation = useMutation({
    mutationFn: (amt) => walletApi.deposit(amt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["walletTransactions"] });
      setStep("success");
    },
    onError: (err) => {
      const msg =
        err.response?.data?.message || "Nạp tiền thất bại, thử lại sau";
      toast.error(msg);
      setStep("form");
    },
  });

  const parsedAmount =
    selected ?? (amount ? parseInt(amount.replace(/\D/g, ""), 10) : 0);
  const isValid =
    parsedAmount >= 10000 &&
    parsedAmount <= 50000000 &&
    parsedAmount % 1000 === 0;

  const handleQuick = (val) => {
    setSelected(val);
    setAmount(val.toLocaleString("vi-VN"));
  };

  const handleInput = (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    setSelected(null);
    setAmount(raw ? parseInt(raw, 10).toLocaleString("vi-VN") : "");
  };

  const handleSubmit = () => {
    if (!isValid) return;
    setStep("processing");
    // Simulate mock payment gateway delay (1.5s)
    setTimeout(() => mutation.mutate(parsedAmount), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #003d66, #00629d)" }}
        >
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-lg">
              Nạp Tiền Vào Ví
            </span>
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
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-on-surface mb-2">
                Nạp tiền thành công!
              </h3>
              <p className="text-on-surface-variant text-sm mb-1">
                Đã cộng{" "}
                <span className="font-bold text-green-600">
                  {fmt(parsedAmount)}
                </span>{" "}
                vào ví
              </p>
              <p className="text-on-surface-variant text-xs mb-6">
                Số dư đã được cập nhật
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition"
              >
                Đóng
              </button>
            </div>
          ) : step === "processing" ? (
            <div className="text-center py-10">
              <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
              <p className="font-semibold text-on-surface mb-1">
                Đang xử lý thanh toán...
              </p>
              <p className="text-on-surface-variant text-sm">
                Mock Payment Gateway đang xác nhận
              </p>
            </div>
          ) : (
            <>
              {/* Mock gateway notice */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100 mb-5">
                <Zap className="w-4 h-4 text-blue-500 shrink-0" />
                <p className="text-blue-700 text-xs">
                  <span className="font-semibold">Mock Payment Gateway</span> —
                  Môi trường kiểm thử, không trừ tiền thật
                </p>
              </div>

              {/* Quick amounts */}
              <p className="text-sm font-semibold text-on-surface mb-3">
                Chọn nhanh
              </p>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {QUICK_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    onClick={() => handleQuick(val)}
                    className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      selected === val
                        ? "border-primary bg-primary/8 text-primary"
                        : "border-outline-variant text-on-surface-variant hover:border-primary/50 hover:text-primary"
                    }`}
                    style={
                      selected === val
                        ? { backgroundColor: "rgba(0,98,157,0.08)" }
                        : {}
                    }
                  >
                    {val >= 1000000 ? `${val / 1000000}M` : `${val / 1000}K`}
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <p className="text-sm font-semibold text-on-surface mb-2">
                Nhập số tiền
              </p>
              <div className="relative mb-1">
                <input
                  type="text"
                  value={amount}
                  onChange={handleInput}
                  placeholder="Ví dụ: 500,000"
                  className="w-full px-4 py-3 pr-16 border-2 rounded-xl outline-none text-sm font-semibold text-on-surface transition-all focus:border-primary"
                  style={{
                    borderColor:
                      isValid && parsedAmount > 0 ? "#00629d" : "#bec7d4",
                  }}
                  inputMode="numeric"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm font-semibold">
                  VND
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mb-5">
                Tối thiểu 10,000 · Tối đa 50,000,000 · Bội số 1,000
              </p>

              {parsedAmount > 0 && (
                <div className="flex justify-between items-center p-3 rounded-xl bg-surface-container mb-5 text-sm">
                  <span className="text-on-surface-variant">Số tiền nạp</span>
                  <span className="font-bold text-primary">
                    {fmt(parsedAmount)}
                  </span>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!isValid}
                className="w-full py-3.5 rounded-xl font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: isValid
                    ? "linear-gradient(135deg, #00629d, #0086cc)"
                    : undefined,
                  backgroundColor: isValid ? undefined : "#bec7d4",
                }}
              >
                Xác nhận nạp {parsedAmount > 0 ? fmt(parsedAmount) : ""}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

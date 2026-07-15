import { useState, useEffect, useRef } from "react";
import {
  X,
  CreditCard,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { walletApi } from "../../services/walletApi.js";
import { toast } from "sonner";

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];

const fmt = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    n,
  );

const BANK_BINS = {
  970415: "VietinBank",
  970436: "Vietcombank",
  970422: "MBBank",
  970418: "BIDV",
  970405: "Agribank",
  970407: "Techcombank",
  970416: "ACB",
  970432: "VPBank",
  970403: "Sacombank",
  970423: "TPBank",
  970437: "HDBank",
  970441: "VIB",
  970429: "SCB",
  970443: "SHB",
  970428: "Nam A Bank",
  970454: "VietCapitalBank",
};

const getBankNameByBin = (bin) => {
  return BANK_BINS[bin] || `Ngân hàng (BIN: ${bin})`;
};

export function DepositModal({ onClose }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState("checking"); // checking | form | creating | qr | success | expired

  // PayOS checkout and transaction details
  const [transaction, setTransaction] = useState(null);
  const [payosData, setPayosData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);

  const pollingIntervalRef = useRef(null);

  // Check for any existing pending deposit on mount (resume flow)
  useEffect(() => {
    walletApi
      .pendingDeposit()
      .then((res) => {
        const txn = res.data?.transaction;
        if (txn) {
          setTransaction(txn);
          setPayosData(
            txn.payos || {
              checkoutUrl: txn.payosCheckoutUrl,
              qrCode: txn.payosQrCode,
              orderCode: txn.payosOrderCode,
              amount: txn.amount,
              description: `NAP${String(txn.payosOrderCode).slice(-7)}`,
              accountNumber: txn.payosAccountNumber,
              accountName: txn.payosAccountName,
              bin: txn.payosBin,
            },
          );
          const expiresAt = new Date(txn.expiresAt).getTime();
          const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
          if (diff > 0) {
            setTimeLeft(diff);
            setStep("qr");
            toast.info("Đang hiển thị lại yêu cầu nạp tiền chưa hoàn tất.");
          } else {
            setStep("form");
          }
        } else {
          setStep("form");
        }
      })
      .catch((err) => {
        console.error("Failed to fetch pending deposit:", err);
        setStep("form");
      });

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Poll status when in "qr" step
  useEffect(() => {
    if (step !== "qr" || !transaction?.id) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    const checkStatus = async (isManual = false) => {
      try {
        const statusRes = await walletApi.depositStatus(transaction.id);
        const currentTxn = statusRes.data?.transaction;
        if (currentTxn?.status === "COMPLETED") {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          queryClient.invalidateQueries({ queryKey: ["wallet"] });
          queryClient.invalidateQueries({ queryKey: ["walletTransactions"] });
          setStep("success");
          if (isManual) {
            toast.success("Xác nhận thanh toán thành công!");
          }
        } else if (currentTxn?.status === "FAILED") {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setStep("expired");
        } else if (isManual) {
          toast.info("Giao dịch vẫn đang chờ thanh toán.");
        }
      } catch (err) {
        console.error("Polling error:", err);
        // Silently ignore network failures to keep polling alive
      }
    };

    // Initial check
    checkStatus();

    // Start interval
    pollingIntervalRef.current = setInterval(() => checkStatus(false), 4000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [step, transaction?.id, queryClient]);

  // Countdown timer for expiration
  useEffect(() => {
    if (step !== "qr" || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setStep("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step, timeLeft]);

  // Deposit mutation
  const depositMutation = useMutation({
    mutationFn: (amt) => walletApi.deposit(amt),
    onSuccess: (res) => {
      const data = res.data;
      setTransaction(data.transaction);
      setPayosData(data.payos);
      const expiresAt = new Date(data.paymentExpiresAt).getTime();
      setTimeLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
      setStep("qr");
    },
    onError: (err) => {
      const msg =
        err.response?.data?.message ||
        "Tạo yêu cầu nạp tiền thất bại. Vui lòng thử lại.";
      toast.error(msg);
      // If user already has a pending deposit, direct them to resume it by checking pending status again
      if (err.response?.status === 409) {
        setStep("checking");
        walletApi
          .pendingDeposit()
          .then((res) => {
            const txn = res.data?.transaction;
            if (txn) {
              setTransaction(txn);
              setPayosData({
                checkoutUrl: txn.payosCheckoutUrl,
                qrCode: txn.payosQrCode,
                orderCode: txn.payosOrderCode,
                amount: txn.amount,
              });
              const expiresAt = new Date(txn.expiresAt).getTime();
              setTimeLeft(
                Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
              );
              setStep("qr");
            } else {
              setStep("form");
            }
          })
          .catch(() => setStep("form"));
      } else {
        setStep("form");
      }
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
    setStep("creating");
    depositMutation.mutate(parsedAmount);
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining.toString().padStart(2, "0")}`;
  };

  const handleManualCheck = async () => {
    if (!transaction?.id) return;
    try {
      const statusRes = await walletApi.depositStatus(transaction.id);
      const currentTxn = statusRes.data?.transaction;
      if (currentTxn?.status === "COMPLETED") {
        queryClient.invalidateQueries({ queryKey: ["wallet"] });
        queryClient.invalidateQueries({ queryKey: ["walletTransactions"] });
        setStep("success");
        toast.success("Xác nhận thanh toán thành công!");
      } else {
        toast.info(
          "Giao dịch vẫn đang chờ thanh toán. Vui lòng hoàn thành chuyển khoản hoặc đợi hệ thống xử lý.",
        );
      }
    } catch (err) {
      toast.error("Không thể kết nối máy chủ để kiểm tra.");
    }
  };

  const handleCancelDeposit = async () => {
    if (!transaction?.id) return;
    setIsCancelling(true);
    try {
      await walletApi.cancelDeposit(transaction.id);
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["walletTransactions"] });
      setTransaction(null);
      setPayosData(null);
      setAmount("");
      setSelected(null);
      setStep("form");
      toast.success("Đã hủy yêu cầu nạp tiền.");
    } catch (err) {
      console.error("Cancel deposit error:", err);
      toast.error("Không thể hủy yêu cầu nạp tiền lúc này.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transition-all duration-300">
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
          {step === "checking" ? (
            <div className="text-center py-10">
              <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
              <p className="font-semibold text-on-surface mb-1">
                Đang kiểm tra giao dịch trước đó...
              </p>
            </div>
          ) : step === "creating" ? (
            <div className="text-center py-10">
              <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
              <p className="font-semibold text-on-surface mb-1">
                Đang tạo mã thanh toán QR...
              </p>
              <p className="text-on-surface-variant text-sm">
                Vui lòng đợi trong giây lát
              </p>
            </div>
          ) : step === "success" ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4 animate-bounce" />
              <h3 className="text-xl font-bold text-on-surface mb-2">
                Nạp tiền thành công!
              </h3>
              <p className="text-on-surface-variant text-sm mb-1">
                Đã cộng{" "}
                <span className="font-bold text-green-600">
                  {fmt(
                    payosData?.amount || transaction?.amount || parsedAmount,
                  )}
                </span>{" "}
                vào ví
              </p>
              <p className="text-on-surface-variant text-xs mb-6">
                Số dư ví của bạn đã được cập nhật thành công.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition shadow-md"
              >
                Đóng
              </button>
            </div>
          ) : step === "expired" ? (
            <div className="text-center py-6">
              <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-on-surface mb-2">
                Lệnh thanh toán đã hết hạn
              </h3>
              <p className="text-on-surface-variant text-sm mb-6">
                Mỗi mã thanh toán chỉ có hiệu lực trong 15 phút. Vui lòng tạo
                yêu cầu mới.
              </p>
              <button
                onClick={() => setStep("form")}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition"
              >
                Tạo yêu cầu mới
              </button>
            </div>
          ) : step === "qr" && payosData ? (
            <div className="flex flex-col items-center">
              {/* PayOS QR Instruction */}
              <div className="text-center w-full mb-4">
                <span className="inline-block px-3 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full mb-2">
                  Thời gian thanh toán còn lại: {formatTime(timeLeft)}
                </span>
                <p className="text-sm font-semibold text-on-surface">
                  Quét mã QR dưới đây bằng app Ngân hàng để thanh toán
                </p>
              </div>

              {/* QR Container */}
              <div className="p-4 bg-white border border-[#bec7d4]/40 rounded-2xl shadow-sm mb-4">
                <QRCodeSVG value={payosData.qrCode} size={180} />
              </div>

              {/* Bank Account Info */}
              {payosData.accountNumber && (
                <div className="w-full bg-[#f7f9fb] border border-[#bec7d4]/20 rounded-2xl p-4 text-sm mb-3 space-y-2">
                  <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                    Thông tin chuyển khoản thủ công
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">Ngân hàng:</span>
                    <span className="font-semibold text-on-surface">
                      {getBankNameByBin(payosData.bin)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">
                      Số tài khoản:
                    </span>
                    <span className="font-mono font-bold text-on-surface select-all bg-white px-2 py-0.5 border border-[#bec7d4]/50 rounded">
                      {payosData.accountNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">
                      Chủ tài khoản:
                    </span>
                    <span className="font-semibold text-on-surface uppercase">
                      {payosData.accountName}
                    </span>
                  </div>
                </div>
              )}

              {/* Details card */}
              <div className="w-full bg-[#f7f9fb] border border-[#bec7d4]/20 rounded-2xl p-4 text-sm mb-5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Số tiền nạp:</span>
                  <span className="font-bold text-primary text-base">
                    {fmt(
                      payosData?.amount || transaction?.amount || parsedAmount,
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">
                    Nội dung chuyển khoản:
                  </span>
                  <span className="font-mono font-bold text-on-surface select-all bg-white px-2 py-0.5 border border-dashed border-[#bec7d4] rounded animate-pulse">
                    {payosData.description}
                  </span>
                </div>
                <div className="text-xs text-amber-600 text-center font-semibold pt-1">
                  * Vui lòng điền đúng nội dung và số tiền trên để giao dịch tự
                  động thành công.
                </div>
              </div>

              {/* Action buttons */}
              <div className="w-full space-y-2">
                <a
                  href={payosData.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/95 transition shadow-sm"
                >
                  Mở cổng thanh toán PayOS
                  <ExternalLink className="w-4 h-4" />
                </a>

                <div className="flex gap-2">
                  <button
                    onClick={handleManualCheck}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-[#bec7d4] text-on-surface font-semibold rounded-xl hover:bg-slate-50 transition"
                  >
                    <RefreshCw className="w-4 h-4 text-on-surface-variant" />
                    Kiểm tra trạng thái
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 bg-slate-100 text-on-surface-variant font-semibold rounded-xl hover:bg-slate-200 transition"
                  >
                    Đóng tạm
                  </button>
                </div>

                <button
                  onClick={handleCancelDeposit}
                  disabled={isCancelling}
                  className="w-full py-2.5 bg-red-50 border border-red-200 text-red-600 font-semibold rounded-xl hover:bg-red-100 transition flex items-center justify-center gap-2"
                >
                  {isCancelling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Hủy yêu cầu nạp này"
                  )}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Form Input Step */}
              <p className="text-sm font-semibold text-on-surface mb-3">
                Chọn nhanh số tiền nạp
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

              <p className="text-sm font-semibold text-on-surface mb-2">
                Hoặc nhập số tiền khác
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
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 mb-5 text-sm border border-[#bec7d4]/20">
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

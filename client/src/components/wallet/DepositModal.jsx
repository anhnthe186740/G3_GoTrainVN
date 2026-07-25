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
import { useLanguage } from "../../context/LanguageContext";

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];

const fmt = (n, language = "vi") =>
  new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: "VND",
  }).format(n);

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

const getBankNameByBin = (bin, language = "vi") => {
  return (
    BANK_BINS[bin] ||
    (language === "vi" ? `Ngân hàng (BIN: ${bin})` : `Bank (BIN: ${bin})`)
  );
};

export function DepositModal({ onClose }) {
  const { language } = useLanguage();
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
            toast.info(
              language === "vi"
                ? "Đang hiển thị lại yêu cầu nạp tiền chưa hoàn tất."
                : "Resuming incomplete deposit request.",
            );
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
  }, [language]);

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
            toast.success(
              language === "vi"
                ? "Xác nhận thanh toán thành công!"
                : "Payment confirmed successfully!",
            );
          }
        } else if (currentTxn?.status === "FAILED") {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setStep("expired");
        } else if (isManual) {
          toast.info(
            language === "vi"
              ? "Giao dịch vẫn đang chờ thanh toán."
              : "Transaction is pending payment.",
          );
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
  }, [step, transaction?.id, queryClient, language]);

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
        (language === "vi"
          ? "Tạo yêu cầu nạp tiền thất bại. Vui lòng thử lại."
          : "Failed to create deposit request. Please try again.");
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
    setAmount(val.toLocaleString(language === "vi" ? "vi-VN" : "en-US"));
  };

  const handleInput = (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    setSelected(null);
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
        toast.success(
          language === "vi"
            ? "Xác nhận thanh toán thành công!"
            : "Payment confirmed successfully!",
        );
      } else {
        toast.info(
          language === "vi"
            ? "Giao dịch vẫn đang chờ thanh toán. Vui lòng hoàn thành chuyển khoản hoặc đợi hệ thống xử lý."
            : "Transaction is pending payment. Please complete transfer or wait for processing.",
        );
      }
    } catch (err) {
      toast.error(
        language === "vi"
          ? "Không thể kết nối máy chủ để kiểm tra."
          : "Unable to connect to the server for status check.",
      );
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
      toast.success(
        language === "vi"
          ? "Đã hủy yêu cầu nạp tiền."
          : "Deposit request cancelled.",
      );
    } catch (err) {
      console.error("Cancel deposit error:", err);
      toast.error(
        language === "vi"
          ? "Không thể hủy yêu cầu nạp tiền lúc này."
          : "Cannot cancel deposit request at this time.",
      );
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
              {language === "vi"
                ? "Nạp Tiền Vào Ví"
                : "Deposit Money to Wallet"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors border-none cursor-pointer"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="p-6 text-left">
          {step === "checking" ? (
            <div className="text-center py-10">
              <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
              <p className="font-semibold text-on-surface mb-1">
                {language === "vi"
                  ? "Đang kiểm tra giao dịch trước đó..."
                  : "Checking previous transaction..."}
              </p>
            </div>
          ) : step === "creating" ? (
            <div className="text-center py-10">
              <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
              <p className="font-semibold text-on-surface mb-1">
                {language === "vi"
                  ? "Đang tạo mã thanh toán QR..."
                  : "Generating payment QR code..."}
              </p>
              <p className="text-on-surface-variant text-sm">
                {language === "vi"
                  ? "Vui lòng đợi trong giây lát"
                  : "Please wait a moment"}
              </p>
            </div>
          ) : step === "success" ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4 animate-bounce" />
              <h3 className="text-xl font-bold text-on-surface mb-2">
                {language === "vi"
                  ? "Nạp tiền thành công!"
                  : "Deposit Successful!"}
              </h3>
              <p className="text-on-surface-variant text-sm mb-1">
                {language === "vi" ? "Đã cộng" : "Added"}{" "}
                <span className="font-bold text-green-600">
                  {fmt(
                    payosData?.amount || transaction?.amount || parsedAmount,
                    language,
                  )}
                </span>{" "}
                {language === "vi" ? "vào ví" : "to wallet"}
              </p>
              <p className="text-on-surface-variant text-xs mb-6">
                {language === "vi"
                  ? "Số dư ví của bạn đã được cập nhật thành công."
                  : "Your wallet balance has been successfully updated."}
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition shadow-md border-none cursor-pointer"
              >
                {language === "vi" ? "Đóng" : "Close"}
              </button>
            </div>
          ) : step === "expired" ? (
            <div className="text-center py-6">
              <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-on-surface mb-2">
                {language === "vi"
                  ? "Lệnh thanh toán đã hết hạn"
                  : "Payment order expired"}
              </h3>
              <p className="text-on-surface-variant text-sm mb-6">
                {language === "vi"
                  ? "Mỗi mã thanh toán chỉ có hiệu lực trong 15 phút. Vui lòng tạo yêu cầu mới."
                  : "Each payment code is only valid for 15 minutes. Please create a new request."}
              </p>
              <button
                onClick={() => setStep("form")}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition border-none cursor-pointer"
              >
                {language === "vi" ? "Tạo yêu cầu mới" : "Create new request"}
              </button>
            </div>
          ) : step === "qr" && payosData ? (
            <div className="flex flex-col items-center">
              {/* PayOS QR Instruction */}
              <div className="text-center w-full mb-4">
                <span className="inline-block px-3 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full mb-2">
                  {language === "vi"
                    ? "Thời gian thanh toán còn lại: "
                    : "Payment time remaining: "}
                  {formatTime(timeLeft)}
                </span>
                <p className="text-sm font-semibold text-on-surface">
                  {language === "vi"
                    ? "Quét mã QR dưới đây bằng app Ngân hàng để thanh toán"
                    : "Scan the QR code below using your mobile banking app"}
                </p>
              </div>

              {/* QR Container */}
              <div className="p-4 bg-white border border-[#bec7d4]/40 rounded-2xl shadow-sm mb-4">
                <QRCodeSVG value={payosData.qrCode} size={180} />
              </div>

              {/* Bank Account Info */}
              {payosData.accountNumber && (
                <div className="w-full bg-[#f7f9fb] border border-[#bec7d4]/20 rounded-2xl p-4 text-sm mb-3 space-y-2 text-left">
                  <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                    {language === "vi"
                      ? "Thông tin chuyển khoản thủ công"
                      : "Manual Transfer Details"}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">
                      {language === "vi" ? "Ngân hàng:" : "Bank:"}
                    </span>
                    <span className="font-semibold text-on-surface">
                      {getBankNameByBin(payosData.bin, language)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">
                      {language === "vi" ? "Số tài khoản:" : "Account Number:"}
                    </span>
                    <span className="font-mono font-bold text-on-surface select-all bg-white px-2 py-0.5 border border-[#bec7d4]/50 rounded">
                      {payosData.accountNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">
                      {language === "vi" ? "Chủ tài khoản:" : "Account Owner:"}
                    </span>
                    <span className="font-semibold text-on-surface uppercase">
                      {payosData.accountName}
                    </span>
                  </div>
                </div>
              )}

              {/* Details card */}
              <div className="w-full bg-[#f7f9fb] border border-[#bec7d4]/20 rounded-2xl p-4 text-sm mb-5 space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">
                    {language === "vi" ? "Số tiền nạp:" : "Amount:"}
                  </span>
                  <span className="font-bold text-primary text-base">
                    {fmt(
                      payosData?.amount || transaction?.amount || parsedAmount,
                      language,
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">
                    {language === "vi"
                      ? "Nội dung chuyển khoản:"
                      : "Transfer Description:"}
                  </span>
                  <span className="font-mono font-bold text-on-surface select-all bg-white px-2 py-0.5 border border-dashed border-[#bec7d4] rounded animate-pulse">
                    {payosData.description}
                  </span>
                </div>
                <div className="text-xs text-amber-600 text-center font-semibold pt-1">
                  {language === "vi"
                    ? "* Vui lòng điền đúng nội dung và số tiền trên để giao dịch tự động thành công."
                    : "* Please input the correct description and amount for automatic payment confirmation."}
                </div>
              </div>

              {/* Action buttons */}
              <div className="w-full space-y-2">
                <a
                  href={payosData.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/95 transition shadow-sm text-decoration-none"
                >
                  {language === "vi"
                    ? "Mở cổng thanh toán PayOS"
                    : "Open PayOS Gateway"}
                  <ExternalLink className="w-4 h-4 text-white" />
                </a>

                <div className="flex gap-2">
                  <button
                    onClick={handleManualCheck}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-[#bec7d4] text-on-surface font-semibold rounded-xl hover:bg-slate-50 transition cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 text-on-surface-variant" />
                    {language === "vi" ? "Kiểm tra trạng thái" : "Check status"}
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 bg-slate-100 text-on-surface-variant font-semibold rounded-xl hover:bg-slate-200 transition cursor-pointer border-none"
                  >
                    {language === "vi" ? "Đóng tạm" : "Close"}
                  </button>
                </div>

                <button
                  onClick={handleCancelDeposit}
                  disabled={isCancelling}
                  className="w-full py-2.5 bg-red-50 border border-red-200 text-red-600 font-semibold rounded-xl hover:bg-red-100 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isCancelling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : language === "vi" ? (
                    "Hủy yêu cầu nạp này"
                  ) : (
                    "Cancel this deposit request"
                  )}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Form Input Step */}
              <p className="text-sm font-semibold text-on-surface mb-3">
                {language === "vi"
                  ? "Chọn nhanh số tiền nạp"
                  : "Quick deposit amounts"}
              </p>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {QUICK_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    onClick={() => handleQuick(val)}
                    className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer ${
                      selected === val
                        ? "border-primary bg-primary/8 text-primary"
                        : "border-outline-variant text-on-surface-variant hover:border-primary/50 hover:text-primary bg-transparent"
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
                {language === "vi"
                  ? "Hoặc nhập số tiền khác"
                  : "Or enter another amount"}
              </p>
              <div className="relative mb-1">
                <input
                  type="text"
                  value={amount}
                  onChange={handleInput}
                  placeholder={
                    language === "vi" ? "Ví dụ: 500,000" : "Example: 500,000"
                  }
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
                {language === "vi"
                  ? "Tối thiểu 10,000 · Tối đa 50,000,000 · Bội số 1,000"
                  : "Min 10,000 · Max 50,000,000 · Multiple of 1,000"}
              </p>

              {parsedAmount > 0 && (
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 mb-5 text-sm border border-[#bec7d4]/20 text-left">
                  <span className="text-on-surface-variant">
                    {language === "vi" ? "Số tiền nạp" : "Deposit amount"}
                  </span>
                  <span className="font-bold text-primary">
                    {fmt(parsedAmount, language)}
                  </span>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!isValid}
                className="w-full py-3.5 rounded-xl font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] border-none cursor-pointer"
                style={{
                  background: isValid
                    ? "linear-gradient(135deg, #00629d, #0086cc)"
                    : undefined,
                  backgroundColor: isValid ? undefined : "#bec7d4",
                }}
              >
                {language === "vi" ? "Xác nhận nạp " : "Confirm Deposit "}
                {parsedAmount > 0 ? fmt(parsedAmount, language) : ""}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

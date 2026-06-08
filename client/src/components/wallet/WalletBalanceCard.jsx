import { Wallet, ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    n ?? 0,
  );

export function WalletBalanceCard({
  balance,
  currency = "VND",
  updatedAt,
  onDeposit,
  onWithdraw,
  onRefresh,
  isLoading,
}) {
  if (isLoading) {
    return (
      <div className="rounded-3xl p-8 animate-pulse bg-gradient-to-br from-[#003d66] via-[#00629d] to-[#0086cc] h-52" />
    );
  }

  return (
    <div
      className="relative rounded-3xl p-6 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #003d66 0%, #00629d 50%, #0086cc 100%)",
        boxShadow: "0 20px 60px rgba(0,98,157,0.35)",
      }}
    >
      {/* Decorative circles */}
      <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
      <div className="absolute -bottom-16 -left-8 w-56 h-56 rounded-full bg-white/5" />
      <div className="absolute top-1/2 right-16 w-24 h-24 rounded-full bg-white/5" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white/70 text-xs font-semibold tracking-widest uppercase">
              Ví GoTrain VN
            </p>
            <p className="text-white/50 text-[11px]">
              Cập nhật:{" "}
              {updatedAt
                ? new Date(updatedAt).toLocaleString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                  })
                : "—"}
            </p>
          </div>
        </div>

        {/* Balance */}
        <div className="mb-6">
          <p className="text-white/60 text-sm mb-1">Số dư hiện tại</p>
          <p
            className="text-white font-bold tracking-tight"
            style={{ fontSize: "2rem", lineHeight: 1.15 }}
          >
            {fmt(balance)}
          </p>
        </div>

        {/* Actions — two primary buttons + refresh icon at end */}
        <div className="flex items-center gap-2">
          <button
            onClick={onDeposit}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ background: "white", color: "#00629d" }}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Nạp tiền
          </button>
          <button
            onClick={onWithdraw}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm border-2 border-white/70 text-white hover:bg-white/10 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Rút tiền
          </button>
          <button
            onClick={onRefresh}
            className="ml-auto w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 transition-all active:scale-95"
            title="Làm mới"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

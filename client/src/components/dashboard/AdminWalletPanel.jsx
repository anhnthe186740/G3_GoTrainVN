import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { walletApi } from "../../services/walletApi.js";
import { toast } from "sonner";

const fmt = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    n ?? 0,
  );

const TYPE_META = {
  DEPOSIT: {
    label: "Nạp tiền",
    icon: "arrow_downward",
    badge: "bg-green-100 text-green-700",
    amountColor: "text-green-600",
    prefix: "+",
  },
  PAYMENT: {
    label: "Thanh toán",
    icon: "arrow_upward",
    badge: "bg-[#d3e2ed]/60 text-[#526069]",
    amountColor: "text-[#ba1a1a]",
    prefix: "−",
  },
  REFUND: {
    label: "Hoàn tiền",
    icon: "currency_exchange",
    badge: "bg-[#b4cbce]/40 text-[#4d6265]",
    amountColor: "text-green-600",
    prefix: "+",
  },
  WITHDRAWAL: {
    label: "Rút tiền",
    icon: "payments",
    badge: "bg-[#ffdad6] text-[#ba1a1a]",
    amountColor: "text-[#ba1a1a]",
    prefix: "−",
  },
};

const STATUS_META = {
  COMPLETED: {
    label: "Hoàn thành",
    cls: "bg-green-100 text-green-700",
    dot: "bg-green-600",
  },
  PENDING: {
    label: "Chờ duyệt",
    cls: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  FAILED: {
    label: "Thất bại",
    cls: "bg-[#ffdad6] text-[#ba1a1a]",
    dot: "bg-[#ba1a1a]",
  },
};

/* ── Confirm Dialog ──────────────────────────────────── */
function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  loading,
  bankInfo,
  requiresReason,
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-[0px_20px_60px_rgba(0,98,157,0.15)] border border-[#bec7d4]/20 w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2.5 bg-amber-100 rounded-xl text-amber-600 shrink-0">
            <span className="material-symbols-outlined text-[22px]">help</span>
          </div>
          <div>
            <p className="font-headline-md text-[#191c1e] font-bold text-base mb-1">
              Xác nhận thao tác
            </p>
            <p className="text-[#3f4852] text-sm leading-relaxed">{message}</p>
          </div>
        </div>

        {bankInfo && (
          <div className="mb-5 bg-[#f2f4f6] p-4 rounded-xl text-sm text-[#3f4852] flex flex-col gap-1.5 border border-[#bec7d4]/30">
            <p className="text-xs font-bold text-[#191c1e] mb-1 uppercase tracking-wide">
              Thông tin chuyển khoản
            </p>
            <p>
              <span className="font-medium text-[#6f7883] inline-block w-24">
                Ngân hàng:
              </span>{" "}
              <span className="font-bold">
                {bankInfo.bankName || "Chưa cập nhật"}
              </span>
            </p>
            <p>
              <span className="font-medium text-[#6f7883] inline-block w-24">
                Số tài khoản:
              </span>{" "}
              <span className="font-bold">
                {bankInfo.bankAccount || "Chưa cập nhật"}
              </span>
            </p>
            <p>
              <span className="font-medium text-[#6f7883] inline-block w-24">
                Chủ tài khoản:
              </span>{" "}
              <span className="font-bold uppercase">
                {bankInfo.accountHolder || "Chưa cập nhật"}
              </span>
            </p>
          </div>
        )}

        {requiresReason && (
          <div className="mb-5">
            <label className="block text-xs font-bold text-[#3f4852] mb-1.5 uppercase tracking-wide">
              Lý do từ chối (Tùy chọn)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              className="w-full px-3 py-2 border border-[#bec7d4] rounded-lg text-sm text-[#191c1e] outline-none focus:border-[#00629d] focus:ring-1 focus:ring-[#00629d] transition-all"
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-[#bec7d4]/60 text-[#3f4852] text-sm font-semibold hover:bg-[#f2f4f6] transition-colors"
          >
            Huỷ bỏ
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-[#00629d] hover:bg-[#00629d]/90 text-white text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {loading && (
              <span className="material-symbols-outlined text-[16px] animate-spin">
                progress_activity
              </span>
            )}
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton Row ────────────────────────────────────── */
function SkeletonRow({ cols = 4 }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div
            className="h-4 bg-[#eceef0] rounded-lg"
            style={{ width: `${50 + i * 10}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

/* ── Main Component ──────────────────────────────────── */
export function AdminWalletPanel() {
  const queryClient = useQueryClient();
  const [txnFilters, setTxnFilters] = useState({
    type: "",
    status: "",
    page: 1,
    limit: 15,
  });
  const [confirm, setConfirm] = useState(null);

  /* Queries */
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["adminWalletStats"],
    queryFn: () => walletApi.getAdminStats().then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ["adminPendingWithdrawals"],
    queryFn: () =>
      walletApi
        .getAdminTransactions({
          type: "WITHDRAWAL",
          status: "PENDING",
          page: 1,
          limit: 20,
        })
        .then((r) => r.data),
  });

  const { data: allTxn, isLoading: allLoading } = useQuery({
    queryKey: ["adminAllTransactions", txnFilters],
    queryFn: () =>
      walletApi
        .getAdminTransactions({
          type: txnFilters.type || undefined,
          status: txnFilters.status || undefined,
          page: txnFilters.page,
          limit: txnFilters.limit,
        })
        .then((r) => r.data),
  });

  /* Mutations */
  const approveMut = useMutation({
    mutationFn: (id) => walletApi.approveWithdrawal(id),
    onSuccess: () => {
      toast.success("Đã duyệt yêu cầu rút tiền thành công");
      [
        "adminPendingWithdrawals",
        "adminWalletStats",
        "adminAllTransactions",
      ].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      setConfirm(null);
    },
    onError: () => {
      toast.error("Duyệt thất bại, vui lòng thử lại");
      setConfirm(null);
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }) => walletApi.rejectWithdrawal(id, reason),
    onSuccess: () => {
      toast.success("Đã từ chối và hoàn tiền về ví người dùng");
      [
        "adminPendingWithdrawals",
        "adminWalletStats",
        "adminAllTransactions",
      ].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      setConfirm(null);
    },
    onError: () => {
      toast.error("Từ chối thất bại, vui lòng thử lại");
      setConfirm(null);
    },
  });

  const stats = statsData?.stats;
  const isMutating = approveMut.isPending || rejectMut.isPending;

  /* Stat cards config */
  const statCards = [
    {
      label: "Tổng Số Dư Hệ Thống",
      value: statsLoading ? "—" : fmt(stats?.totalBalance),
      sub: "Tổng tất cả ví người dùng",
      icon: "account_balance_wallet",
      iconBg: "bg-[#cfe5ff]/40",
      iconColor: "text-[#00629d]",
      valueColor: "text-[#00629d]",
    },
    {
      label: "Nạp Tiền Hôm Nay",
      value: statsLoading ? "—" : fmt(stats?.depositToday),
      sub: "Giao dịch đã hoàn thành",
      icon: "trending_up",
      iconBg: "bg-green-100/60",
      iconColor: "text-green-600",
      valueColor: "text-[#191c1e]",
    },
    {
      label: "Chờ Duyệt Rút Tiền",
      value: statsLoading ? "—" : `${stats?.pendingWithdrawals ?? 0} yêu cầu`,
      sub: "Cần xử lý thủ công",
      icon: "pending_actions",
      iconBg: "bg-amber-100/60",
      iconColor: "text-amber-600",
      valueColor: "text-[#191c1e]",
    },
    {
      label: "Hoàn Tiền Tháng Này",
      value: statsLoading ? "—" : fmt(stats?.refundThisMonth),
      sub: "Tổng đã hoàn trong tháng",
      icon: "currency_exchange",
      iconBg: "bg-[#b4cbce]/40",
      iconColor: "text-[#4d6265]",
      valueColor: "text-[#191c1e]",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <section>
        <h2 className="font-headline-lg text-2xl font-bold text-[#191c1e]">
          Quản Lý Ví & Giao Dịch
        </h2>
        <p className="text-[#3f4852] mt-1 text-sm">
          Theo dõi tài chính hệ thống, phê duyệt lệnh rút tiền và xử lý hoàn
          tiền
        </p>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 flex justify-between items-start"
          >
            <div className="flex-1 min-w-0">
              <p className="font-label-md text-[#3f4852] text-sm">
                {card.label}
              </p>
              <p
                className={`font-headline-lg text-2xl font-extrabold mt-1 truncate ${card.valueColor}`}
              >
                {card.value}
              </p>
              <p className="text-xs text-[#3f4852]/60 mt-1.5">{card.sub}</p>
            </div>
            <div
              className={`p-3 ${card.iconBg} rounded-xl ${card.iconColor} shrink-0 ml-3`}
            >
              <span className="material-symbols-outlined">{card.icon}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Pending Withdrawals Table */}
      <section className="bg-white rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 overflow-hidden">
        {/* Section header */}
        <div className="p-6 border-b border-[#bec7d4]/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-headline-md text-lg font-bold text-[#191c1e]">
                Yêu Cầu Rút Tiền Chờ Duyệt
              </h3>
              {(stats?.pendingWithdrawals ?? 0) > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {stats.pendingWithdrawals}
                </span>
              )}
            </div>
            <p className="text-xs text-[#3f4852] mt-0.5">
              Xem xét và phê duyệt từng yêu cầu trước khi xử lý
            </p>
          </div>
          <button
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: ["adminPendingWithdrawals"],
              })
            }
            className="flex items-center gap-1.5 text-[#00629d] hover:bg-[#cfe5ff]/50 px-3 py-2 rounded-xl font-label-md text-sm font-semibold transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">
              refresh
            </span>
            Làm mới
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#f2f4f6]/50">
                {[
                  "Người Dùng",
                  "Email",
                  "Số Tiền Rút",
                  "Thời Gian Yêu Cầu",
                  "Thao Tác",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-4 font-label-md text-[#3f4852] text-sm font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#bec7d4]/10">
              {pendingLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonRow key={i} cols={5} />
                ))
              ) : !pendingData?.transactions?.length ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-4 bg-[#eceef0] rounded-2xl">
                        <span className="material-symbols-outlined text-[32px] text-[#6f7883]">
                          check_circle
                        </span>
                      </div>
                      <p className="font-label-md text-[#3f4852] font-semibold">
                        Không có yêu cầu nào chờ duyệt
                      </p>
                      <p className="text-xs text-[#3f4852]/60">
                        Tất cả yêu cầu rút tiền đã được xử lý
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pendingData.transactions.map((txn, idx) => (
                  <tr
                    key={txn.id}
                    className="hover:bg-[#f7f9fb] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#d3e2ed] flex items-center justify-center text-[#00629d] font-bold text-sm shrink-0">
                          {(txn.wallet?.user?.fullName ?? "?")[0].toUpperCase()}
                        </div>
                        <span className="font-label-md text-sm font-semibold text-[#191c1e]">
                          {txn.wallet?.user?.fullName ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#3f4852] text-sm">
                      {txn.wallet?.user?.email ?? "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-headline-md text-base font-bold text-[#ba1a1a] tabular-nums">
                        {fmt(txn.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#3f4852] text-sm whitespace-nowrap">
                      {new Date(txn.createdAt).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setConfirm({
                              id: txn.id,
                              action: "approve",
                              label: `Duyệt yêu cầu rút ${fmt(txn.amount)} của ${txn.wallet?.user?.fullName}?`,
                              bankInfo: {
                                bankName: txn.wallet?.user?.bankName,
                                bankAccount: txn.wallet?.user?.bankAccount,
                                accountHolder: txn.wallet?.user?.accountHolder,
                              },
                            })
                          }
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            check
                          </span>
                          Duyệt
                        </button>
                        <button
                          onClick={() =>
                            setConfirm({
                              id: txn.id,
                              action: "reject",
                              label: `Từ chối và hoàn ${fmt(txn.amount)} về ví của ${txn.wallet?.user?.fullName}?`,
                              bankInfo: {
                                bankName: txn.wallet?.user?.bankName,
                                bankAccount: txn.wallet?.user?.bankAccount,
                                accountHolder: txn.wallet?.user?.accountHolder,
                              },
                            })
                          }
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffb4ab] text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            close
                          </span>
                          Từ chối
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* All Transactions Table */}
      <section className="bg-white rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 overflow-hidden">
        {/* Section header + filters */}
        <div className="p-6 border-b border-[#bec7d4]/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-headline-md text-lg font-bold text-[#191c1e]">
              Tất Cả Giao Dịch
            </h3>
            <p className="text-xs text-[#3f4852] mt-0.5">
              Lịch sử toàn bộ giao dịch ví trong hệ thống
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={txnFilters.type}
              onChange={(e) =>
                setTxnFilters((f) => ({ ...f, type: e.target.value, page: 1 }))
              }
              className="bg-[#f2f4f6] text-xs font-semibold py-1.5 px-3 border-none rounded-lg focus:ring-2 focus:ring-[#00a3ff] outline-none cursor-pointer text-[#3f4852]"
            >
              <option value="">Tất cả loại</option>
              <option value="DEPOSIT">Nạp tiền</option>
              <option value="PAYMENT">Thanh toán</option>
              <option value="REFUND">Hoàn tiền</option>
              <option value="WITHDRAWAL">Rút tiền</option>
            </select>

            <select
              value={txnFilters.status}
              onChange={(e) =>
                setTxnFilters((f) => ({
                  ...f,
                  status: e.target.value,
                  page: 1,
                }))
              }
              className="bg-[#f2f4f6] text-xs font-semibold py-1.5 px-3 border-none rounded-lg focus:ring-2 focus:ring-[#00a3ff] outline-none cursor-pointer text-[#3f4852]"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="COMPLETED">Hoàn thành</option>
              <option value="PENDING">Chờ xử lý</option>
              <option value="FAILED">Thất bại</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#f2f4f6]/50">
                {[
                  "Người Dùng",
                  "Loại Giao Dịch",
                  "Số Tiền",
                  "Mô Tả",
                  "Trạng Thái",
                  "Thời Gian",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-4 font-label-md text-[#3f4852] text-sm font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#bec7d4]/10">
              {allLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonRow key={i} cols={6} />
                ))
              ) : !allTxn?.transactions?.length ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-4 bg-[#eceef0] rounded-2xl">
                        <span className="material-symbols-outlined text-[32px] text-[#6f7883]">
                          inbox
                        </span>
                      </div>
                      <p className="font-label-md text-[#3f4852] font-semibold">
                        Không tìm thấy giao dịch
                      </p>
                      <p className="text-xs text-[#3f4852]/60">
                        Thay đổi bộ lọc để xem kết quả khác
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                allTxn.transactions.map((txn) => {
                  const meta = TYPE_META[txn.type] ?? TYPE_META.PAYMENT;
                  const statusMeta =
                    STATUS_META[txn.status] ?? STATUS_META.PENDING;
                  return (
                    <tr
                      key={txn.id}
                      className="hover:bg-[#f7f9fb] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#d3e2ed] flex items-center justify-center text-[#00629d] font-bold text-xs shrink-0">
                            {(txn.wallet?.user?.fullName ??
                              "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-label-md text-sm font-semibold text-[#191c1e]">
                              {txn.wallet?.user?.fullName ?? "—"}
                            </p>
                            <p className="text-[11px] text-[#3f4852]/60">
                              {txn.wallet?.user?.email ?? ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-[#eceef0] rounded-lg">
                            <span className="material-symbols-outlined text-[16px] text-[#3f4852]">
                              {meta.icon}
                            </span>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${meta.badge}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`font-headline-md text-sm font-bold tabular-nums ${meta.amountColor}`}
                        >
                          {meta.prefix}
                          {fmt(txn.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-[200px]">
                        <p className="text-[#3f4852] text-sm line-clamp-2">
                          {txn.description || "—"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${statusMeta.cls}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`}
                          />
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[#3f4852] text-sm whitespace-nowrap">
                        {new Date(txn.createdAt).toLocaleString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {allTxn?.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#bec7d4]/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[#3f4852] text-xs">
              Hiển thị{" "}
              <span className="font-semibold text-[#191c1e]">
                {(txnFilters.page - 1) * txnFilters.limit + 1}–
                {Math.min(txnFilters.page * txnFilters.limit, allTxn.total)}
              </span>{" "}
              trong tổng{" "}
              <span className="font-semibold text-[#191c1e]">
                {allTxn.total}
              </span>{" "}
              giao dịch
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setTxnFilters((f) => ({ ...f, page: f.page - 1 }))
                }
                disabled={txnFilters.page <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#bec7d4] hover:bg-white disabled:opacity-50 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_left
                </span>
              </button>

              {Array.from({ length: allTxn.totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === allTxn.totalPages ||
                    Math.abs(p - txnFilters.page) <= 1,
                )
                .map((p, idx, arr) => (
                  <span key={p} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span className="px-1 text-[#3f4852]/40 text-xs">…</span>
                    )}
                    <button
                      onClick={() => setTxnFilters((f) => ({ ...f, page: p }))}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg font-label-sm text-xs transition-all ${
                        p === txnFilters.page
                          ? "bg-[#00629d] text-white"
                          : "border border-[#bec7d4] hover:bg-white cursor-pointer"
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                ))}

              <button
                onClick={() =>
                  setTxnFilters((f) => ({ ...f, page: f.page + 1 }))
                }
                disabled={txnFilters.page >= allTxn.totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#bec7d4] hover:bg-white disabled:opacity-50 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Confirm dialog */}
      {confirm && (
        <ConfirmDialog
          message={confirm.label}
          loading={isMutating}
          bankInfo={confirm.bankInfo}
          requiresReason={confirm.action === "reject"}
          onConfirm={(reason) => {
            if (confirm.action === "approve") approveMut.mutate(confirm.id);
            else rejectMut.mutate({ id: confirm.id, reason });
          }}
          onCancel={() => !isMutating && setConfirm(null)}
        />
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  History,
  RefreshCw,
  ChevronLeft as PagePrev,
  ChevronRight as PageNext,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { walletApi } from "../services/walletApi.js";
import { WalletBalanceCard } from "../components/wallet/WalletBalanceCard.jsx";
import { TransactionTable } from "../components/wallet/TransactionTable.jsx";
import { TransactionFilters } from "../components/wallet/TransactionFilters.jsx";
import { DepositModal } from "../components/wallet/DepositModal.jsx";
import { WithdrawModal } from "../components/wallet/WithdrawModal.jsx";

const LIMIT = 7;

const fmt = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    n ?? 0,
  );

export function Wallet() {
  const queryClient = useQueryClient();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [filters, setFilters] = useState({
    type: "",
    status: "",
    page: 1,
    limit: LIMIT,
  });

  const { data: walletData, isLoading: walletLoading } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => walletApi.getWallet().then((r) => r.data),
  });

  const { data: txnData, isLoading: txnLoading } = useQuery({
    queryKey: ["walletTransactions", filters],
    queryFn: () =>
      walletApi
        .getTransactions({
          type: filters.type || undefined,
          status: filters.status || undefined,
          page: filters.page,
          limit: filters.limit,
        })
        .then((r) => r.data),
  });

  const balance = walletData?.wallet?.balance ?? 0;
  const total = txnData?.total ?? 0;
  const totalPages = txnData?.totalPages ?? 1;
  const page = filters.page;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
    queryClient.invalidateQueries({ queryKey: ["walletTransactions"] });
  };

  return (
    /* Outer shell — matches homepage margin style */
    <div className="h-[calc(100vh-72px)] bg-[#f7f9fb] px-container-margin py-5 flex items-stretch">
      {/* Inner card — max-width centered, rounded, shadow */}
      <div className="max-w-[1100px] mx-auto w-full flex overflow-hidden rounded-2xl border border-[#bec7d4]/20 shadow-[0px_8px_32px_rgba(0,98,157,0.07)]">
        {/* ═══════════════════════════════════════════════
          LEFT PANEL — Balance & Info (fixed width)
      ═══════════════════════════════════════════════ */}
        <aside className="w-[320px] shrink-0 flex flex-col bg-white border-r border-[#bec7d4]/20 overflow-y-auto">
          <div className="flex flex-col gap-5 p-6">
            {/* Back link */}
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors w-fit"
            >
              <ChevronLeft className="w-4 h-4" />
              Trang chủ
            </Link>

            {/* Page title */}
            <div>
              <h1 className="text-xl font-bold text-on-surface">Ví Của Tôi</h1>
              <p className="text-sm text-on-surface-variant mt-0.5">
                Quản lý số dư và lịch sử giao dịch
              </p>
            </div>

            {/* Balance card */}
            <WalletBalanceCard
              balance={balance}
              updatedAt={walletData?.wallet?.updatedAt}
              isLoading={walletLoading}
              onDeposit={() => setShowDeposit(true)}
              onWithdraw={() => setShowWithdraw(true)}
              onRefresh={handleRefresh}
            />

            {/* Info cards */}
            <div className="space-y-3">
              <InfoCard
                Icon={Clock}
                title="Rút tiền"
                desc="Yêu cầu rút tiền được admin xét duyệt trong 1–3 ngày làm việc."
                color="amber"
              />
            </div>
          </div>
        </aside>

        {/* ═══════════════════════════════════════════════
          RIGHT PANEL — Transaction history
      ═══════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ── Panel header ── */}
          <div className="shrink-0 bg-white border-b border-[#bec7d4]/20 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <History className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold text-on-surface leading-none">
                  Lịch Sử Giao Dịch
                </h2>
                {!txnLoading && total > 0 && (
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {total} giao dịch · trang {page}/{totalPages}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-on-surface-variant hover:text-primary hover:bg-primary/8 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Làm mới
            </button>
          </div>

          {/* ── Filters ── */}
          <div className="shrink-0 bg-white border-b border-[#bec7d4]/10 px-6 py-3">
            <TransactionFilters
              filters={filters}
              onChange={(update) => setFilters({ limit: LIMIT, ...update })}
            />
          </div>

          {/* ── Table (grows to fill, scrolls internally if needed) ── */}
          <div className="flex-1 overflow-y-auto px-6 pt-4 pb-2">
            <TransactionTable
              transactions={txnData?.transactions}
              isLoading={txnLoading}
              total={total}
              page={page}
              totalPages={totalPages}
              limit={LIMIT}
              onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
              hidePagination
            />
          </div>

          {/* ── Pagination — always visible at bottom ── */}
          <div className="shrink-0 bg-white border-t border-[#bec7d4]/20 px-6 py-3 flex items-center justify-between">
            <span className="text-sm text-on-surface-variant">
              {txnLoading || total === 0 ? (
                "Không có giao dịch"
              ) : (
                <>
                  Hiển thị{" "}
                  <span className="font-semibold text-on-surface">
                    {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)}
                  </span>{" "}
                  trong{" "}
                  <span className="font-semibold text-on-surface">{total}</span>{" "}
                  giao dịch
                </>
              )}
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    setFilters((f) => ({ ...f, page: f.page - 1 }))
                  }
                  disabled={page <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container disabled:opacity-40 transition-colors"
                >
                  <PagePrev className="w-4 h-4" />
                </button>

                {buildPageNumbers(page, totalPages).map((item, idx) =>
                  item === "…" ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1 text-on-surface-variant text-sm"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setFilters((f) => ({ ...f, page: item }))}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                        item === page
                          ? "bg-primary text-white"
                          : "border border-outline-variant hover:bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}

                <button
                  onClick={() =>
                    setFilters((f) => ({ ...f, page: f.page + 1 }))
                  }
                  disabled={page >= totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container disabled:opacity-40 transition-colors"
                >
                  <PageNext className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
      {showWithdraw && (
        <WithdrawModal
          balance={balance}
          onClose={() => setShowWithdraw(false)}
        />
      )}
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────── */

function buildPageNumbers(current, total) {
  const pages = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) {
      pages.push(i);
    }
  }
  const result = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) result.push("…");
    result.push(pages[i]);
  }
  return result;
}

function SummaryTile({ label, value, sub, color }) {
  const palette = {
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-700",
  };
  return (
    <div className={`p-4 rounded-2xl border ${palette[color]}`}>
      <p className="text-xs font-semibold mb-1 opacity-80">{label}</p>
      <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
      <p className="text-[11px] opacity-60 mt-0.5">{sub}</p>
    </div>
  );
}

function InfoCard({ Icon, title, desc, color }) {
  const palette = {
    amber: "bg-amber-50 border-amber-100 text-amber-600",
    green: "bg-green-50 border-green-100 text-green-600",
  };
  return (
    <div className={`flex gap-3 p-4 rounded-2xl border ${palette[color]}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-semibold mb-0.5">{title}</p>
        <p className="text-[11px] opacity-80 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

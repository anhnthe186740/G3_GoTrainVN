import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  CalendarRange,
  Check,
  ChevronDown,
  CircleDollarSign,
  Database,
  Eye,
  Layers3,
  Loader2,
  MapPinned,
  Pause,
  Play,
  ReceiptText,
  RefreshCw,
  Save,
  Sparkles,
  TrainFront,
} from "lucide-react";
import { toast } from "sonner";
import { pricingApi } from "../../services/pricingApi";

const PASSENGERS = [
  { value: "ADULT", label: "Người lớn", short: "NL", color: "#00629d" },
  { value: "CHILD", label: "Trẻ em", short: "TE", color: "#d97706" },
  { value: "STUDENT", label: "Sinh viên", short: "SV", color: "#7c3aed" },
  { value: "SENIOR", label: "Người cao tuổi", short: "NCT", color: "#0f766e" },
];

const CARRIAGES = [
  { value: "NORMAL_SEAT", label: "Ghế ngồi", hint: "Toa phổ thông" },
  { value: "AC_SEAT", label: "Ghế điều hòa", hint: "Toa mềm AC" },
  { value: "SLEEPER_6", label: "Giường khoang 6", hint: "6 giường / khoang" },
  { value: "SLEEPER_4", label: "Giường khoang 4", hint: "4 giường / khoang" },
];

const DEFAULTS = {
  NORMAL_SEAT: { basePrice: "", pricePerKm: "", classSurcharge: "" },
  AC_SEAT: { basePrice: "", pricePerKm: "", classSurcharge: "" },
  SLEEPER_6: { basePrice: "", pricePerKm: "", classSurcharge: "" },
  SLEEPER_4: { basePrice: "", pricePerKm: "", classSurcharge: "" },
};

const DISCOUNTS = {
  ADULT: 0,
  CHILD: 0,
  STUDENT: 0,
  SENIOR: 0,
};

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function dateInputValue(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function createRules(source = []) {
  const sourceMap = new Map(
    source.map((rule) => [`${rule.passengerType}:${rule.carriageType}`, rule]),
  );

  return Object.fromEntries(
    PASSENGERS.flatMap((passenger) =>
      CARRIAGES.map((carriage) => {
        const key = `${passenger.value}:${carriage.value}`;
        const inherited = sourceMap.get(key);
        return [
          key,
          {
            passengerType: passenger.value,
            carriageType: carriage.value,
            basePrice:
              inherited?.basePrice ?? DEFAULTS[carriage.value].basePrice,
            pricePerKm:
              inherited?.pricePerKm ?? DEFAULTS[carriage.value].pricePerKm,
            classSurcharge:
              inherited?.classSurcharge ??
              DEFAULTS[carriage.value].classSurcharge,
            discountPercentage:
              inherited?.discountPercentage ?? DISCOUNTS[passenger.value],
            minPrice: inherited?.minPrice ?? "",
            maxPrice: inherited?.maxPrice ?? "",
            inherited: Boolean(inherited?.inherited),
            inheritedScope: inherited?.scopeType,
          },
        ];
      }),
    ),
  );
}

function money(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function compactMoney(value) {
  const number = Number(value) || 0;
  if (number >= 1000000) return `${(number / 1000000).toFixed(2)}tr`;
  if (number >= 1000) return `${Math.round(number / 1000)}k`;
  return String(Math.round(number));
}

function calculate(rule, distance, taxPercentage) {
  const base =
    Number(rule.basePrice || 0) +
    Number(rule.pricePerKm || 0) * Number(distance || 0) +
    Number(rule.classSurcharge || 0);
  const floor =
    rule.minPrice === "" ? base : Math.max(base, Number(rule.minPrice));
  const bounded =
    rule.maxPrice === "" ? floor : Math.min(floor, Number(rule.maxPrice));
  const afterDiscount =
    bounded * (1 - Number(rule.discountPercentage || 0) / 100);
  const final = afterDiscount * (1 + Number(taxPercentage || 0) / 100);
  return {
    base,
    bounded,
    discount: bounded - afterDiscount,
    tax: final - afterDiscount,
    final: Math.max(0, Math.round(final)),
  };
}

function Field({ label, suffix, value, onChange, min = 0, max, step = 1000 }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </span>
      <span className="flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 transition focus-within:border-[#00629d] focus-within:ring-4 focus-within:ring-[#00629d]/10">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none"
        />
        <span className="ml-2 text-[11px] font-semibold text-slate-400">
          {suffix}
        </span>
      </span>
    </label>
  );
}

function Skeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-36 rounded-[28px] bg-slate-200/70" />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="h-[560px] rounded-[28px] bg-slate-200/70" />
        <div className="h-[560px] rounded-[28px] bg-slate-200/70" />
      </div>
    </div>
  );
}

export function AdminPricingPanel() {
  const queryClient = useQueryClient();
  const [scopeType, setScopeType] = useState("SYSTEM");
  const [scopeId, setScopeId] = useState("");
  const [previewDistance, setPreviewDistance] = useState(300);
  const [selectedKey, setSelectedKey] = useState("ADULT:NORMAL_SEAT");
  const [policyCode, setPolicyCode] = useState("");
  const [policyName, setPolicyName] = useState("Biểu giá tiêu chuẩn");
  const [effectiveFrom, setEffectiveFrom] = useState(todayValue());
  const [effectiveTo, setEffectiveTo] = useState("");
  const [taxPercentage, setTaxPercentage] = useState(8);
  const [rules, setRules] = useState(() => createRules());
  const [dirty, setDirty] = useState(false);

  const contextQuery = useQuery({
    queryKey: ["pricingContext"],
    queryFn: () => pricingApi.getContext().then((response) => response.data),
  });

  const configurationQuery = useQuery({
    queryKey: ["pricingConfiguration", scopeType, scopeId],
    queryFn: () =>
      pricingApi
        .getConfiguration({
          scopeType,
          scopeId: scopeType === "SYSTEM" ? undefined : scopeId,
        })
        .then((response) => response.data),
    enabled: scopeType === "SYSTEM" || Boolean(scopeId),
  });

  const loadPolicy = (policy) => {
    setPolicyCode(policy.policyCode);
    setPolicyName(policy.policyName);
    setEffectiveFrom(dateInputValue(policy.effectiveFrom));
    setEffectiveTo(dateInputValue(policy.effectiveTo));
    setTaxPercentage(policy.taxPercentage ?? 0);
    setRules(createRules(policy.rules));
    setDirty(false);
  };

  const startNewPolicy = (effectiveRules = []) => {
    setPolicyCode("");
    setPolicyName(
      scopeType === "SYSTEM"
        ? "Biểu giá tiêu chuẩn"
        : `Biểu giá riêng · ${configurationQuery.data?.scope?.label || ""}`,
    );
    setEffectiveFrom(todayValue());
    setEffectiveTo("");
    setTaxPercentage(effectiveRules[0]?.taxPercentage ?? 8);
    setRules(createRules(effectiveRules));
    setDirty(false);
  };

  useEffect(() => {
    const data = configurationQuery.data;
    if (!data) return;
    const now = new Date();
    const current =
      data.policies.find(
        (policy) =>
          policy.active &&
          new Date(policy.effectiveFrom) <= now &&
          (!policy.effectiveTo || new Date(policy.effectiveTo) >= now),
      ) || data.policies[0];
    if (current) loadPolicy(current);
    else startNewPolicy(data.effectiveRules);
    if (data.scope.distance) setPreviewDistance(data.scope.distance);
    // Scope changes intentionally replace the editor state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configurationQuery.data]);

  useEffect(() => {
    if (scopeType === "SYSTEM") setScopeId("");
    else setScopeId("");
  }, [scopeType]);

  const selectedRule = rules[selectedKey];
  const preview = useMemo(
    () => calculate(selectedRule || {}, previewDistance, taxPercentage),
    [selectedRule, previewDistance, taxPercentage],
  );

  const scopeOptions =
    scopeType === "ROUTE"
      ? contextQuery.data?.routes || []
      : contextQuery.data?.schedules || [];

  const updateRule = (field, value) => {
    setRules((current) => {
      const next = { ...current };
      const isPassengerField = field === "discountPercentage";

      for (const [key, rule] of Object.entries(current)) {
        const sameDimension = isPassengerField
          ? rule.passengerType === selectedRule.passengerType
          : rule.carriageType === selectedRule.carriageType;
        if (sameDimension) {
          next[key] = { ...rule, [field]: value, inherited: false };
        }
      }

      return next;
    });
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const editingPolicy = configurationQuery.data?.policies.find(
        (policy) => policy.policyCode === policyCode,
      );
      return pricingApi.savePolicy({
        policyCode: policyCode || undefined,
        policyName,
        scopeType,
        scopeId: scopeType === "SYSTEM" ? undefined : scopeId,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        taxPercentage: Number(taxPercentage),
        active: policyCode ? editingPolicy?.active !== false : true,
        rules: Object.values(rules).map(
          ({ inherited, inheritedScope, ...rule }) => ({
            ...rule,
            basePrice: Number(rule.basePrice),
            pricePerKm: Number(rule.pricePerKm),
            classSurcharge: Number(rule.classSurcharge),
            discountPercentage: Number(rule.discountPercentage),
            minPrice: rule.minPrice === "" ? null : Number(rule.minPrice),
            maxPrice: rule.maxPrice === "" ? null : Number(rule.maxPrice),
          }),
        ),
      });
    },
    onSuccess: ({ data }) => {
      toast.success(data.message);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["pricingConfiguration"] });
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Không thể lưu chính sách giá.",
      );
    },
  });

  const activeMutation = useMutation({
    mutationFn: ({ code, active }) => pricingApi.setPolicyActive(code, active),
    onSuccess: ({ data }) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["pricingConfiguration"] });
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Không thể đổi trạng thái chính sách.",
      );
    },
  });

  if (contextQuery.isLoading) return <Skeleton />;

  if (contextQuery.isError) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-red-50 p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
        <h2 className="mt-3 text-lg font-bold text-slate-900">
          Không tải được dữ liệu cấu hình giá
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Kiểm tra kết nối máy chủ và quyền quản trị rồi thử lại.
        </p>
        <button
          onClick={() => contextQuery.refetch()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
        >
          <RefreshCw className="h-4 w-4" />
          Tải lại
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 text-slate-900">
      <section className="relative overflow-hidden rounded-[28px] border border-[#00629d]/10 bg-[#071f30] px-6 py-7 text-white shadow-[0_24px_70px_rgba(0,50,80,0.18)] md:px-8">
        <div className="absolute inset-y-0 right-0 w-1/2 opacity-30 [background-image:linear-gradient(90deg,transparent_0%,rgba(0,219,233,.22)_100%),repeating-linear-gradient(120deg,transparent_0px,transparent_20px,rgba(255,255,255,.08)_21px,transparent_22px)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-200">
              <CircleDollarSign className="h-4 w-4" />
              Pricing control · UC-17
            </div>
            <h1 className="font-headline-lg text-3xl font-bold tracking-tight md:text-4xl">
              Điều phối biểu giá
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Thiết lập giá theo cự ly, loại chỗ và nhóm hành khách. Chính sách
              cấp chuyến ưu tiên hơn tuyến, cấp tuyến ưu tiên hơn toàn hệ thống.
            </p>
          </div>

          <div className="grid min-w-0 gap-2 sm:grid-cols-3">
            {[
              { value: "SYSTEM", label: "Hệ thống", icon: Database },
              { value: "ROUTE", label: "Theo tuyến", icon: MapPinned },
              { value: "SCHEDULE", label: "Theo chuyến", icon: TrainFront },
            ].map((item) => {
              const Icon = item.icon;
              const active = scopeType === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => setScopeType(item.value)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-cyan-300 bg-cyan-300 text-[#052333] shadow-lg shadow-cyan-950/20"
                      : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-bold">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[minmax(260px,1fr)_minmax(260px,1fr)_auto] lg:items-end">
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
            Đối tượng áp dụng
          </label>
          {scopeType === "SYSTEM" ? (
            <div className="flex h-11 items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-800">
              <Check className="h-4 w-4" />
              Mặc định cho toàn bộ hệ thống
            </div>
          ) : (
            <div className="relative">
              <select
                value={scopeId}
                onChange={(event) => setScopeId(event.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold outline-none transition focus:border-[#00629d] focus:ring-4 focus:ring-[#00629d]/10"
              >
                <option value="">
                  {scopeType === "ROUTE"
                    ? "Chọn tuyến đường"
                    : "Chọn lịch trình"}
                </option>
                {scopeOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {scopeType === "ROUTE"
                      ? `${item.routeName} · ${item.distance} km`
                      : `${item.train.trainCode} · ${item.route.routeName} · ${new Date(item.departureTime).toLocaleString("vi-VN")}`}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
            Chính sách đang mở
          </label>
          <div className="relative">
            <select
              value={policyCode}
              disabled={!configurationQuery.data}
              onChange={(event) => {
                const code = event.target.value;
                if (!code)
                  startNewPolicy(configurationQuery.data?.effectiveRules);
                else {
                  const policy = configurationQuery.data?.policies.find(
                    (item) => item.policyCode === code,
                  );
                  if (policy) loadPolicy(policy);
                }
              }}
              className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold outline-none disabled:bg-slate-50"
            >
              <option value="">Tạo phiên bản chính sách mới</option>
              {configurationQuery.data?.policies.map((policy) => (
                <option key={policy.policyCode} value={policy.policyCode}>
                  {policy.policyName} ·{" "}
                  {policy.active ? "Đang hoạt động" : "Tạm dừng"}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
          </div>
        </div>

        <button
          onClick={() =>
            startNewPolicy(configurationQuery.data?.effectiveRules)
          }
          disabled={scopeType !== "SYSTEM" && !scopeId}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#00629d]/20 bg-[#00629d]/5 px-4 text-sm font-bold text-[#00629d] transition hover:bg-[#00629d]/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4" />
          Chính sách mới
        </button>
      </section>

      {scopeType !== "SYSTEM" && !scopeId ? (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
          <Layers3 className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-4 text-lg font-bold">Chọn phạm vi để bắt đầu</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Hệ thống sẽ tải chính sách đang áp dụng và chỉ rõ dữ liệu được kế
            thừa từ cấp cao hơn.
          </p>
        </section>
      ) : configurationQuery.isLoading ? (
        <Skeleton />
      ) : (
        <>
          <section className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_140px]">
            <label>
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
                Tên chính sách
              </span>
              <input
                value={policyName}
                onChange={(event) => {
                  setPolicyName(event.target.value);
                  setDirty(true);
                }}
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-[#00629d] focus:ring-4 focus:ring-[#00629d]/10"
              />
            </label>
            <label>
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
                Bắt đầu hiệu lực
              </span>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(event) => {
                  setEffectiveFrom(event.target.value);
                  setDirty(true);
                }}
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-[#00629d]"
              />
            </label>
            <label>
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
                Kết thúc hiệu lực
              </span>
              <input
                type="date"
                min={effectiveFrom}
                value={effectiveTo}
                onChange={(event) => {
                  setEffectiveTo(event.target.value);
                  setDirty(true);
                }}
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-[#00629d]"
              />
            </label>
            <Field
              label="Thuế suất"
              suffix="%"
              min={0}
              max={100}
              step={0.1}
              value={taxPercentage}
              onChange={(value) => {
                setTaxPercentage(value);
                setDirty(true);
              }}
            />
          </section>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ReceiptText className="h-5 w-5 text-[#00629d]" />
                    <h2 className="text-lg font-bold">Ma trận biểu giá</h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Chọn một ô để chỉnh chi tiết. Giá hiển thị theo cự ly xem
                    trước.
                  </p>
                </div>
                <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <MapPinned className="h-4 w-4 text-slate-400" />
                  <input
                    type="number"
                    min="1"
                    value={previewDistance}
                    onChange={(event) => setPreviewDistance(event.target.value)}
                    className="w-20 bg-transparent text-right text-sm font-bold outline-none"
                  />
                  <span className="text-xs font-bold text-slate-400">km</span>
                </label>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-[150px_repeat(4,minmax(165px,1fr))] border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-end p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Hành khách
                    </div>
                    {CARRIAGES.map((carriage) => (
                      <div
                        key={carriage.value}
                        className="border-l border-slate-100 p-4"
                      >
                        <p className="text-xs font-bold text-slate-800">
                          {carriage.label}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {carriage.hint}
                        </p>
                      </div>
                    ))}
                  </div>

                  {PASSENGERS.map((passenger) => (
                    <div
                      key={passenger.value}
                      className="grid grid-cols-[150px_repeat(4,minmax(165px,1fr))] border-b border-slate-100 last:border-b-0"
                    >
                      <div className="flex items-center gap-3 p-4">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-[10px] font-black text-white"
                          style={{ backgroundColor: passenger.color }}
                        >
                          {passenger.short}
                        </span>
                        <div>
                          <p className="text-xs font-bold">{passenger.label}</p>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Giảm{" "}
                            {rules[`${passenger.value}:NORMAL_SEAT`]
                              ?.discountPercentage ?? 0}
                            % theo chính sách
                          </p>
                        </div>
                      </div>

                      {CARRIAGES.map((carriage) => {
                        const key = `${passenger.value}:${carriage.value}`;
                        const rule = rules[key];
                        const cellPrice = calculate(
                          rule,
                          previewDistance,
                          taxPercentage,
                        ).final;
                        const selected = selectedKey === key;
                        return (
                          <button
                            key={key}
                            onClick={() => setSelectedKey(key)}
                            className={`relative border-l p-4 text-left transition ${
                              selected
                                ? "z-10 border-[#00629d] bg-[#eaf6ff] shadow-[inset_0_0_0_2px_#00629d]"
                                : "border-slate-100 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-base font-black tracking-tight text-slate-900">
                                {compactMoney(cellPrice)}
                              </p>
                              {rule.inherited && (
                                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold text-violet-700">
                                  Kế thừa
                                </span>
                              )}
                            </div>
                            <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-slate-400">
                              <span>{compactMoney(rule.pricePerKm)} / km</span>
                              <span>-{rule.discountPercentage}%</span>
                            </div>
                            {selected && (
                              <span className="absolute bottom-0 left-1/2 h-1 w-10 -translate-x-1/2 rounded-t-full bg-[#00629d]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="space-y-5 xl:sticky xl:top-5">
              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#00629d]">
                      Đang chỉnh
                    </p>
                    <h3 className="mt-1 text-lg font-bold">
                      {
                        PASSENGERS.find(
                          (item) => item.value === selectedRule.passengerType,
                        )?.label
                      }
                    </h3>
                    <p className="text-xs text-slate-500">
                      {
                        CARRIAGES.find(
                          (item) => item.value === selectedRule.carriageType,
                        )?.label
                      }
                    </p>
                  </div>
                  {selectedRule.inherited && (
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold text-violet-700">
                      Kế thừa từ {selectedRule.inheritedScope}
                    </span>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Field
                    label="Giá mở cửa"
                    suffix="đ"
                    value={selectedRule.basePrice}
                    onChange={(value) => updateRule("basePrice", value)}
                  />
                  <Field
                    label="Đơn giá cự ly"
                    suffix="đ/km"
                    value={selectedRule.pricePerKm}
                    onChange={(value) => updateRule("pricePerKm", value)}
                  />
                  <Field
                    label="Phụ thu loại chỗ"
                    suffix="đ"
                    value={selectedRule.classSurcharge}
                    onChange={(value) => updateRule("classSurcharge", value)}
                  />
                  <Field
                    label="Mức giảm"
                    suffix="%"
                    max={100}
                    step={1}
                    value={selectedRule.discountPercentage}
                    onChange={(value) =>
                      updateRule("discountPercentage", value)
                    }
                  />
                  <Field
                    label="Giá sàn"
                    suffix="đ"
                    value={selectedRule.minPrice}
                    onChange={(value) => updateRule("minPrice", value)}
                  />
                  <Field
                    label="Giá trần"
                    suffix="đ"
                    value={selectedRule.maxPrice}
                    onChange={(value) => updateRule("maxPrice", value)}
                  />
                </div>

                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-[10px] leading-5 text-blue-800">
                  Giá, đơn giá cự ly và giới hạn được đồng bộ theo loại chỗ.
                  Chiết khấu được đồng bộ theo nhóm hành khách.
                </div>
              </section>

              <section className="punch-hole-card overflow-hidden rounded-[28px] bg-[#eaf6ff] p-5 shadow-[0_16px_40px_rgba(0,98,157,0.12)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#00629d]">
                    <Eye className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-[0.16em]">
                      Xem trước giá bán
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">
                    {previewDistance} km
                  </span>
                </div>

                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      Giá cho 01 hành khách
                    </p>
                    <p className="mt-1 text-3xl font-black tracking-tight text-[#00375a]">
                      {money(preview.final)}
                    </p>
                  </div>
                  <TrainFront className="h-10 w-10 text-[#00629d]/20" />
                </div>

                <div className="my-5 border-t border-dashed border-[#00629d]/20" />
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Giá theo công thức</span>
                    <strong>{money(preview.base)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Sau giới hạn sàn / trần</span>
                    <strong>{money(preview.bounded)}</strong>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Chiết khấu</span>
                    <strong>-{money(preview.discount)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Thuế {taxPercentage || 0}%</span>
                    <strong>+{money(preview.tax)}</strong>
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-white/70 p-3 text-[10px] leading-5 text-slate-500">
                  Giá mở cửa + (cự ly × đơn giá) + phụ thu, sau đó áp dụng giới
                  hạn, chiết khấu và thuế.
                </div>
              </section>
            </aside>
          </div>

          <section className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  dirty
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {dirty ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
              </span>
              <div>
                <p className="text-sm font-bold">
                  {dirty ? "Có thay đổi chưa lưu" : "Cấu hình đã đồng bộ"}
                </p>
                <p className="text-xs text-slate-500">
                  Vé đã thanh toán giữ nguyên giá tại thời điểm phát hành.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {policyCode && (
                <button
                  onClick={() => {
                    const current = configurationQuery.data?.policies.find(
                      (item) => item.policyCode === policyCode,
                    );
                    activeMutation.mutate({
                      code: policyCode,
                      active: !current?.active,
                    });
                  }}
                  disabled={activeMutation.isPending}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {configurationQuery.data?.policies.find(
                    (item) => item.policyCode === policyCode,
                  )?.active ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {configurationQuery.data?.policies.find(
                    (item) => item.policyCode === policyCode,
                  )?.active
                    ? "Tạm dừng"
                    : "Kích hoạt"}
                </button>
              )}
              <button
                onClick={() => saveMutation.mutate()}
                disabled={
                  saveMutation.isPending ||
                  !policyName.trim() ||
                  (scopeType !== "SYSTEM" && !scopeId)
                }
                className="flex items-center gap-2 rounded-xl bg-[#00629d] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#00629d]/20 transition hover:bg-[#004f80] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {policyCode ? "Lưu thay đổi" : "Lưu và kích hoạt"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-[#00629d]" />
              <h2 className="text-base font-bold">
                Lịch sử phiên bản tại phạm vi này
              </h2>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {configurationQuery.data?.policies.length ? (
                configurationQuery.data.policies.map((policy) => (
                  <button
                    key={policy.policyCode}
                    onClick={() => loadPolicy(policy)}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 text-left transition hover:border-[#00629d]/30 hover:bg-[#00629d]/[0.03]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold">{policy.policyName}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            policy.active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {policy.active ? "Hoạt động" : "Tạm dừng"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {new Date(policy.effectiveFrom).toLocaleDateString(
                          "vi-VN",
                        )}
                        {" → "}
                        {policy.effectiveTo
                          ? new Date(policy.effectiveTo).toLocaleDateString(
                              "vi-VN",
                            )
                          : "Không giới hạn"}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300" />
                  </button>
                ))
              ) : (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  Chưa có chính sách riêng. Các giá trị trong ma trận đang lấy
                  từ cấp kế thừa hoặc bộ giá khởi tạo.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

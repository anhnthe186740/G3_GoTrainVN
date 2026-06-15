import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeftRight,
  Calendar,
  Inbox,
  LoaderCircle,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../services/api";
import { FilterPanel } from "./FilterPanel";
import { ScheduleCard } from "./ScheduleCard";

const DEFAULT_FILTERS = {
  timeSlots: [],
  trainTypes: [],
  carriageTypes: [],
};

function departureHourInVietnam(value) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(value)),
  );
}

function filterAndSortSchedules(schedules, filters, sortBy) {
  let list = [...schedules];

  if (filters.timeSlots.length > 0) {
    list = list.filter((schedule) => {
      const hour = departureHourInVietnam(schedule.departureTime);
      return filters.timeSlots.some((slot) => {
        if (slot === "00-06") return hour >= 0 && hour < 6;
        if (slot === "06-12") return hour >= 6 && hour < 12;
        if (slot === "12-18") return hour >= 12 && hour < 18;
        if (slot === "18-24") return hour >= 18 && hour < 24;
        return false;
      });
    });
  }

  if (filters.trainTypes.length > 0) {
    list = list.filter((schedule) =>
      filters.trainTypes.includes(schedule.trainType),
    );
  }

  if (filters.carriageTypes.length > 0) {
    list = list.filter((schedule) =>
      schedule.pricing.some((price) =>
        filters.carriageTypes.includes(price.carriageType),
      ),
    );
  }

  return list.sort((a, b) => {
    const minPriceA = Math.min(...a.pricing.map((price) => price.price));
    const minPriceB = Math.min(...b.pricing.map((price) => price.price));

    if (sortBy === "price-asc") return minPriceA - minPriceB;
    if (sortBy === "price-desc") return minPriceB - minPriceA;
    if (sortBy === "duration-asc") return a.duration - b.duration;
    if (sortBy === "time-desc") {
      return new Date(b.departureTime) - new Date(a.departureTime);
    }
    return new Date(a.departureTime) - new Date(b.departureTime);
  });
}

export function CustomerBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromStationId = searchParams.get("fromStationId");
  const toStationId = searchParams.get("toStationId");
  const from = searchParams.get("from") || "Ga đi";
  const to = searchParams.get("to") || "Ga đến";
  const departureDate = searchParams.get("departureDate");
  const tripType = searchParams.get("trip") || "one-way";
  const returnDate = searchParams.get("returnDate");
  const isRoundTrip = tripType === "round-trip";

  const [result, setResult] = useState({ outbound: [], return: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState("price-asc");
  const [activeLeg, setActiveLeg] = useState("outbound");
  const [selectedOutbound, setSelectedOutbound] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    if (!fromStationId || !toStationId || !departureDate) {
      setError("Thông tin tìm kiếm không đầy đủ. Vui lòng tìm chuyến lại.");
      setLoading(false);
      return () => controller.abort();
    }

    setLoading(true);
    setError("");
    setActiveLeg("outbound");
    setSelectedOutbound(null);

    api
      .get("/schedules/search", {
        params: {
          fromStationId,
          toStationId,
          departureDate,
          returnDate: isRoundTrip ? returnDate : undefined,
        },
        signal: controller.signal,
      })
      .then(({ data }) => {
        setResult({
          outbound: data.outbound || [],
          return: data.return || [],
        });
      })
      .catch((requestError) => {
        if (requestError.code !== "ERR_CANCELED") {
          setError(
            requestError.response?.data?.message ||
              "Không thể tải danh sách chuyến tàu.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [departureDate, fromStationId, isRoundTrip, returnDate, toStationId]);

  const currentSchedules =
    activeLeg === "outbound" ? result.outbound : result.return;
  const filteredSchedules = useMemo(
    () => filterAndSortSchedules(currentSchedules, filters, sortBy),
    [currentSchedules, filters, sortBy],
  );

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSortBy("price-asc");
  };

  const handleSelectSchedule = (schedule) => {
    if (isRoundTrip && activeLeg === "outbound") {
      setSelectedOutbound(schedule);
      setActiveLeg("return");
      setFilters(DEFAULT_FILTERS);
      toast.success(`Đã chọn lượt đi ${schedule.trainCode}. Hãy chọn lượt về.`);
      return;
    }

    if (isRoundTrip) {
      toast.success(
        `Đã chọn ${selectedOutbound.trainCode} lượt đi và ${schedule.trainCode} lượt về.`,
      );
      return;
    }

    toast.success(`Đã chọn chuyến tàu ${schedule.trainCode}.`);
  };

  const displayedDate = activeLeg === "outbound" ? departureDate : returnDate;
  const displayedFrom = activeLeg === "outbound" ? from : to;
  const displayedTo = activeLeg === "outbound" ? to : from;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 text-left">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/8 rounded-xl text-primary">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-800 text-base">
              <span>{displayedFrom}</span>
              <span className="text-slate-400">➔</span>
              <span>{displayedTo}</span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-semibold">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {activeLeg === "outbound" ? "Ngày đi" : "Ngày về"}:{" "}
                {displayedDate}
              </span>
              {isRoundTrip && (
                <span className="flex items-center gap-1 text-primary">
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  Khứ hồi
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-xs text-slate-600 transition cursor-pointer"
        >
          Thay đổi tìm kiếm
        </button>
      </div>

      {isRoundTrip && (
        <div className="grid grid-cols-2 gap-3">
          {[
            ["outbound", `Lượt đi · ${departureDate}`],
            ["return", `Lượt về · ${returnDate}`],
          ].map(([leg, label]) => (
            <button
              key={leg}
              type="button"
              disabled={leg === "return" && !selectedOutbound}
              onClick={() => setActiveLeg(leg)}
              className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                activeLeg === leg
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 bg-white text-slate-500"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <FilterPanel
            filters={filters}
            setFilters={setFilters}
            sortBy={sortBy}
            setSortBy={setSortBy}
            onReset={resetFilters}
          />
        </div>

        <div className="lg:col-span-3 space-y-4">
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
              <LoaderCircle className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="mt-3 text-sm font-semibold text-slate-500">
                Đang tìm chuyến phù hợp...
              </p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-3xl p-10 text-center">
              <p className="font-bold text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="mt-4 text-sm font-bold text-primary"
              >
                Quay lại tìm kiếm
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Kết quả ({filteredSchedules.length} chuyến)
                </span>
              </div>

              {filteredSchedules.length === 0 ? (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center space-y-4 shadow-sm">
                  <div className="h-16 w-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <Inbox className="h-8 w-8" />
                  </div>
                  <h3 className="font-bold text-slate-800">
                    Không tìm thấy chuyến tàu phù hợp
                  </h3>
                  <p className="text-slate-500 text-xs">
                    Hãy đổi ngày đi hoặc đặt lại bộ lọc.
                  </p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="bg-primary/10 text-primary px-5 py-2.5 rounded-xl font-bold text-xs"
                  >
                    Đặt lại bộ lọc
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSchedules.map((schedule) => (
                    <ScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      onSelect={handleSelectSchedule}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

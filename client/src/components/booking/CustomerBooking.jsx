import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { Inbox, Search, Calendar } from "lucide-react";
import { FilterPanel } from "./FilterPanel";
import { ScheduleCard } from "./ScheduleCard";
import { toast } from "sonner";

export function CustomerBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read query params from URL
  const from = searchParams.get("from") || "Hà Nội";
  const to = searchParams.get("to") || "Đà Nẵng";
  const dateStr = searchParams.get("date") || "2024-12-24";
  const tripType = searchParams.get("trip") || "one-way";
  const returnDate = searchParams.get("returnDate");

  // State management for schedules loaded from API
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  // State management for filters and sort
  const [filters, setFilters] = useState({
    timeSlots: [],
    trainTypes: [],
    carriageTypes: [],
  });
  const [sortBy, setSortBy] = useState("price-asc");

  const fetchSchedules = () => {
    api
      .get("/schedules")
      .then(({ data }) => {
        if (data && data.schedules) {
          const formatted = data.schedules.map((s) => {
            let duration = s.duration;
            if (!duration) {
              const diffMs =
                new Date(s.arrivalTime) - new Date(s.departureTime);
              duration = Math.floor(diffMs / 60 / 1000);
            }

            const carriageNames = {
              SEAT: "Ghế thường",
              AC_SEAT: "Ghế AC",
              SLEEPER: "Giường nằm",
            };
            const pricing = s.pricing.map((p) => ({
              carriageType: p.carriageType,
              carriageTypeName: carriageNames[p.carriageType] || p.carriageType,
              price: p.basePrice,
            }));

            const availability = s.availabilitySnapshots || [];

            return {
              id: s.id,
              trainCode: s.train.trainCode,
              trainName: s.train.trainName,
              departureTime: s.departureTime,
              arrivalTime: s.arrivalTime,
              duration,
              startStationName: s.route.startStation.stationName,
              endStationName: s.route.endStation.stationName,
              pricing,
              availability,
            };
          });
          setSchedules(formatted);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Lỗi khi tải lịch trình từ API:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSchedules();

    // 2-minute polling interval
    const interval = setInterval(() => {
      fetchSchedules();
      toast.info("Đã cập nhật tự động tỉ lệ lấp đầy ghế thực tế từ database!");
    }, 120000);

    return () => clearInterval(interval);
  }, []);

  const resetFilters = () => {
    setFilters({
      timeSlots: [],
      trainTypes: [],
      carriageTypes: [],
    });
    setSortBy("price-asc");
    toast.success("Đã cài lại bộ lọc mặc định!");
  };

  // Filter and sort computation
  const filteredAndSortedSchedules = useMemo(() => {
    // 1. Filter by search query (stations match)
    let list = schedules.filter((s) => {
      const fromClean = from.toLowerCase().replace("ga ", "").trim();
      const toClean = to.toLowerCase().replace("ga ", "").trim();
      const startClean = s.startStationName
        .toLowerCase()
        .replace("ga ", "")
        .trim();
      const endClean = s.endStationName.toLowerCase().replace("ga ", "").trim();
      return startClean.includes(fromClean) && endClean.includes(toClean);
    });

    // 2. Filter by time slots
    if (filters.timeSlots.length > 0) {
      list = list.filter((s) => {
        const departureHour = new Date(s.departureTime).getUTCHours() + 7; // Convert to GMT+7
        const hour = departureHour % 24;

        return filters.timeSlots.some((slot) => {
          if (slot === "00-06") return hour >= 0 && hour < 6;
          if (slot === "06-12") return hour >= 6 && hour < 12;
          if (slot === "12-18") return hour >= 12 && hour < 18;
          if (slot === "18-24") return hour >= 18 && hour < 24;
          return false;
        });
      });
    }

    // 3. Filter by train types
    if (filters.trainTypes.length > 0) {
      list = list.filter((s) =>
        filters.trainTypes.some((type) => s.trainCode.startsWith(type)),
      );
    }

    // 4. Filter by carriage types
    if (filters.carriageTypes.length > 0) {
      list = list.filter((s) =>
        s.pricing.some((p) => filters.carriageTypes.includes(p.carriageType)),
      );
    }

    // 5. Sort logic
    list = [...list].sort((a, b) => {
      const minPriceA = Math.min(...a.pricing.map((p) => p.price));
      const minPriceB = Math.min(...b.pricing.map((p) => p.price));

      if (sortBy === "price-asc") return minPriceA - minPriceB;
      if (sortBy === "price-desc") return minPriceB - minPriceA;
      if (sortBy === "duration-asc") return a.duration - b.duration;
      if (sortBy === "time-asc")
        return new Date(a.departureTime) - new Date(b.departureTime);
      if (sortBy === "time-desc")
        return new Date(b.departureTime) - new Date(a.departureTime);
      return 0;
    });

    return list;
  }, [from, to, filters, sortBy, schedules]);

  const handleSelectSchedule = (schedule) => {
    toast.success(
      `Đã chọn chuyến tàu ${schedule.trainCode}. Đang chuyển hướng qua luồng đặt vé...`,
    );
  };

  const handleBackToSearch = () => {
    navigate("/");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {/* Search Header Summary Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 text-left">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/8 rounded-xl text-primary">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-800 text-base leading-none">
              <span>{from}</span>
              <span className="text-slate-400">➔</span>
              <span>{to}</span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-semibold">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Ngày đi: {dateStr}
              </span>
              {tripType === "round-trip" && returnDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  Ngày về: {returnDate}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleBackToSearch}
          className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-xs text-slate-600 transition cursor-pointer"
        >
          Thay đổi tìm kiếm
        </button>
      </div>

      {/* Main Grid: Filter (left) & Schedule list (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Filter and Sort Panel */}
        <div className="lg:col-span-1">
          <FilterPanel
            filters={filters}
            setFilters={setFilters}
            sortBy={sortBy}
            setSortBy={setSortBy}
            onReset={resetFilters}
          />
        </div>

        {/* Right Side: Search Results List */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Kết quả tìm kiếm ({filteredAndSortedSchedules.length} chuyến)
            </span>
          </div>

          {filteredAndSortedSchedules.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center space-y-4 shadow-sm">
              <div className="h-16 w-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Inbox className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">
                Không tìm thấy chuyến tàu nào
              </h3>
              <p className="text-slate-500 text-xs max-w-sm mx-auto">
                Không tìm thấy chuyến tàu khớp với bộ lọc bạn chọn. Hãy điều
                chỉnh bộ lọc hoặc đặt lại bộ lọc để xem đầy đủ chuyến tàu.
              </p>
              <div className="pt-2">
                <button
                  onClick={resetFilters}
                  className="bg-primary/10 hover:bg-primary/15 text-primary px-5 py-2.5 rounded-xl font-bold text-xs transition active:scale-95 cursor-pointer"
                >
                  Đặt lại bộ lọc
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAndSortedSchedules.map((schedule) => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  onSelect={handleSelectSchedule}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

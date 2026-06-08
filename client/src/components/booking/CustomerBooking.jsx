import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Inbox,
  Search,
  Ticket,
  Users,
  Calendar,
  Sparkles,
} from "lucide-react";
import { FilterPanel } from "./FilterPanel";
import { ScheduleCard } from "./ScheduleCard";
import { toast } from "sonner";

// Mock schedules data for G3_GoTrainVN Customer booking flow
const MOCK_SCHEDULES = [
  {
    id: "sched-se1",
    trainCode: "SE1",
    trainName: "Hải Vân Express (Tàu nhanh SE)",
    departureTime: "2024-12-24T06:15:00.000Z",
    arrivalTime: "2024-12-24T18:45:00.000Z",
    duration: 750, // 12h 30m
    startStationName: "Hà Nội",
    endStationName: "Đà Nẵng",
    pricing: [
      { carriageType: "SEAT", carriageTypeName: "Ghế ngồi", price: 420000 },
      { carriageType: "AC_SEAT", carriageTypeName: "Ghế AC", price: 580000 },
      {
        carriageType: "SLEEPER",
        carriageTypeName: "Giường nằm",
        price: 920000,
      },
    ],
  },
  {
    id: "sched-se3",
    trainCode: "SE3",
    trainName: "Thống Nhất Express (Tàu nhanh SE)",
    departureTime: "2024-12-24T08:30:00.000Z",
    arrivalTime: "2024-12-24T21:00:00.000Z",
    duration: 750, // 12h 30m
    startStationName: "Hà Nội",
    endStationName: "Đà Nẵng",
    pricing: [
      { carriageType: "SEAT", carriageTypeName: "Ghế ngồi", price: 450000 },
      { carriageType: "AC_SEAT", carriageTypeName: "Ghế AC", price: 620000 },
      {
        carriageType: "SLEEPER",
        carriageTypeName: "Giường nằm",
        price: 950000,
      },
    ],
  },
  {
    id: "sched-tn1",
    trainCode: "TN1",
    trainName: "Thống Nhất Thường (Tàu thường TN)",
    departureTime: "2024-12-24T05:45:00.000Z",
    arrivalTime: "2024-12-24T19:30:00.000Z",
    duration: 825, // 13h 45m
    startStationName: "Hà Nội",
    endStationName: "Đà Nẵng",
    pricing: [
      { carriageType: "SEAT", carriageTypeName: "Ghế ngồi", price: 350000 },
      { carriageType: "AC_SEAT", carriageTypeName: "Ghế AC", price: 490000 },
    ],
  },
  {
    id: "sched-se5",
    trainCode: "SE5",
    trainName: "Phương Nam Express (Tàu nhanh SE)",
    departureTime: "2024-12-24T13:15:00.000Z",
    arrivalTime: "2024-12-25T01:45:00.000Z",
    duration: 750, // 12h 30m
    startStationName: "Hà Nội",
    endStationName: "Đà Nẵng",
    pricing: [
      { carriageType: "AC_SEAT", carriageTypeName: "Ghế AC", price: 610000 },
      {
        carriageType: "SLEEPER",
        carriageTypeName: "Giường nằm",
        price: 980000,
      },
    ],
  },
  {
    id: "sched-tn3",
    trainCode: "TN3",
    trainName: "Vạn Xuân Night (Tàu thường TN)",
    departureTime: "2024-12-24T20:15:00.000Z",
    arrivalTime: "2024-12-25T09:30:00.000Z",
    duration: 795, // 13h 15m
    startStationName: "Hà Nội",
    endStationName: "Đà Nẵng",
    pricing: [
      { carriageType: "SEAT", carriageTypeName: "Ghế ngồi", price: 380000 },
      {
        carriageType: "SLEEPER",
        carriageTypeName: "Giường nằm",
        price: 820000,
      },
    ],
  },
  {
    id: "sched-se7",
    trainCode: "SE7",
    trainName: "Bình Minh Speed (Tàu nhanh SE)",
    departureTime: "2024-12-24T17:45:00.000Z",
    arrivalTime: "2024-12-25T06:00:00.000Z",
    duration: 735, // 12h 15m
    startStationName: "Hà Nội",
    endStationName: "Đà Nẵng",
    pricing: [
      { carriageType: "SEAT", carriageTypeName: "Ghế ngồi", price: 490000 },
      { carriageType: "AC_SEAT", carriageTypeName: "Ghế AC", price: 680000 },
      {
        carriageType: "SLEEPER",
        carriageTypeName: "Giường nằm",
        price: 1050000,
      },
    ],
  },
];

export function CustomerBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read query params from URL
  const from = searchParams.get("from") || "Hà Nội";
  const to = searchParams.get("to") || "Đà Nẵng";
  const dateStr = searchParams.get("date") || "2024-12-24";
  const tripType = searchParams.get("trip") || "one-way";

  // State management for filters and sort
  const [filters, setFilters] = useState({
    timeSlots: [],
    trainTypes: [],
    carriageTypes: [],
  });
  const [sortBy, setSortBy] = useState("price-asc");

  // Selected schedule state (For transitioning to Task 6 later)
  const [selectedSchedule, setSelectedSchedule] = useState(null);

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
    let list = MOCK_SCHEDULES.filter(
      (s) =>
        s.startStationName.toLowerCase().includes(from.toLowerCase()) &&
        s.endStationName.toLowerCase().includes(to.toLowerCase()),
    );

    // If no exact match (e.g. searching for other mocked routes), display all for visual demonstration
    if (list.length === 0) {
      list = MOCK_SCHEDULES;
    }

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
  }, [from, to, filters, sortBy]);

  const handleSelectSchedule = (schedule) => {
    setSelectedSchedule(schedule);
    toast.success(
      `Đã chọn chuyến tàu ${schedule.trainCode}. Đang chuyển qua chọn ghế!`,
    );
  };

  const handleBackToSearch = () => {
    navigate("/");
  };

  // Render Seat Selection placeholder (Task 6 preparation)
  if (selectedSchedule) {
    return (
      <div className="space-y-6 text-left max-w-4xl mx-auto p-6">
        <button
          onClick={() => setSelectedSchedule(null)}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại danh sách chuyến tàu
        </button>

        <div className="bg-[#cfe5ff]/20 border border-[#cfe5ff] rounded-2xl p-5 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h3 className="font-bold text-slate-800">Thông báo từ hệ thống</h3>
            <p className="text-xs text-slate-600 mt-1">
              Bạn đã chọn chuyến tàu{" "}
              <strong>
                {selectedSchedule.trainCode} - {selectedSchedule.trainName}
              </strong>{" "}
              thành công. Các tính năng vẽ sơ đồ toa tàu, khóa ghế và nhập thông
              tin hành khách thuộc <strong>Nhiệm vụ 6 (Lực)</strong> đang sẵn
              sàng tích hợp!
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-sm">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
            <Ticket className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">
            Giao diện Chọn ghế (Nhiệm vụ 6)
          </h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Tại bước này, hệ thống sẽ gọi API sơ đồ ghế của tàu{" "}
            {selectedSchedule.trainCode}, hiển thị cấu trúc khoang hành khách và
            khóa giữ chỗ tự động.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setSelectedSchedule(null)}
              className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-xs hover:shadow-md transition active:scale-95 cursor-pointer"
            >
              Xem lại bộ lọc kết quả
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                Khứ hồi: {tripType === "round-trip" ? "Có" : "Không"}
              </span>
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

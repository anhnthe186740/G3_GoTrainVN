import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Navigation,
  Calendar,
  RotateCw,
  Users,
  Train,
  ArrowRight,
  ChevronRight,
  Zap,
  Headphones,
  Tag,
  Star,
  Plus,
  Minus,
  Home as HomeIcon,
  CalendarDays,
  Ticket,
  Wallet,
  User as UserIcon,
  ArrowLeftRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";

const DEFAULT_FROM_STATION = "Hà Nội";
const DEFAULT_TO_STATION = "Đà Nẵng";

export function Home() {
  const navigate = useNavigate();

  const getTodayDateStr = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getNextDay = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  // Search parameters
  const [fromStation, setFromStation] = useState(DEFAULT_FROM_STATION);
  const [fromStationId, setFromStationId] = useState("");
  const [toStation, setToStation] = useState(DEFAULT_TO_STATION);
  const [toStationId, setToStationId] = useState("");
  const [departureDate, setDepartureDate] = useState(getTodayDateStr());
  const [returnDate, setReturnDate] = useState("");
  const [tripType, setTripType] = useState("one-way"); // 'one-way' or 'round-trip'

  const [stations, setStations] = useState([]);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);

  // Live tracking progress bar logic
  const [progress, setProgress] = useState(66.05);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev + 0.05) % 100);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch active stations from server on load
  useEffect(() => {
    api
      .get("/stations")
      .then(({ data }) => {
        if (data && data.stations) {
          const formatted = data.stations.map((s) => ({
            id: s.id,
            code: s.stationCode,
            name: s.stationName.replace(/^Ga\s+/i, ""),
            city: s.city,
          }));
          setStations(formatted);
          setFromStationId(
            formatted.find((station) => station.name === DEFAULT_FROM_STATION)
              ?.id || "",
          );
          setToStationId(
            formatted.find((station) => station.name === DEFAULT_TO_STATION)
              ?.id || "",
          );
        }
      })
      .catch((err) => {
        console.error("Lỗi khi tải danh sách ga từ API:", err);
        toast.error("Không thể tải danh sách ga đang hoạt động.");
      });
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleCloseSuggestions = () => {
      setShowFromSuggestions(false);
      setShowToSuggestions(false);
    };
    window.addEventListener("click", handleCloseSuggestions);
    return () => window.removeEventListener("click", handleCloseSuggestions);
  }, []);

  const handleSwapStations = () => {
    const temp = fromStation;
    const tempId = fromStationId;
    setFromStation(toStation);
    setFromStationId(toStationId);
    setToStation(temp);
    setToStationId(tempId);
    toast.success("Đã đổi Ga đi và Ga đến!");
  };

  const filteredFromSuggestions = useMemo(() => {
    const query = fromStation.trim().toLowerCase();
    if (!query) return stations;
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.city.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query),
    );
  }, [fromStation, stations]);

  const filteredToSuggestions = useMemo(() => {
    const query = toStation.trim().toLowerCase();
    if (!query) return stations;
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.city.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query),
    );
  }, [toStation, stations]);

  const handleSearch = (e) => {
    e.preventDefault();

    const fromTrimmed = fromStation.trim();
    const toTrimmed = toStation.trim();

    if (!fromTrimmed) {
      toast.error("Vui lòng nhập Ga đi!");
      return;
    }
    if (!toTrimmed) {
      toast.error("Vui lòng nhập Ga đến!");
      return;
    }

    // Match exact station name from database/mock
    const validFrom = stations.find(
      (s) =>
        s.id === fromStationId &&
        s.name.toLowerCase() === fromTrimmed.toLowerCase(),
    );
    const validTo = stations.find(
      (s) =>
        s.id === toStationId &&
        s.name.toLowerCase() === toTrimmed.toLowerCase(),
    );

    if (!validFrom) {
      toast.error(
        `Ga đi "${fromTrimmed}" không tồn tại trong hệ thống. Vui lòng chọn ga từ danh sách!`,
      );
      return;
    }
    if (!validTo) {
      toast.error(
        `Ga đến "${toTrimmed}" không tồn tại trong hệ thống. Vui lòng chọn ga từ danh sách!`,
      );
      return;
    }

    if (validFrom.name === validTo.name) {
      toast.error("Ga đi và Ga đến không được trùng nhau!");
      return;
    }

    if (!departureDate) {
      toast.error("Vui lòng chọn ngày đi!");
      return;
    }

    const todayStr = getTodayDateStr();
    if (departureDate < todayStr) {
      toast.error("Ngày đi không được ở quá khứ!");
      return;
    }

    if (tripType === "round-trip") {
      if (!returnDate) {
        toast.error("Vui lòng chọn ngày về cho vé khứ hồi!");
        return;
      }
      if (returnDate < departureDate) {
        toast.error("Ngày về không được trước ngày đi!");
        return;
      }
    }

    toast.success(
      `Đang tìm kiếm chuyến tàu từ ${validFrom.name} đi ${validTo.name}...`,
    );

    const params = new URLSearchParams({
      fromStationId: validFrom.id,
      toStationId: validTo.id,
      from: validFrom.name,
      to: validTo.name,
      departureDate,
      trip: tripType,
    });
    if (tripType === "round-trip") params.set("returnDate", returnDate);
    navigate(`/schedule?${params.toString()}`);
  };

  const handleCopyVoucher = (code) => {
    navigator.clipboard.writeText(code);
    toast.success(`Đã sao chép mã khuyến mãi: ${code}`);
  };

  const handleRouteSelect = (from, to) => {
    const selectedFrom = stations.find((station) => station.name === from);
    const selectedTo = stations.find((station) => station.name === to);

    if (!selectedFrom || !selectedTo) {
      toast.error("Chặng này hiện chưa có trong danh sách ga đang hoạt động.");
      return;
    }

    setFromStation(from);
    setFromStationId(selectedFrom.id);
    setToStation(to);
    setToStationId(selectedTo.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info(`Đã chọn chặng phổ biến: ${from} ↔ ${to}`);
  };

  return (
    <div className="text-on-surface bg-[#f7f9fb] min-h-screen pb-16 md:pb-0 pt-16">
      {/* 1. Hero Section */}
      <section className="relative min-h-[680px] flex items-center">
        <div className="absolute inset-0 z-0">
          <img
            className="w-full h-full object-cover"
            alt="A high-speed modern train speeding through a lush green Vietnamese landscape during a clear, bright morning."
            data-alt="A high-speed modern train speeding through a lush green Vietnamese landscape during a clear, bright morning. The visual style is premium and minimalist, with a high-key lighting that emphasizes a clean and airy atmosphere."
            src="/assets/hero-bg.jpg"
          />
          <div className="absolute inset-0 bg-white/20"></div>
        </div>

        <div className="relative z-10 px-container-margin max-w-[1200px] mx-auto w-full pt-16 pb-28 md:pb-36 flex flex-col items-center">
          <div className="text-center w-full flex flex-col items-center">
            <div className="mb-10">
              <h1 className="text-[40px] md:text-[56px] font-semibold mb-sm leading-tight tracking-tight drop-shadow-md text-slate-900">
                Hành trình mới,{" "}
                <span className="text-[#007aff]">trải nghiệm vượt trội</span>
              </h1>
            </div>

            {/* Search Card */}
            <div className="bg-white p-lg rounded-[24px] shadow-[0px_20px_50px_rgba(0,0,0,0.1)] w-full">
              <form onSubmit={handleSearch}>
                <div
                  className={`grid grid-cols-1 gap-md items-end ${tripType === "round-trip" ? "md:grid-cols-5" : "md:grid-cols-4"}`}
                >
                  {/* Station Fields Container */}
                  <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-md relative">
                    {/* Ga Đi */}
                    <div
                      className={`flex flex-col gap-xs relative text-left ${showFromSuggestions ? "z-30" : "z-0"}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="font-label-md text-label-md text-secondary">
                        Ga Đi
                      </label>
                      <div className="flex items-center gap-xs px-md py-sm border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all bg-white h-[48px]">
                        <MapPin className="h-5 w-5 text-primary shrink-0" />
                        <input
                          className="w-full border-none p-0 focus:ring-0 font-body-md bg-transparent text-on-surface outline-none text-xs font-semibold"
                          placeholder="Hà Nội"
                          type="text"
                          value={fromStation}
                          onChange={(e) => {
                            setFromStation(e.target.value);
                            setFromStationId("");
                            setShowFromSuggestions(true);
                          }}
                          onFocus={() => {
                            setShowFromSuggestions(true);
                            setShowToSuggestions(false);
                          }}
                        />
                      </div>
                      {/* Suggestions Dropdown */}
                      {showFromSuggestions &&
                        filteredFromSuggestions.length > 0 && (
                          <div className="absolute left-0 top-[95%] w-full md:w-[320px] bg-white border border-slate-100 rounded-b-2xl rounded-t-lg shadow-[0_12px_36px_rgba(0,0,0,0.12)] z-30 max-h-[320px] overflow-y-auto divide-y divide-slate-50">
                            {filteredFromSuggestions.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setFromStation(s.name);
                                  setFromStationId(s.id);
                                  setShowFromSuggestions(false);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50/50 flex items-center justify-between transition-colors border-l-4 border-transparent hover:border-primary cursor-pointer group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400 group-hover:bg-blue-100/50 group-hover:text-primary transition-colors">
                                    <MapPin className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-800">
                                      {s.name.toLowerCase().startsWith("ga")
                                        ? s.name
                                        : `Ga ${s.name}`}
                                    </p>
                                    <p className="text-xs text-slate-400 font-semibold">
                                      {s.city}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[11px] font-bold bg-slate-50 text-slate-500 px-2 py-1 rounded-md border border-slate-100 group-hover:bg-blue-50 group-hover:text-primary group-hover:border-blue-200 transition-colors">
                                  {s.code}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                    </div>

                    {/* Swap Button */}
                    <button
                      type="button"
                      onClick={handleSwapStations}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[20%] z-10 bg-white border border-outline-variant rounded-full p-2 text-primary hover:rotate-180 transition-transform duration-500 shadow-sm hidden md:flex items-center justify-center cursor-pointer"
                      title="Đảo chiều ga"
                    >
                      <RotateCw className="h-5 w-5" />
                    </button>

                    {/* Ga Đến */}
                    <div
                      className={`flex flex-col gap-xs relative text-left ${showToSuggestions ? "z-30" : "z-0"}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="font-label-md text-label-md text-secondary">
                        Ga Đến
                      </label>
                      <div className="flex items-center gap-xs px-md py-sm border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all bg-white h-[48px]">
                        <Navigation className="h-5 w-5 text-primary rotate-45 shrink-0" />
                        <input
                          className="w-full border-none p-0 focus:ring-0 font-body-md bg-transparent text-on-surface outline-none text-xs font-semibold"
                          placeholder="Đà Nẵng"
                          type="text"
                          value={toStation}
                          onChange={(e) => {
                            setToStation(e.target.value);
                            setToStationId("");
                            setShowToSuggestions(true);
                          }}
                          onFocus={() => {
                            setShowToSuggestions(true);
                            setShowFromSuggestions(false);
                          }}
                        />
                      </div>
                      {/* Suggestions Dropdown */}
                      {showToSuggestions &&
                        filteredToSuggestions.length > 0 && (
                          <div className="absolute left-0 top-[95%] w-full md:w-[320px] bg-white border border-slate-100 rounded-b-2xl rounded-t-lg shadow-[0_12px_36px_rgba(0,0,0,0.12)] z-30 max-h-[320px] overflow-y-auto divide-y divide-slate-50">
                            {filteredToSuggestions.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setToStation(s.name);
                                  setToStationId(s.id);
                                  setShowToSuggestions(false);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50/50 flex items-center justify-between transition-colors border-l-4 border-transparent hover:border-primary cursor-pointer group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400 group-hover:bg-blue-100/50 group-hover:text-primary transition-colors">
                                    <MapPin className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-800">
                                      {s.name.toLowerCase().startsWith("ga")
                                        ? s.name
                                        : `Ga ${s.name}`}
                                    </p>
                                    <p className="text-xs text-slate-400 font-semibold">
                                      {s.city}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[11px] font-bold bg-slate-50 text-slate-500 px-2 py-1 rounded-md border border-slate-100 group-hover:bg-blue-50 group-hover:text-primary group-hover:border-blue-200 transition-colors">
                                  {s.code}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Ngày Đi / Ngày Về Container */}
                  <div
                    className={`col-span-1 text-left ${tripType === "round-trip" ? "md:col-span-2" : "md:col-span-1"}`}
                  >
                    {tripType === "one-way" ? (
                      <div className="flex flex-col gap-xs text-left w-full">
                        <div className="flex justify-between items-center">
                          <label className="font-label-md text-label-md text-secondary">
                            Ngày Đi
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setTripType("round-trip");
                              setReturnDate(getNextDay(departureDate));
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary-container cursor-pointer transition-colors"
                            title="Chọn vé khứ hồi"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            <span>Khứ hồi?</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-xs px-md py-sm border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all bg-white h-[48px]">
                          <Calendar className="h-5 w-5 text-primary shrink-0" />
                          <input
                            className="w-full border-none p-0 focus:ring-0 font-body-md bg-transparent text-on-surface outline-none cursor-pointer text-xs font-semibold"
                            type="date"
                            min={getTodayDateStr()}
                            value={departureDate}
                            onChange={(e) => {
                              setDepartureDate(e.target.value);
                              if (returnDate && returnDate < e.target.value) {
                                setReturnDate(e.target.value);
                              }
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-md w-full">
                        {/* Ngày Đi */}
                        <div className="col-span-1 flex flex-col gap-xs text-left">
                          <label className="font-label-md text-label-md text-secondary">
                            Ngày Đi
                          </label>
                          <div className="flex items-center gap-xs px-md py-sm border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all bg-white h-[48px]">
                            <Calendar className="h-5 w-5 text-primary shrink-0" />
                            <input
                              className="w-full border-none p-0 focus:ring-0 font-body-md bg-transparent text-on-surface outline-none cursor-pointer text-xs font-semibold"
                              type="date"
                              min={getTodayDateStr()}
                              value={departureDate}
                              onChange={(e) => {
                                setDepartureDate(e.target.value);
                                if (returnDate && returnDate < e.target.value) {
                                  setReturnDate(e.target.value);
                                }
                              }}
                            />
                          </div>
                        </div>

                        {/* Ngày Về */}
                        <div className="col-span-1 flex flex-col gap-xs text-left relative">
                          <div className="flex justify-between items-center">
                            <label className="font-label-md text-label-md text-secondary">
                              Ngày Về
                            </label>
                            <button
                              type="button"
                              onClick={() => setTripType("one-way")}
                              className="text-slate-400 hover:text-red-500 transition-colors font-bold text-xs cursor-pointer"
                              title="Hủy khứ hồi"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-xs px-md py-sm border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all bg-white h-[48px]">
                            <Calendar className="h-5 w-5 text-primary shrink-0" />
                            <input
                              className="w-full border-none p-0 focus:ring-0 font-body-md bg-transparent text-on-surface outline-none cursor-pointer text-xs font-semibold"
                              type="date"
                              min={departureDate || getTodayDateStr()}
                              value={returnDate}
                              onChange={(e) => setReturnDate(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="bg-primary-container text-white h-[48px] rounded-xl font-label-md text-label-md font-bold shadow-[0px_8px_24px_rgba(0,163,255,0.3)] hover:scale-[1.02] active:scale-95 transition-all w-full flex items-center justify-center cursor-pointer md:col-span-1"
                  >
                    Tìm Chuyến Tàu
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Popular Routes ("Điểm Đến Phổ Biến") */}
      <section className="py-xl max-w-[1200px] mx-auto px-container-margin">
        <div className="flex justify-between items-end mb-lg text-left">
          <div>
            <span className="text-[12px] uppercase tracking-wider text-[#007aff] font-bold mb-1 block">
              Khám phá
            </span>
            <h2 className="font-headline-lg text-[28px] md:text-[32px] font-bold text-slate-800">
              Điểm đến phổ biến
            </h2>
          </div>
          <button
            onClick={() => handleRouteSelect("Hà Nội", "Sài Gòn")}
            className="text-primary font-bold flex items-center gap-xs hover:gap-sm transition-all"
          >
            Tất cả <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1 - Hà Nội (Large) */}
          <div
            className="group relative bg-slate-900 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-350 cursor-pointer h-[300px] md:h-auto"
            onClick={() => handleRouteSelect("Hà Nội", "Sài Gòn")}
          >
            <img
              className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
              alt="Hà Nội"
              src="/assets/hero-bg.jpg"
            />
            <div className="absolute bottom-0 left-0 p-6 text-left">
              <h3 className="font-bold text-2xl text-white mb-1">Hà Nội</h3>
              <p className="text-white/80 font-medium text-sm">
                Giá vé chỉ từ{" "}
                <span className="font-bold text-white">450.000đ</span>
              </p>
            </div>
          </div>

          {/* Right Side Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* TP.HCM */}
            <div
              className="group relative bg-slate-900 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-350 cursor-pointer h-[160px] md:h-[200px]"
              onClick={() => handleRouteSelect("Sài Gòn", "Hà Nội")}
            >
              <img
                className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                alt="TP HCM"
                src="/assets/hcmc.jpg"
              />
              <div className="absolute bottom-0 left-0 p-4 text-left">
                <h3 className="font-bold text-lg text-white mb-0.5">TP.HCM</h3>
                <p className="text-white/80 font-medium text-xs">
                  Chỉ từ <span className="font-bold text-[#007aff]">520k</span>
                </p>
              </div>
            </div>

            {/* Đà Nẵng */}
            <div
              className="group relative bg-slate-900 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-350 cursor-pointer h-[160px] md:h-[200px]"
              onClick={() => handleRouteSelect("Đà Nẵng", "Huế")}
            >
              <img
                className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                alt="Đà Nẵng"
                src="/assets/danang.jpg"
              />
              <div className="absolute bottom-0 left-0 p-4 text-left">
                <h3 className="font-bold text-lg text-white mb-0.5">Đà Nẵng</h3>
                <p className="text-white/80 font-medium text-xs">
                  Chỉ từ <span className="font-bold text-[#007aff]">350k</span>
                </p>
              </div>
            </div>

            {/* Huế */}
            <div
              className="group relative bg-slate-900 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-350 cursor-pointer col-span-2 h-[160px] md:h-[200px]"
              onClick={() => handleRouteSelect("Huế", "Đà Nẵng")}
            >
              <img
                className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                alt="Huế"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQ5Xajf7mAtz_KfO6j1nNYU6Gl2Ny9UHhksIUer32EoNV1qzgM2acR7OEP0_kY6Cc6PrObB4TX0XxzDiMlOdRMFu8JCnqcymHMAR23ph0FbYkpOUVAZtiQJlASOaO5FxY7XoJsHnOGMTZ12aI_ra4iVxJKlXfYbbCBK6iEoVggaPh5YjxE7dN_nK8F4L2-SsIHKYiSgOWhqhAZ4f-hA00jGPe3D0SqY3jvxGiQN-CWWjFzfRVKDopprohqOGCVMq78EiVhNDfqskkX"
              />
              <div className="absolute bottom-0 left-0 p-4 text-left">
                <h3 className="font-bold text-lg text-white mb-0.5">Huế</h3>
                <p className="text-white/80 font-medium text-xs">
                  Chỉ từ <span className="font-bold text-[#007aff]">280k</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Promotions Section */}
      <section className="bg-[#f7f9fb] py-xl">
        <div className="max-w-[1200px] mx-auto px-container-margin text-center">
          <h2 className="font-headline-lg text-[28px] md:text-[32px] font-bold text-slate-800 mb-lg">
            Ưu đãi hấp dẫn
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            {/* Promo Card 1 */}
            <div className="bg-[#007aff] p-8 rounded-3xl text-white flex justify-between items-center relative overflow-hidden shadow-sm">
              <div className="relative z-10 w-full">
                <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold mb-4 inline-block uppercase tracking-wider">
                  Welcome
                </span>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Giảm 20% cho người mới
                </h3>
                <p className="text-white/80 text-sm mb-6 max-w-[80%]">
                  Áp dụng cho lần đặt vé đầu tiên trên ứng dụng GoTrain VN.
                </p>
                <button
                  onClick={() => handleCopyVoucher("GOTRAINV20")}
                  className="bg-white text-[#007aff] px-6 py-2.5 rounded-full font-bold text-sm hover:bg-slate-50 transition active:scale-95 cursor-pointer"
                >
                  Nhận mã ngay
                </button>
              </div>
              <Ticket className="h-24 w-24 text-white opacity-20 absolute -right-2 top-1/2 -translate-y-1/2 shrink-0" />
            </div>

            {/* Promo Card 2 */}
            <div className="bg-white p-8 rounded-3xl flex justify-between items-center relative overflow-hidden shadow-sm border border-slate-100">
              <div className="relative z-10 w-full text-slate-800">
                <span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-bold mb-4 inline-block uppercase tracking-wider text-slate-500">
                  Cashback
                </span>
                <h3 className="text-2xl font-bold mb-2">
                  Hoàn tiền ví điện tử
                </h3>
                <p className="text-slate-500 text-sm mb-6 max-w-[80%]">
                  Hoàn đến 50k khi thanh toán qua ví MoMo, ZaloPay, ShopeePay.
                </p>
                <button
                  onClick={() => handleCopyVoucher("GOTRAIN50K")}
                  className="bg-[#005bb5] text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-[#004a94] transition active:scale-95 cursor-pointer"
                >
                  Khám phá
                </button>
              </div>
              <Wallet className="h-24 w-24 text-[#007aff] opacity-10 absolute -right-2 top-1/2 -translate-y-1/2 shrink-0" />
            </div>
          </div>
        </div>
      </section>

      {/* 5. System Advantages */}
      <section className="bg-white py-xl">
        <div className="max-w-[1200px] mx-auto px-container-margin">
          <div className="text-center mb-12">
            <h2 className="text-[28px] md:text-[32px] font-bold text-slate-800 mb-4">
              Tại sao chọn GoTrain?
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto">
              Chúng tôi mang đến giải pháp đặt vé tàu hiện đại, nhanh chóng và
              an toàn nhất cho mọi hành trình của bạn.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-8 bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
                <Zap className="h-6 w-6 text-slate-700" />
              </div>
              <h3 className="font-bold text-lg mb-3">Thanh toán tức thì</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Xác nhận vé ngay lập tức sau khi thanh toán thành công qua nhiều
                phương thức linh hoạt.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-8 bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
                <Headphones className="h-6 w-6 text-slate-700" />
              </div>
              <h3 className="font-bold text-lg mb-3">Hỗ trợ tận tâm</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Đội ngũ chăm sóc khách hàng 24/7 luôn sẵn sàng giải quyết mọi
                thắc mắc và sự cố của bạn.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-8 bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
                <Tag className="h-6 w-6 text-slate-700" />
              </div>
              <h3 className="font-bold text-lg mb-3">Giá tốt nhất</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Cam kết giá vé minh bạch, không phí ẩn và luôn có các chương
                trình ưu đãi độc quyền.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Customer Feedback */}
      <section className="py-xl bg-surface-container-lowest">
        <div className="max-w-[1200px] mx-auto px-container-margin">
          <div className="text-center mb-xl">
            <h2 className="font-headline-lg text-primary">
              Khách Hàng Nói Gì?
            </h2>
            <div className="flex justify-center gap-xs mt-sm text-primary-container">
              <Star className="h-5 w-5 fill-current text-primary-container" />
              <Star className="h-5 w-5 fill-current text-primary-container" />
              <Star className="h-5 w-5 fill-current text-primary-container" />
              <Star className="h-5 w-5 fill-current text-primary-container" />
              <Star className="h-5 w-5 fill-current text-primary-container" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
            {/* Feedback 1 */}
            <div className="bg-white p-lg rounded-[24px] shadow-sm border border-surface-container text-left flex flex-col justify-between">
              <p className="text-on-surface-variant italic font-body-md mb-lg text-sm">
                "Ứng dụng tuyệt vời, giao diện rất mượt và dễ sử dụng. Mình đã
                đặt vé thành công chỉ trong 2 phút."
              </p>
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded-full bg-secondary-fixed flex items-center justify-center text-primary font-bold text-sm">
                  VA
                </div>
                <div>
                  <h4 className="font-bold text-sm text-on-surface">
                    Nguyễn Văn An
                  </h4>
                  <p className="text-[10px] text-secondary uppercase tracking-tighter">
                    Hành khách thân thiết
                  </p>
                </div>
              </div>
            </div>

            {/* Feedback 2 */}
            <div className="bg-white p-lg rounded-[24px] shadow-sm border border-surface-container text-left flex flex-col justify-between">
              <p className="text-on-surface-variant italic font-body-md mb-lg text-sm">
                "Tôi thích cách GoTrain hiển thị lộ trình tàu chạy. Rất chuyên
                nghiệp và hiện đại hơn hẳn các nền tảng khác."
              </p>
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded-full bg-secondary-fixed flex items-center justify-center text-primary font-bold text-sm">
                  LM
                </div>
                <div>
                  <h4 className="font-bold text-sm text-on-surface">
                    Lê Thị Mai
                  </h4>
                  <p className="text-[10px] text-secondary uppercase tracking-tighter">
                    Doanh nhân
                  </p>
                </div>
              </div>
            </div>

            {/* Feedback 3 */}
            <div className="bg-white p-lg rounded-[24px] shadow-sm border border-surface-container text-left flex flex-col justify-between">
              <p className="text-on-surface-variant italic font-body-md mb-lg text-sm">
                "Hỗ trợ viên rất nhiệt tình khi mình cần đổi vé. Một trải nghiệm
                dịch vụ khách hàng đáng khen ngợi."
              </p>
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded-full bg-secondary-fixed flex items-center justify-center text-primary font-bold text-sm">
                  TT
                </div>
                <div>
                  <h4 className="font-bold text-sm text-on-surface">
                    Trần Minh Tâm
                  </h4>
                  <p className="text-[10px] text-secondary uppercase tracking-tighter">
                    Du khách tự túc
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Testimonials Section */}
      <section className="py-xl bg-[#f7f9fb]">
        <div className="max-w-[1200px] mx-auto px-container-margin">
          <div className="text-center mb-12">
            <h2 className="text-[28px] md:text-[32px] font-bold text-slate-800">
              Khách hàng nói gì về GoTrain
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Testimonial 1 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm text-left relative flex flex-col justify-between">
              <div>
                <div className="flex gap-1 text-[#007aff] mb-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-slate-600 italic text-sm leading-relaxed mb-8">
                  "Ứng dụng tuyệt vời, giao diện rất dễ sử dụng và đặt vé chỉ
                  mất chưa đầy 3 phút. Tôi rất hài lòng với dịch vụ chăm sóc
                  khách hàng."
                </p>
              </div>
              <div className="flex items-center gap-3 mt-auto">
                <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                  <img
                    src="https://i.pravatar.cc/150?img=1"
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">
                    Nguyễn Minh Anh
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Nhân viên văn phòng
                  </p>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm text-left relative flex flex-col justify-between">
              <div>
                <div className="flex gap-1 text-[#007aff] mb-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-slate-600 italic text-sm leading-relaxed mb-8">
                  "GoTrain giúp việc đi du lịch bằng tàu hỏa trở nên sang trọng
                  và tiện lợi hơn bao giờ hết. Lịch trình rõ ràng, thanh toán an
                  toàn."
                </p>
              </div>
              <div className="flex items-center gap-3 mt-auto">
                <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                  <img
                    src="https://i.pravatar.cc/150?img=11"
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">
                    Trần Hoàng Nam
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Nhiếp ảnh gia tự do
                  </p>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm text-left relative flex flex-col justify-between">
              <div>
                <div className="flex gap-1 text-[#007aff] mb-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-slate-600 italic text-sm leading-relaxed mb-8">
                  "Rất ấn tượng với tính năng hoàn tiền qua ví điện tử. Tiết
                  kiệm được một khoản kha khá cho các chuyến đi thường xuyên."
                </p>
              </div>
              <div className="flex items-center gap-3 mt-auto">
                <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                  <img
                    src="https://i.pravatar.cc/150?img=5"
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">
                    Lê Thu Trang
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Sinh viên đại học
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="w-full bg-[#f7f9fb] py-16 text-left border-t border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 px-container-margin max-w-[1200px] mx-auto">
          <div className="flex flex-col gap-4 col-span-2">
            <div className="flex items-center gap-2 text-[#007aff] font-bold text-xl">
              <Train className="h-6 w-6" />
              GoTrain VN
            </div>
            <p className="text-slate-500 text-sm max-w-sm mt-2">
              © 2024 GoTrain VN. Hành trình bình yên, kết nối mọi miền.
              <br />
              Ứng dụng đặt vé tàu hỏa hàng đầu Việt Nam.
            </p>
            <div className="flex gap-4 mt-2">
              <button className="text-slate-400 hover:text-slate-700 transition-colors">
                <span className="font-bold text-xs">FB</span>
              </button>
              <button className="text-slate-400 hover:text-slate-700 transition-colors">
                <span className="font-bold text-xs">YT</span>
              </button>
              <button className="text-slate-400 hover:text-slate-700 transition-colors">
                <span className="font-bold text-xs">IN</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-2">
              Khám phá
            </h4>
            <a
              className="text-slate-500 hover:text-[#007aff] transition-colors text-sm underline decoration-slate-300 underline-offset-4"
              href="#"
            >
              Chính sách bảo mật
            </a>
            <a
              className="text-slate-500 hover:text-[#007aff] transition-colors text-sm underline decoration-slate-300 underline-offset-4"
              href="#"
            >
              Điều khoản sử dụng
            </a>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-2">
              Hỗ trợ
            </h4>
            <a
              className="text-slate-500 hover:text-[#007aff] transition-colors text-sm underline decoration-slate-300 underline-offset-4"
              href="#"
            >
              Thông tin liên hệ
            </a>
            <a
              className="text-slate-500 hover:text-[#007aff] transition-colors text-sm underline decoration-slate-300 underline-offset-4"
              href="#"
            >
              Hướng dẫn đặt vé
            </a>
          </div>
        </div>
      </footer>

      {/* 8. Bottom Nav for Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-surface-container flex justify-around items-center py-sm z-50 shadow-lg">
        <button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            toast.info("Trang Chủ");
          }}
          className="flex flex-col items-center gap-1 text-primary cursor-pointer"
        >
          <HomeIcon className="h-5 w-5" />
          <span className="text-[10px] font-bold">Trang Chủ</span>
        </button>

        <button
          onClick={() => {
            navigate("/schedule");
            toast.info("Đang mở Lịch Trình...");
          }}
          className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary cursor-pointer transition-colors"
        >
          <CalendarDays className="h-5 w-5" />
          <span className="text-[10px]">Lịch Trình</span>
        </button>

        <button
          onClick={() => {
            navigate("/dashboard");
            toast.info("Đang mở Vé Của Tôi...");
          }}
          className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary cursor-pointer transition-colors"
        >
          <Ticket className="h-5 w-5" />
          <span className="text-[10px]">Vé Của Tôi</span>
        </button>

        <button
          onClick={() => {
            navigate("/dashboard");
            toast.info("Đang mở Cá Nhân...");
          }}
          className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary cursor-pointer transition-colors"
        >
          <UserIcon className="h-5 w-5" />
          <span className="text-[10px]">Cá Nhân</span>
        </button>
      </div>
    </div>
  );
}

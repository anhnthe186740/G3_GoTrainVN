import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  QrCode,
  Camera,
  CameraOff,
  CheckCircle2,
  XCircle,
  User,
  Ticket,
  Train,
  AlertTriangle,
  RotateCcw,
  Keyboard,
  ListTodo,
  Undo2,
} from "lucide-react";
import { staffSearchApi } from "../../services/staffSearchApi";
import { toast } from "sonner";

const SESSION_STORAGE_KEY = "gotrain_checkin_logs";
const UNDO_WINDOW_MS = 5 * 60 * 1000; // 5 phút

function loadLogsFromSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function StaffTicketCheckInPanel() {
  const [ticketCodeInput, setTicketCodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [undoing, setUndoing] = useState(false);
  const [, forceRerender] = useState(0); // để cập nhật countdown hoàn tác

  // Camera scanning states
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");

  // Session logs — persist vào sessionStorage (#12)
  const [sessionLogs, setSessionLogs] = useState(loadLogsFromSession);

  const qrCodeRef = useRef(null);
  const cameraTriggeredRef = useRef(false); // track xem scan từ camera hay nhập tay
  const autoRestartTimerRef = useRef(null);

  // Đồng bộ sessionLogs vào sessionStorage mỗi khi thay đổi (#12)
  useEffect(() => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionLogs));
  }, [sessionLogs]);

  // Cập nhật countdown undo mỗi 10 giây
  useEffect(() => {
    if (!result?.success) return;
    const interval = setInterval(() => forceRerender((n) => n + 1), 10_000);
    return () => clearInterval(interval);
  }, [result]);

  // Dọn dẹp timer khi unmount
  useEffect(() => {
    return () => {
      if (autoRestartTimerRef.current)
        clearTimeout(autoRestartTimerRef.current);
      if (qrCodeRef.current) {
        qrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const playBeep = (type) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      if (type === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.06);
        setTimeout(() => {
          try {
            const ctx2 = new AudioCtx();
            const osc2 = ctx2.createOscillator();
            const g2 = ctx2.createGain();
            osc2.connect(g2);
            g2.connect(ctx2.destination);
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(800, ctx2.currentTime);
            g2.gain.setValueAtTime(0.08, ctx2.currentTime);
            osc2.start();
            osc2.stop(ctx2.currentTime + 0.1);
          } catch {}
        }, 80);
      } else {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {}
  };

  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices?.length > 0) {
          setCameras(devices);
          setSelectedCameraId(devices[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleStartScan = async () => {
    if (!selectedCameraId) {
      toast.error("Vui lòng chọn camera trước khi bắt đầu.");
      return;
    }
    setResult(null);
    const html5QrCode = new Html5Qrcode("reader");
    qrCodeRef.current = html5QrCode;
    try {
      setIsScanning(true);
      await html5QrCode.start(
        selectedCameraId,
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.7;
            return { width: size, height: size };
          },
        },
        (decodedText) => {
          cameraTriggeredRef.current = true;
          handleCheckInTicket(decodedText);
          handleStopScan();
        },
        () => {},
      );
    } catch (err) {
      console.error("Camera startup failed", err);
      toast.error(
        "Không thể khởi động camera. Vui lòng cấp quyền truy cập máy ảnh.",
      );
      setIsScanning(false);
      qrCodeRef.current = null;
    }
  };

  const handleStopScan = async () => {
    if (qrCodeRef.current) {
      try {
        await qrCodeRef.current.stop();
      } catch {}
      qrCodeRef.current = null;
    }
    setIsScanning(false);
  };

  // #8: Auto-restart camera sau khi soát xong (nếu được kích hoạt từ camera)
  const scheduleAutoRestart = () => {
    if (!cameraTriggeredRef.current) return;
    if (autoRestartTimerRef.current) clearTimeout(autoRestartTimerRef.current);
    autoRestartTimerRef.current = setTimeout(() => {
      setResult(null);
      cameraTriggeredRef.current = false;
      handleStartScan();
    }, 20000);
  };

  const handleCheckInTicket = async (code) => {
    const ticketCode = (code || "").trim().toUpperCase();
    if (!ticketCode) {
      toast.error("Mã vé trống, không thể soát vé.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await staffSearchApi.checkIn(ticketCode);

      if (res.data?.success) {
        const ticketData = res.data.ticket;
        setResult({
          success: true,
          data: ticketData,
          checkInAt: Date.now(), // timestamp để tính còn bao lâu có thể undo
        });
        playBeep("success");
        toast.success("Soát vé thành công!");

        setSessionLogs((prev) => [
          {
            id: Date.now(),
            ticketCode: ticketData.ticketCode,
            fullName: ticketData.fullName,
            seatNumber: ticketData.seatNumber,
            carriageNumber: ticketData.carriageNumber,
            trainCode: ticketData.trainCode,
            status: "SUCCESS",
            time: new Date().toISOString(),
          },
          ...prev.slice(0, 49), // giữ tối đa 50 entry (#12)
        ]);

        scheduleAutoRestart();
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message || "Lỗi soát vé. Vui lòng thử lại.";
      setResult({ success: false, error: errMsg });
      playBeep("error");
      toast.error("Soát vé thất bại!");

      setSessionLogs((prev) => [
        {
          id: Date.now(),
          ticketCode,
          fullName: "Không rõ",
          seatNumber: "N/A",
          carriageNumber: "N/A",
          trainCode: "N/A",
          status: "FAILED",
          error: errMsg,
          time: new Date().toISOString(),
        },
        ...prev.slice(0, 49),
      ]);

      scheduleAutoRestart();
    } finally {
      setLoading(false);
      setTicketCodeInput("");
    }
  };

  // #5: Hoàn tác soát vé
  const handleUndo = async () => {
    if (!result?.success || !result.data?.ticketCode) return;
    setUndoing(true);
    try {
      await staffSearchApi.undoCheckIn(result.data.ticketCode);
      toast.success("Đã hoàn tác soát vé thành công.");
      setResult(null);
      setSessionLogs((prev) =>
        prev.map((log) =>
          log.ticketCode === result.data.ticketCode && log.status === "SUCCESS"
            ? { ...log, status: "UNDONE" }
            : log,
        ),
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Không thể hoàn tác. Vui lòng thử lại.",
      );
    } finally {
      setUndoing(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    cameraTriggeredRef.current = false;
    if (autoRestartTimerRef.current) {
      clearTimeout(autoRestartTimerRef.current);
      autoRestartTimerRef.current = null;
    }
    if (isScanning) handleStopScan();
    handleCheckInTicket(ticketCodeInput);
  };

  const handleClearResult = () => {
    if (autoRestartTimerRef.current) {
      clearTimeout(autoRestartTimerRef.current);
      autoRestartTimerRef.current = null;
    }
    cameraTriggeredRef.current = false;
    setResult(null);
  };

  const formatDateTime = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const undoSecondsLeft =
    result?.success && result.checkInAt
      ? Math.max(
          0,
          Math.ceil((UNDO_WINDOW_MS - (Date.now() - result.checkInAt)) / 1000),
        )
      : 0;
  const canUndo = undoSecondsLeft > 0;

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-[#191c1e]">
          <QrCode className="h-7 w-7 text-[#00629d]" />
          Soát Vé Lên Tàu (QR Code Check-in)
        </h2>
        <p className="mt-1 text-sm font-medium text-[#6f7883]">
          Quét mã QR hoặc nhập mã vé. Camera tự động khởi động lại sau mỗi lần
          soát.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Left: camera + input */}
        <div className="space-y-6">
          <div className="space-y-5 rounded-2xl border border-[#bec7d4]/30 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-800">
              <Camera className="h-4 w-4 text-[#00629d]" />
              Máy quét QR &amp; Nhập liệu
            </h3>

            {/* Viewport */}
            <div className="relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#bec7d4]/50 bg-slate-900 text-white">
              {isScanning && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <div className="relative flex h-48 w-48 items-center justify-center rounded-3xl border-4 border-emerald-500 sm:h-60 sm:w-60">
                    <div className="absolute left-0 right-0 h-1 animate-bounce bg-emerald-400 shadow-[0_0_15px_#10b981]" />
                    <span className="absolute -left-1 -top-1 h-6 w-6 rounded-tl-xl border-l-4 border-t-4 border-emerald-400" />
                    <span className="absolute -right-1 -top-1 h-6 w-6 rounded-tr-xl border-r-4 border-t-4 border-emerald-400" />
                    <span className="absolute -bottom-1 -left-1 h-6 w-6 rounded-bl-xl border-b-4 border-l-4 border-emerald-400" />
                    <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-br-xl border-b-4 border-r-4 border-emerald-400" />
                  </div>
                </div>
              )}
              <div id="reader" className="h-full w-full object-cover" />
              {!isScanning && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center space-y-3 bg-slate-950/90 p-6 text-center">
                  <span className="material-symbols-outlined animate-pulse text-6xl text-[#00629d]/80">
                    qr_code_scanner
                  </span>
                  <p className="text-sm font-bold">Máy ảnh đang tắt</p>
                  <p className="max-w-xs text-xs leading-5 text-slate-400">
                    Kích hoạt camera để quét trực tiếp mã QR trên vé.
                  </p>
                </div>
              )}
            </div>

            {/* Camera controls */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <select
                  disabled={isScanning || cameras.length === 0}
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  className="w-full cursor-pointer rounded-xl border border-[#bec7d4]/60 bg-white px-3 py-2.5 text-xs font-semibold outline-none transition focus:border-[#00629d] focus:ring-4 focus:ring-[#cfe5ff] disabled:opacity-55"
                >
                  {cameras.length === 0 ? (
                    <option value="">Không tìm thấy camera</option>
                  ) : (
                    cameras.map((cam) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label || `Camera ${cameras.indexOf(cam) + 1}`}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <button
                type="button"
                onClick={isScanning ? handleStopScan : handleStartScan}
                disabled={cameras.length === 0}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-none px-5 py-2.5 text-xs font-bold transition-all disabled:opacity-50 ${
                  isScanning
                    ? "bg-red-50 text-red-700 hover:bg-red-100/70"
                    : "bg-[#00629d] text-white hover:bg-[#00527f]"
                }`}
              >
                {isScanning ? (
                  <>
                    <CameraOff className="h-4 w-4" />
                    Dừng camera
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    Bật camera quét
                  </>
                )}
              </button>
            </div>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-[#bec7d4]/20" />
              <span className="mx-4 flex-shrink text-xs font-bold text-slate-400">
                HOẶC
              </span>
              <div className="flex-grow border-t border-[#bec7d4]/20" />
            </div>

            {/* Manual input */}
            <form onSubmit={handleManualSubmit} className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Keyboard className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  value={ticketCodeInput}
                  onChange={(e) => setTicketCodeInput(e.target.value)}
                  placeholder="Nhập mã vé thủ công (ví dụ: GT-ABC123XYZ)"
                  className="w-full rounded-xl border border-[#bec7d4]/60 py-2.5 pl-9 pr-4 text-xs font-bold uppercase outline-none transition placeholder:font-medium focus:border-[#00629d] focus:ring-4 focus:ring-[#cfe5ff]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="cursor-pointer rounded-xl border-none bg-[#071a2b] px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-[#0f2a43] disabled:opacity-60"
              >
                {loading ? "Đang soát..." : "Soát vé"}
              </button>
            </form>
          </div>
        </div>

        {/* Right: result */}
        <div className="space-y-6">
          <div className="flex min-h-[300px] flex-col justify-between rounded-2xl border border-[#bec7d4]/30 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-800">
              <Ticket className="h-4 w-4 text-[#00629d]" />
              Chi tiết soát vé
            </h3>

            {loading && (
              <div className="flex flex-grow flex-col items-center justify-center space-y-3 py-10">
                <span className="material-symbols-outlined animate-spin text-4xl text-[#00629d]">
                  sync
                </span>
                <p className="text-xs font-bold text-slate-500">
                  Đang đối soát dữ liệu...
                </p>
              </div>
            )}

            {!loading && !result && (
              <div className="flex flex-grow flex-col items-center justify-center space-y-2.5 py-16 text-center">
                <QrCode className="h-12 w-12 stroke-[1.5] text-[#bec7d4]" />
                <p className="text-xs font-bold text-slate-600">Chờ soát vé</p>
                <p className="max-w-[200px] text-[11px] leading-relaxed text-slate-400">
                  Quét vé bằng camera hoặc nhập mã vé để bắt đầu.
                </p>
              </div>
            )}

            {!loading && result?.success && (
              <div className="flex-grow space-y-4 pt-3">
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
                  <div>
                    <h4 className="text-sm font-extrabold uppercase tracking-wide text-emerald-800">
                      Vé Hợp Lệ — Check-in OK!
                    </h4>
                    <p className="mt-0.5 text-xs font-semibold text-emerald-600">
                      Đã ghi nhận soát vé và cho phép hành khách lên toa.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  {[
                    {
                      label: "HÀNH KHÁCH:",
                      value: result.data.fullName,
                      icon: <User className="h-3.5 w-3.5 text-slate-400" />,
                    },
                    {
                      label: "MÃ VÉ:",
                      value: result.data.ticketCode,
                      mono: true,
                    },
                    {
                      label: "CCCD / HỘ CHIẾU:",
                      value: result.data.nationalId,
                    },
                    { label: "ĐỐI TƯỢNG:", value: result.data.passengerType },
                  ].map(({ label, value, icon, mono }) => (
                    <div
                      key={label}
                      className="flex justify-between border-b border-slate-100 pb-1.5"
                    >
                      <span className="font-bold text-[#6f7883]">{label}</span>
                      <span
                        className={`flex items-center gap-1 text-right font-extrabold ${mono ? "font-mono text-[#00629d]" : "text-[#191c1e]"}`}
                      >
                        {icon}
                        {value}
                      </span>
                    </div>
                  ))}

                  <div className="my-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-slate-200/40 bg-[#f2f4f6] p-2.5 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        Toa tàu
                      </p>
                      <p className="mt-0.5 text-lg font-extrabold text-slate-800">
                        {result.data.carriageNumber}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#00629d]/10 bg-[#cfe5ff]/50 p-2.5 text-center">
                      <p className="text-[10px] font-bold uppercase text-[#00629d]">
                        Số ghế
                      </p>
                      <p className="mt-0.5 text-lg font-extrabold text-[#00629d]">
                        {result.data.seatNumber}
                      </p>
                    </div>
                  </div>

                  {[
                    {
                      label: "MÃ CHUYẾN TÀU:",
                      value: result.data.trainCode,
                      icon: <Train className="h-3.5 w-3.5 text-slate-400" />,
                    },
                    { label: "TUYẾN ĐƯỜNG:", value: result.data.routeName },
                    {
                      label: "GIỜ CHẠY GỐC:",
                      value: formatDateTime(result.data.departureTime),
                    },
                    {
                      label: "ĐÃ SOÁT VÀO LÚC:",
                      value: formatDateTime(result.data.boardingAt),
                      green: true,
                    },
                  ].map(({ label, value, icon, green }) => (
                    <div
                      key={label}
                      className="flex justify-between border-b border-slate-100 pb-1.5"
                    >
                      <span className="font-bold text-[#6f7883]">{label}</span>
                      <span
                        className={`flex items-center gap-1 font-extrabold ${green ? "text-emerald-600" : "text-slate-700"}`}
                      >
                        {icon}
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* #5: Nút hoàn tác soát vé */}
                {canUndo && (
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={undoing}
                    className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    {undoing
                      ? "Đang hoàn tác..."
                      : `Hoàn tác soát vé (còn ${Math.floor(undoSecondsLeft / 60)}:${String(undoSecondsLeft % 60).padStart(2, "0")})`}
                  </button>
                )}
              </div>
            )}

            {!loading && result && !result.success && (
              <div className="flex-grow space-y-4 pt-3">
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                  <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
                  <div>
                    <h4 className="text-sm font-extrabold uppercase tracking-wide text-red-800">
                      Vé Không Hợp Lệ!
                    </h4>
                    <p className="mt-0.5 text-xs font-semibold text-red-600">
                      Từ chối khách lên tàu và yêu cầu kiểm tra lại vé.
                    </p>
                  </div>
                </div>
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <AlertTriangle className="mx-auto h-7 w-7 text-amber-600" />
                  <p className="text-xs font-bold leading-5 text-[#ba1a1a]">
                    {result.error}
                  </p>
                </div>
              </div>
            )}

            {result && (
              <button
                type="button"
                onClick={handleClearResult}
                className="mt-4 flex w-full cursor-pointer items-center justify-center gap-1 rounded-xl border-none bg-slate-100 py-3 text-xs font-bold text-[#00629d] transition-all hover:bg-[#cfe5ff]/50 hover:text-[#00527f]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Quét vé tiếp theo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Session logs (#12) */}
      <div className="space-y-4 rounded-2xl border border-[#bec7d4]/30 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-800">
            <ListTodo className="h-4 w-4 text-[#00629d]" />
            Lịch sử soát vé phiên làm việc
          </h3>
          {sessionLogs.length > 0 && (
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
                setSessionLogs([]);
              }}
              className="cursor-pointer rounded-lg border-none bg-transparent px-2 py-1 text-[11px] font-bold text-slate-400 hover:text-red-600"
            >
              Xóa lịch sử
            </button>
          )}
        </div>

        {sessionLogs.length === 0 ? (
          <p className="py-6 text-center text-xs italic text-slate-400">
            Chưa soát vé nào trong phiên làm việc hiện tại.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#bec7d4]/20 bg-slate-50 font-bold text-slate-600">
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Mã vé</th>
                  <th className="px-4 py-3">Hành khách</th>
                  <th className="px-4 py-3">Chuyến</th>
                  <th className="px-4 py-3">Vị trí ghế</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {sessionLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="transition-colors hover:bg-slate-50/60"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                      {new Date(log.time).toLocaleTimeString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-[#00629d]">
                      {log.ticketCode}
                    </td>
                    <td className="px-4 py-3 text-slate-800">{log.fullName}</td>
                    <td className="px-4 py-3">{log.trainCode}</td>
                    <td className="px-4 py-3">
                      Toa {log.carriageNumber} · Ghế {log.seatNumber}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {log.status === "SUCCESS" && (
                        <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          THÀNH CÔNG
                        </span>
                      )}
                      {log.status === "FAILED" && (
                        <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          LỖI
                        </span>
                      )}
                      {log.status === "UNDONE" && (
                        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          ĐÃ HOÀN TÁC
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 font-medium italic text-slate-400">
                      {log.status === "SUCCESS" &&
                        "Soát vé và lên tàu thành công"}
                      {log.status === "UNDONE" && "Đã hoàn tác soát vé"}
                      {log.status === "FAILED" && (
                        <span className="text-red-500">{log.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

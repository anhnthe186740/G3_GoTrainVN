import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  QrCode,
  Camera,
  CameraOff,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Ticket,
  Train,
  AlertTriangle,
  RotateCcw,
  Keyboard,
  ListTodo,
} from "lucide-react";
import { api } from "../../services/api";
import { toast } from "sonner";

export function StaffTicketCheckInPanel() {
  const [ticketCodeInput, setTicketCodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { success: true/false, data: ticketDetails, error: string }

  // Camera scanning states
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");

  // History logs of current session
  const [sessionLogs, setSessionLogs] = useState([]);

  const qrCodeRef = useRef(null);

  // Web Audio API Sound Generator for Offline Premium Beeps
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
        // Double positive high beep
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.06);

        setTimeout(() => {
          try {
            const ctx2 = new AudioCtx();
            const osc2 = ctx2.createOscillator();
            const gainNode2 = ctx2.createGain();
            osc2.connect(gainNode2);
            gainNode2.connect(ctx2.destination);
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(800, ctx2.currentTime);
            gainNode2.gain.setValueAtTime(0.08, ctx2.currentTime);
            osc2.start();
            osc2.stop(ctx2.currentTime + 0.1);
          } catch {}
        }, 80);
      } else {
        // Low buzz beep for errors
        osc.type = "triangle";
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn(
        "Web Audio API not supported/allowed by browser autoplay policy",
        e,
      );
    }
  };

  // Get available cameras on component mount
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          setSelectedCameraId(devices[0].id);
        }
      })
      .catch((err) => {
        console.warn("No camera devices found or permission denied.", err);
      });

    return () => {
      // Clean up scanning if component unmounts
      if (qrCodeRef.current) {
        qrCodeRef.current
          .stop()
          .catch((e) => console.error("Error stopping scanner on unmount", e));
      }
    };
  }, []);

  // Start Camera Scanning
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
          // QR Code Scanned successfully
          handleCheckInTicket(decodedText);
          handleStopScan();
        },
        () => {
          // Silent callback for frame scanning errors
        },
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

  // Stop Camera Scanning
  const handleStopScan = async () => {
    if (qrCodeRef.current) {
      try {
        await qrCodeRef.current.stop();
      } catch (err) {
        console.error("Error stopping camera", err);
      }
      qrCodeRef.current = null;
    }
    setIsScanning(false);
  };

  // API Call for check-in
  const handleCheckInTicket = async (code) => {
    const ticketCode = (code || "").trim().toUpperCase();
    if (!ticketCode) {
      toast.error("Mã vé trống, không thể soát vé.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await api.post("/staff/check-in", { ticketCode });

      if (res.data?.success) {
        const ticketData = res.data.ticket;
        setResult({
          success: true,
          data: ticketData,
        });
        playBeep("success");
        toast.success("Soát vé thành công!");

        // Add to session logs
        setSessionLogs((prev) => [
          {
            id: Date.now(),
            ticketCode: ticketData.ticketCode,
            fullName: ticketData.fullName,
            seatNumber: ticketData.seatNumber,
            carriageNumber: ticketData.carriageNumber,
            trainCode: ticketData.trainCode,
            status: "SUCCESS",
            time: new Date(),
          },
          ...prev.slice(0, 9), // Keep last 10 entries
        ]);
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message || "Lỗi soát vé. Vui lòng thử lại.";
      setResult({
        success: false,
        error: errMsg,
      });
      playBeep("error");
      toast.error("Soát vé thất bại!");

      // Add to session logs
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
          time: new Date(),
        },
        ...prev.slice(0, 9),
      ]);
    } finally {
      setLoading(false);
      setTicketCodeInput("");
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (isScanning) {
      handleStopScan();
    }
    handleCheckInTicket(ticketCodeInput);
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

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-[#191c1e] tracking-tight flex items-center gap-2">
          <QrCode className="h-7 w-7 text-[#00629d]" />
          Soát Vé Lên Tàu (QR Code Check-in)
        </h2>
        <p className="text-sm font-medium text-[#6f7883] mt-1">
          Quét mã QR soát vé tại cửa toa để kiểm tra tính hợp lệ và cho phép
          hành khách lên tàu.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Left Column: Viewport & Inputs */}
        <div className="space-y-6">
          {/* Main Working Card */}
          <div className="bg-white border border-[#bec7d4]/30 rounded-2xl p-5 shadow-sm space-y-5">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <Camera className="h-4 w-4 text-[#00629d]" />
              Máy quét QR & Nhập liệu
            </h3>

            {/* Video Viewport / Simulator area */}
            <div className="relative border-2 border-dashed border-[#bec7d4]/50 rounded-2xl overflow-hidden bg-slate-900 aspect-video flex flex-center flex-col items-center justify-center text-white">
              {/* Target Scan Frame overlay */}
              {isScanning && (
                <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 sm:w-60 sm:h-60 border-4 border-emerald-500 rounded-3xl relative flex items-center justify-center">
                    {/* Laser Scanner Line */}
                    <div className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_15px_#10b981] animate-[bounce_2s_infinite]"></div>
                    {/* Corners */}
                    <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl -translate-x-1 -translate-y-1"></span>
                    <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl translate-x-1 -translate-y-1"></span>
                    <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl -translate-x-1 translate-y-1"></span>
                    <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl translate-x-1 translate-y-1"></span>
                  </div>
                </div>
              )}

              {/* Html5Qrcode video node */}
              <div id="reader" className="w-full h-full object-cover"></div>

              {/* Placeholder when not scanning */}
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-950/90 z-20">
                  <span className="material-symbols-outlined text-6xl text-[#00629d]/80 animate-pulse">
                    qr_code_scanner
                  </span>
                  <p className="font-bold text-sm">Máy ảnh đang tắt</p>
                  <p className="text-xs text-slate-400 max-w-xs leading-5">
                    Kích hoạt camera để quét trực tiếp mã QR in trên vé của hành
                    khách.
                  </p>
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <select
                  disabled={isScanning || cameras.length === 0}
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  className="w-full border border-[#bec7d4]/60 rounded-xl px-3 py-2.5 text-xs font-semibold focus:border-[#00629d] focus:ring-4 focus:ring-[#cfe5ff] outline-none bg-white cursor-pointer transition disabled:opacity-55"
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
                className={`flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs transition-all border-none cursor-pointer disabled:opacity-50 ${
                  isScanning
                    ? "bg-red-50 hover:bg-red-100/70 text-red-700"
                    : "bg-[#00629d] hover:bg-[#00527f] text-white"
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

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-[#bec7d4]/20"></div>
              <span className="flex-shrink mx-4 text-xs font-bold text-slate-400">
                HOẶC
              </span>
              <div className="flex-grow border-t border-[#bec7d4]/20"></div>
            </div>

            {/* Manual entry form */}
            <form onSubmit={handleManualSubmit} className="flex gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Keyboard className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  value={ticketCodeInput}
                  onChange={(e) => setTicketCodeInput(e.target.value)}
                  placeholder="Nhập mã vé thủ công (ví dụ: GT-ABC123XYZ)"
                  className="w-full border border-[#bec7d4]/60 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold focus:border-[#00629d] focus:ring-4 focus:ring-[#cfe5ff] outline-none transition placeholder:font-medium uppercase"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-[#071a2b] hover:bg-[#0f2a43] text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all border-none cursor-pointer disabled:opacity-60"
              >
                {loading ? "Đang soát..." : "Soát vé"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Scan Result & Realtime details */}
        <div className="space-y-6">
          {/* Scan result Card */}
          <div className="bg-white border border-[#bec7d4]/30 rounded-2xl p-5 shadow-sm min-h-[300px] flex flex-col justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <Ticket className="h-4 w-4 text-[#00629d]" />
              Chi tiết soát vé
            </h3>

            {loading && (
              <div className="flex-grow flex flex-col items-center justify-center py-10 space-y-3">
                <span className="material-symbols-outlined text-4xl animate-spin text-[#00629d]">
                  sync
                </span>
                <p className="text-xs font-bold text-slate-500">
                  Đang đối soát dữ liệu...
                </p>
              </div>
            )}

            {!loading && !result && (
              <div className="flex-grow flex flex-col items-center justify-center py-16 text-center space-y-2.5">
                <QrCode className="h-12 w-12 text-[#bec7d4] stroke-[1.5]" />
                <p className="font-bold text-slate-600 text-xs">Chờ soát vé</p>
                <p className="text-[11px] text-slate-400 max-w-[200px] leading-relaxed">
                  Vui lòng quét vé bằng camera hoặc nhập mã vé để bắt đầu soát
                  vé hành khách.
                </p>
              </div>
            )}

            {!loading && result && result.success && (
              <div className="flex-grow space-y-4 pt-3">
                {/* Success Indicator Card */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-extrabold text-emerald-800 uppercase tracking-wide">
                      Vé Hợp Lệ - Check-in OK!
                    </h4>
                    <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                      Đã ghi nhận soát vé và cho phép hành khách lên toa.
                    </p>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[#6f7883] font-bold">
                      HÀNH KHÁCH:
                    </span>
                    <span className="font-extrabold text-[#191c1e] text-right flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      {result.data.fullName}
                    </span>
                  </div>

                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[#6f7883] font-bold">
                      MÃ VÉ (CODE):
                    </span>
                    <span className="font-extrabold text-[#00629d] font-mono">
                      {result.data.ticketCode}
                    </span>
                  </div>

                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[#6f7883] font-bold">
                      CCCD / HỘ CHIẾU:
                    </span>
                    <span className="font-bold text-slate-700">
                      {result.data.nationalId}
                    </span>
                  </div>

                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[#6f7883] font-bold">ĐỐI TƯỢNG:</span>
                    <span className="font-bold text-slate-700">
                      {result.data.passengerType}
                    </span>
                  </div>

                  {/* Seat bento block */}
                  <div className="grid grid-cols-2 gap-2 my-3">
                    <div className="bg-[#f2f4f6] rounded-lg p-2.5 text-center border border-slate-200/40">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        Toa tàu
                      </p>
                      <p className="text-lg font-extrabold text-slate-800 mt-0.5">
                        {result.data.carriageNumber}
                      </p>
                    </div>
                    <div className="bg-[#cfe5ff]/50 rounded-lg p-2.5 text-center border border-[#00629d]/10">
                      <p className="text-[10px] text-[#00629d] font-bold uppercase">
                        Số ghế
                      </p>
                      <p className="text-lg font-extrabold text-[#00629d] mt-0.5">
                        {result.data.seatNumber}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[#6f7883] font-bold">
                      MÃ CHUYẾN TÀU:
                    </span>
                    <span className="font-extrabold text-[#191c1e] flex items-center gap-1">
                      <Train className="h-3.5 w-3.5 text-slate-400" />
                      {result.data.trainCode}
                    </span>
                  </div>

                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[#6f7883] font-bold">
                      TUYẾN ĐƯỜNG:
                    </span>
                    <span className="font-bold text-slate-700 text-right">
                      {result.data.routeName}
                    </span>
                  </div>

                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[#6f7883] font-bold">
                      GIỜ CHẠY GỐC:
                    </span>
                    <span className="font-bold text-slate-700">
                      {formatDateTime(result.data.departureTime)}
                    </span>
                  </div>

                  <div className="flex justify-between pb-1.5">
                    <span className="text-[#6f7883] font-bold">
                      ĐÃ SOÁT VÀO LÚC:
                    </span>
                    <span className="font-extrabold text-emerald-600">
                      {formatDateTime(result.data.boardingAt)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!loading && result && !result.success && (
              <div className="flex-grow space-y-4 pt-3">
                {/* Error Banner */}
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <XCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-extrabold text-red-800 uppercase tracking-wide">
                      Vé Không Hợp Lệ!
                    </h4>
                    <p className="text-xs text-red-600 font-semibold mt-0.5">
                      Từ chối khách lên tàu và yêu cầu kiểm tra lại vé.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center space-y-2">
                  <AlertTriangle className="h-7 w-7 text-amber-600 mx-auto" />
                  <p className="text-xs font-bold text-[#ba1a1a] leading-5">
                    {result.error}
                  </p>
                </div>
              </div>
            )}

            {/* Clear / Next scan button */}
            {result && (
              <button
                type="button"
                onClick={() => setResult(null)}
                className="mt-4 flex w-full items-center justify-center gap-1 text-xs font-bold text-[#00629d] hover:text-[#00527f] bg-slate-100 hover:bg-[#cfe5ff]/50 py-3 rounded-xl transition-all border-none cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Quét vé tiếp theo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Session log history */}
      <div className="bg-white border border-[#bec7d4]/30 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
          <ListTodo className="h-4 w-4 text-[#00629d]" />
          Lịch sử soát vé phiên làm việc (Gần nhất)
        </h3>

        {sessionLogs.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6">
            Chưa soát vé nào trong phiên làm việc hiện tại.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-[#bec7d4]/20 font-bold text-slate-600">
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Mã vé</th>
                  <th className="px-4 py-3">Hành khách</th>
                  <th className="px-4 py-3">Chuyến</th>
                  <th className="px-4 py-3">Vị trí ghế</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Thông tin chi tiết / lỗi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {sessionLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {log.time.toLocaleTimeString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 font-bold font-mono text-[#00629d]">
                      {log.ticketCode}
                    </td>
                    <td className="px-4 py-3 text-slate-800">{log.fullName}</td>
                    <td className="px-4 py-3">{log.trainCode}</td>
                    <td className="px-4 py-3">
                      Toa {log.carriageNumber} · Ghế {log.seatNumber}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {log.status === "SUCCESS" ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold text-[10px]">
                          THÀNH CÔNG
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded font-bold text-[10px]">
                          LỖI
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-medium italic truncate max-w-xs">
                      {log.status === "SUCCESS" ? (
                        "Soát vé và lên tàu thành công"
                      ) : (
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

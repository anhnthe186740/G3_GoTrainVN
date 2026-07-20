import { Link, useNavigate } from "react-router-dom";

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f7f9fb] to-[#e8f4ff] flex items-center justify-center px-6">
      <div className="text-center max-w-lg">
        {/* Animated train icon */}
        <div className="relative mb-8">
          <div className="text-[120px] font-extrabold text-[#e8f0f7] select-none leading-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center border border-[#bec7d4]/30">
              <span className="material-symbols-outlined text-4xl text-[#00629d]">
                train
              </span>
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-[#191c1e] mb-3">
          Chuyến tàu này không tồn tại!
        </h1>
        <p className="text-[#6f7883] text-base leading-relaxed mb-8">
          Trang bạn đang tìm không tồn tại hoặc đã bị xóa. Có thể chuyến tàu đã
          rời ga rồi! 🚂
        </p>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link
            to="/"
            className="flex items-center justify-center gap-2 bg-[#00629d] hover:bg-[#00629d]/90 text-white font-bold py-3 rounded-2xl transition-all shadow-md hover:shadow-lg"
          >
            <span className="material-symbols-outlined text-[20px]">home</span>
            Trang Chủ
          </Link>
          <Link
            to="/tra-cuu-ve"
            className="flex items-center justify-center gap-2 bg-white border border-[#bec7d4]/40 hover:border-[#00629d]/40 text-[#00629d] font-bold py-3 rounded-2xl transition-all shadow-sm hover:shadow-md"
          >
            <span className="material-symbols-outlined text-[20px]">
              qr_code_2
            </span>
            Tra Cứu Vé
          </Link>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="text-sm text-[#6f7883] hover:text-[#00629d] font-semibold transition-colors flex items-center gap-1.5 mx-auto"
        >
          <span className="material-symbols-outlined text-[16px]">
            arrow_back
          </span>
          Quay lại trang trước
        </button>
      </div>
    </div>
  );
}

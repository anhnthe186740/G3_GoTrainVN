import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const QUICK_PROMPTS = [
  "Quy định hoàn vé?",
  "Giữ ghế được bao lâu?",
  "Cần giấy tờ gì khi lên tàu?",
  "Cách nạp tiền ví điện tử?",
];

export function ChatbotWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    // Khôi phục lịch sử chat trong session hiện tại để có trải nghiệm liền mạch
    const saved = sessionStorage.getItem("gotrain_chat_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Lỗi parse chat history:", e);
      }
    }
    return [
      {
        id: "welcome",
        sender: "bot",
        text: `Xin chào${user ? ` ${user.fullName || user.username}` : ""}! Tôi là Trợ lý ảo AI của GoTrain VN. Tôi có thể giúp gì cho bạn hôm nay?`,
        createdAt: new Date().toISOString(),
      },
    ];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // VỊ TRÍ VÀ KÉO RÊ BONG BÓNG CHAT (DRAGGABLE)
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem("gotrain_chatbot_position");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    // Vị trí mặc định ở góc dưới bên phải
    return { x: window.innerWidth - 80, y: window.innerHeight - 100 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isMovedRef = useRef(false);

  // Lưu vị trí khi thay đổi
  useEffect(() => {
    localStorage.setItem("gotrain_chatbot_position", JSON.stringify(position));
  }, [position]);

  // Điều chỉnh vị trí nếu màn hình bị co giãn để không bị bay ra ngoài
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const maxX = window.innerWidth - 70;
        const maxY = window.innerHeight - 70;
        return {
          x: Math.min(Math.max(10, prev.x), maxX),
          y: Math.min(Math.max(10, prev.y), maxY),
        };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Chỉ kéo bằng chuột trái
    setIsDragging(true);
    isMovedRef.current = false;
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e) => {
    isMovedRef.current = true;
    const maxX = window.innerWidth - 70;
    const maxY = window.innerHeight - 70;
    const newX = Math.min(
      Math.max(10, e.clientX - dragStartRef.current.x),
      maxX,
    );
    const newY = Math.min(
      Math.max(10, e.clientY - dragStartRef.current.y),
      maxY,
    );
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    isMovedRef.current = false;
    dragStartRef.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    };
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
  };

  const handleTouchMove = (e) => {
    isMovedRef.current = true;
    const touch = e.touches[0];
    const maxX = window.innerWidth - 70;
    const maxY = window.innerHeight - 70;
    const newX = Math.min(
      Math.max(10, touch.clientX - dragStartRef.current.x),
      maxX,
    );
    const newY = Math.min(
      Math.max(10, touch.clientY - dragStartRef.current.y),
      maxY,
    );
    setPosition({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    document.removeEventListener("touchmove", handleTouchMove);
    document.removeEventListener("touchend", handleTouchEnd);
  };

  const handleButtonClick = (e) => {
    if (isMovedRef.current) {
      e.preventDefault();
      return;
    }
    setIsOpen(true);
  };

  // Lắng nghe sự kiện để mở chatbot từ các nút điều hướng khác (ví dụ: nút robot ở Admin Dashboard)
  useEffect(() => {
    const handleOpenChatbot = () => setIsOpen(true);
    window.addEventListener("open-chatbot", handleOpenChatbot);
    return () => window.removeEventListener("open-chatbot", handleOpenChatbot);
  }, []);

  // Cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    // Lưu lịch sử vào sessionStorage
    sessionStorage.setItem("gotrain_chat_history", JSON.stringify(messages));
  }, [messages, isOpen]);

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query || query.trim() === "") return;

    if (!textToSend) setInput("");

    // Thêm tin nhắn của User vào list
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await api.post("/chatbot", { message: query });
      if (response.data?.success) {
        const botReply = {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: response.data.data.reply,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, botReply]);
      } else {
        throw new Error(response.data?.message || "Lỗi không xác định");
      }
    } catch (error) {
      console.error("Lỗi gửi tin nhắn chatbot:", error);
      const errorMsg = {
        id: `error-${Date.now()}`,
        sender: "bot",
        text: "Xin lỗi, hiện tại tôi đang gặp khó khăn khi kết nối với máy chủ. Vui lòng thử lại sau ít phút!",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChatHistory = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa lịch sử trò chuyện này?")) {
      const defaultWelcome = [
        {
          id: "welcome",
          sender: "bot",
          text: `Xin chào${user ? ` ${user.fullName || user.username}` : ""}! Tôi là Trợ lý ảo AI của GoTrain VN. Lịch sử chat đã được làm sạch. Tôi có thể hỗ trợ gì thêm cho bạn?`,
          createdAt: new Date().toISOString(),
        },
      ];
      setMessages(defaultWelcome);
      sessionStorage.setItem(
        "gotrain_chat_history",
        JSON.stringify(defaultWelcome),
      );
      toast.success("Đã làm sạch lịch sử trò chuyện.");
    }
  };

  // Xác định xem có nên ẩn bong bóng mặc định không (nếu đang ở trang Admin hoặc Staff)
  const isDashboard =
    window.location.pathname.includes("/admin") ||
    window.location.pathname.includes("/staff");

  return (
    <>
      {/* Bong bóng Chat nổi (Draggable) */}
      {!isOpen && !isDashboard && (
        <div
          style={{
            position: "fixed",
            left: `${position.x}px`,
            top: `${position.y}px`,
            zIndex: 9999,
            touchAction: "none",
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="select-none"
        >
          {/* Double radiating radar waves (tỏa rộng và mượt) */}
          <div
            className="absolute inset-0 bg-[#007aff]/20 rounded-full scale-125 animate-ping-ripples"
            style={{ animationDelay: "0s" }}
          />
          <div
            className="absolute inset-0 bg-[#00629d]/15 rounded-full scale-125 animate-ping-ripples"
            style={{ animationDelay: "0.8s" }}
          />

          <button
            onClick={handleButtonClick}
            className="relative w-16 h-16 bg-white rounded-full shadow-[0_8px_32px_rgba(0,102,157,0.25)] flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-200 border-none cursor-grab active:cursor-grabbing overflow-hidden p-1.5"
            title="Kéo để di chuyển - Click để trò chuyện"
          >
            {/* Bo tròn ảnh robot hoàn toàn bằng rounded-full và object-cover */}
            <img
              src="/assets/chatbot.png"
              alt="GoTrain AI Chatbot Logo"
              className="w-full h-full object-cover rounded-full select-none pointer-events-none animate-scale-pulse"
            />
          </button>

          {/* Nhấp nháy chấm xanh online tỏa rộng bắt mắt - ĐẶT NGOÀI BUTTON ĐỂ KHÔNG BỊ OVERFLOW CHE KHUẤT */}
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-ping z-10" />
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white z-10 shadow-sm" />
        </div>
      )}

      {/* Khung cửa sổ Chat AI */}
      {isOpen && (
        <div className="fixed bottom-24 right-8 z-[9999] w-[380px] md:w-[420px] h-[580px] bg-white/95 backdrop-blur-md rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#00629d] to-[#007aff] px-6 py-4 text-white flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center border border-white/15 shadow-md p-1">
                <img
                  src="/assets/chatbot.png"
                  alt="GoTrain Bot"
                  className="w-9 h-9 object-contain"
                />
              </div>
              <div className="text-left">
                <h3 className="font-extrabold text-sm tracking-wide flex items-center gap-1.5">
                  Trợ Lý Ảo GoTrain
                  <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-white/80 font-medium">
                    Trực tuyến
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={clearChatHistory}
                className="w-8 h-8 rounded-xl hover:bg-white/15 flex items-center justify-center transition-colors text-white/80 hover:text-white border-none cursor-pointer"
                title="Xóa lịch sử chat"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-xl hover:bg-white/15 flex items-center justify-center transition-colors text-white border-none cursor-pointer"
                title="Đóng chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 flex flex-col bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[88%] ${msg.sender === "user" ? "self-end flex-row-reverse" : "self-start"}`}
              >
                {/* Sleek, Premium Avatar logos (non-stretching) */}
                <div
                  className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold shadow-sm self-start ${
                    msg.sender === "user"
                      ? "bg-gradient-to-tr from-[#00b4db] to-[#0083b0] text-white ring-2 ring-cyan-100"
                      : "bg-white ring-2 ring-blue-100 p-0.5"
                  }`}
                >
                  {msg.sender === "user" ? (
                    <User className="w-5 h-5" />
                  ) : (
                    <img
                      src="/assets/chatbot.png"
                      alt="Bot"
                      className="w-8 h-8 object-contain"
                    />
                  )}
                </div>
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm text-left ${
                    msg.sender === "user"
                      ? "bg-[#007aff] text-white rounded-tr-none font-medium"
                      : "bg-white text-slate-700 border border-slate-100 rounded-tl-none whitespace-pre-wrap"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {loading && (
              <div className="flex gap-3 max-w-[88%] self-start">
                <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center bg-white ring-2 ring-blue-100 p-0.5 shadow-sm self-start">
                  <img
                    src="/assets/chatbot.png"
                    alt="Bot"
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <div className="rounded-2xl rounded-tl-none px-4 py-3 bg-white border border-slate-100 text-slate-400 text-xs italic flex items-center gap-2 shadow-sm">
                  <span className="font-medium text-slate-500">
                    Trợ lý đang nhập
                  </span>
                  <span className="flex gap-1 items-center">
                    <span
                      className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex gap-2 overflow-x-auto scrollbar-none shrink-0 text-left">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                disabled={loading}
                className="bg-white hover:bg-[#007aff]/5 hover:text-[#007aff] border border-slate-200 text-slate-600 text-[11px] px-3.5 py-1.5 rounded-full transition-all cursor-pointer font-semibold whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className="p-4 border-t border-slate-100 bg-white flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={loading}
              placeholder="Nhập câu hỏi của bạn..."
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#007aff]/50 focus:bg-white rounded-xl text-sm transition-all disabled:opacity-50 shadow-inner"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="w-10.5 h-10.5 bg-[#007aff] hover:bg-[#00629d] disabled:bg-slate-100 text-white rounded-xl flex items-center justify-center transition-all cursor-pointer disabled:text-slate-400 border-none shrink-0 shadow-md"
              title="Gửi câu hỏi"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Train,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useLanguage } from "../context/LanguageContext";

export function Login() {
  const { language } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const scriptId = "google-gsi-client";
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.id = scriptId;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    const initializeGoogle = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleGoogleLogin,
        });
        window.google.accounts.id.renderButton(
          document.getElementById("google-signin-btn"),
          { theme: "outline", size: "large", width: 384 },
        );
      }
    };

    script.onload = initializeGoogle;
    if (window.google) {
      initializeGoogle();
    }
  }, [language]);

  const handleGoogleLogin = async (response) => {
    setLoading(true);
    const toastId = toast.loading(
      language === "vi"
        ? "Đang đăng nhập bằng tài khoản Google..."
        : "Logging in with Google...",
    );
    try {
      const res = await api.post("/auth/google-login", {
        credential: response.credential,
      });
      const { user, token } = res.data;

      setAuth({ user, token });

      toast.success(
        language === "vi"
          ? `Chào mừng trở lại, ${user.name}!`
          : `Welcome back, ${user.name}!`,
        { id: toastId },
      );
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        (language === "vi"
          ? "Đăng nhập bằng Google thất bại. Vui lòng thử lại!"
          : "Google login failed. Please try again!");
      toast.error(errorMsg, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    const toastId = toast.loading(
      language === "vi"
        ? "Đang xác thực thông tin đăng nhập..."
        : "Authenticating login details...",
    );
    try {
      const response = await api.post("/auth/login", data);
      const { user, token } = response.data;

      // Save to Zustand auth store
      setAuth({ user, token });

      toast.success(
        language === "vi"
          ? `Chào mừng trở lại, ${user.name}!`
          : `Welcome back, ${user.name}!`,
        { id: toastId },
      );
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        (language === "vi"
          ? "Đăng nhập thất bại. Vui lòng kiểm tra lại!"
          : "Login failed. Please verify your credentials!");
      toast.error(errorMsg, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-left">
      {/* Brand presentation banner on desktop */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white lg:flex">
        {/* Decorative background gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-emerald-950 opacity-90" />
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />

        {/* Content */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-500/30">
            <Train className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-wider">GoTrain VN</span>
        </div>

        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {language === "vi"
              ? "Hệ thống đặt vé tàu trực tuyến "
              : "Online Train Booking System "}
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              GoTrain VN
            </span>
          </h1>
          <p className="text-lg text-slate-300">
            {language === "vi"
              ? "Trải nghiệm dịch vụ đặt vé thế hệ mới với giao diện trực quan, sơ đồ toa tàu thời gian thực và phương thức ví điện tử tiện lợi."
              : "Experience a new era of train booking with our intuitive interface, real-time cabin maps, and smooth wallet payments."}
          </p>

          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-sm font-medium text-slate-200">
                {language === "vi"
                  ? "Đồng bộ sơ đồ ghế thời gian thực bằng Socket.io"
                  : "Real-time seat layout synced via Socket.io"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-sm font-medium text-slate-200">
                {language === "vi"
                  ? "Tích hợp ví điện tử, nạp rút nhanh chóng"
                  : "E-wallet integration with fast deposits & withdrawals"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-sm font-medium text-slate-200">
                {language === "vi"
                  ? "Định vị trực tiếp lộ trình chạy tàu giả lập"
                  : "Live positioning of simulated train routes"}
              </span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-slate-400">
          © {new Date().getFullYear()} GoTrain VN.{" "}
          {language === "vi"
            ? "Thiết kế giao diện Modern UI Redesign."
            : "Modern UI Redesign interface."}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col justify-center px-4 py-12 sm:px-6 lg:w-1/2 lg:px-8 bg-slate-50">
        <div className="mx-auto w-full max-w-md space-y-8">
          {/* Logo on mobile */}
          <div className="flex flex-col items-center lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/30">
              <Train className="h-7 w-7 text-white" />
            </div>
            <h2 className="mt-4 text-center text-3xl font-extrabold tracking-tight text-slate-900">
              GoTrain VN
            </h2>
          </div>

          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              {language === "vi" ? "Đăng nhập" : "Sign In"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {language === "vi"
                ? "Chào mừng bạn trở lại! Vui lòng nhập thông tin tài khoản."
                : "Welcome back! Please enter your account credentials."}
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Email Input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                {language === "vi" ? "Địa chỉ Email" : "Email Address"}
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  disabled={loading}
                  {...register("email", {
                    required:
                      language === "vi"
                        ? "Email là bắt buộc"
                        : "Email is required",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message:
                        language === "vi"
                          ? "Địa chỉ email không hợp lệ"
                          : "Invalid email address",
                    },
                  })}
                  placeholder="name@example.com"
                  className={`block w-full rounded-xl border ${
                    errors.email
                      ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                      : "border-slate-300 focus:border-slate-900 focus:ring-slate-200"
                  } bg-white py-3 pl-10 pr-4 text-slate-900 outline-none transition focus:ring-4`}
                />
              </div>
              {errors.email && (
                <p className="text-xs font-medium text-red-600 mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">
                  {language === "vi" ? "Mật khẩu" : "Password"}
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-semibold text-blue-600 hover:text-blue-500 transition text-decoration-none"
                >
                  {language === "vi" ? "Quên mật khẩu?" : "Forgot password?"}
                </Link>
              </div>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  disabled={loading}
                  {...register("password", {
                    required:
                      language === "vi"
                        ? "Mật khẩu là bắt buộc"
                        : "Password is required",
                  })}
                  placeholder="••••••••"
                  className={`block w-full rounded-xl border ${
                    errors.password
                      ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                      : "border-slate-300 focus:border-slate-900 focus:ring-slate-200"
                  } bg-white py-3 pl-10 pr-10 text-slate-900 outline-none transition focus:ring-4`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition border-none bg-transparent cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs font-medium text-red-600 mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label
                htmlFor="remember-me"
                className="ml-2 block text-sm font-medium text-slate-700 select-none cursor-pointer"
              >
                {language === "vi" ? "Ghi nhớ đăng nhập" : "Remember me"}
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 py-3.5 text-sm font-semibold text-white transition focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:opacity-75 shadow-md shadow-slate-900/10 cursor-pointer border-none"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {language === "vi" ? "Đang xử lý..." : "Processing..."}
                </>
              ) : (
                <>
                  {language === "vi" ? "Đăng nhập" : "Sign In"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Social login */}
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm font-medium">
                <span className="bg-slate-50 px-3 text-slate-500">
                  {language === "vi"
                    ? "Hoặc tiếp tục bằng"
                    : "Or continue with"}
                </span>
              </div>
            </div>

            <div
              className="flex justify-center w-full min-h-[46px]"
              id="google-signin-container"
            >
              <div
                id="google-signin-btn"
                className="w-full flex justify-center"
              ></div>
            </div>
          </div>

          <p className="text-center text-sm font-medium text-slate-600">
            {language === "vi"
              ? "Chưa có tài khoản? "
              : "Don't have an account? "}
            <Link
              to="/register"
              className="font-semibold text-blue-600 hover:text-blue-500 transition text-decoration-none"
            >
              {language === "vi" ? "Đăng ký ngay" : "Register now"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

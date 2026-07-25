import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Train,
  ArrowRight,
  Loader2,
  User,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useLanguage } from "../context/LanguageContext";

export function Register() {
  const { language } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      fullName: "",
      phoneNumber: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const watchPassword = watch("password");

  const calculatePasswordStrength = (pass) => {
    if (!pass) {
      return {
        score: 0,
        label: language === "vi" ? "Trống" : "Empty",
        color: "bg-slate-200",
      };
    }
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) {
      return {
        score,
        label: language === "vi" ? "Yếu" : "Weak",
        color: "bg-red-500 w-1/3",
      };
    }
    if (score <= 4) {
      return {
        score,
        label: language === "vi" ? "Trung bình" : "Medium",
        color: "bg-amber-500 w-2/3",
      };
    }
    return {
      score,
      label: language === "vi" ? "Mạnh" : "Strong",
      color: "bg-emerald-500 w-full",
    };
  };

  const strength = calculatePasswordStrength(watchPassword);

  const onSubmit = async (data) => {
    setLoading(true);
    const toastId = toast.loading(
      language === "vi"
        ? "Đang tạo tài khoản mới..."
        : "Creating new account...",
    );
    try {
      // Remove confirmPassword before sending to server
      const { confirmPassword, ...registerData } = data;
      await api.post("/auth/register", registerData);

      toast.success(
        language === "vi"
          ? "Tạo tài khoản thành công! Đang chuyển hướng..."
          : "Account created successfully! Redirecting...",
        { id: toastId },
      );
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        (language === "vi"
          ? "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin!"
          : "Registration failed. Please verify your details!");
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
            {language === "vi" ? "Tham gia cùng chúng tôi" : "Join us at"}{" "}
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              GoTrain VN
            </span>
          </h1>
          <p className="text-lg text-slate-300">
            {language === "vi"
              ? "Tạo tài khoản hôm nay để bắt đầu chuyến hành trình nhanh chóng, tiện lợi và tiết kiệm nhất."
              : "Create an account today to start your journey in the fastest, most convenient, and affordable way."}
          </p>

          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-medium text-slate-200">
                {language === "vi"
                  ? "Đặt chỗ nhanh trong 3 bước"
                  : "Quick booking in 3 steps"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-medium text-slate-200">
                {language === "vi"
                  ? "Ví điện tử nạp/rút không mất phí"
                  : "E-wallet deposits & withdrawals with zero fees"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-medium text-slate-200">
                {language === "vi"
                  ? "Nhiều ưu đãi đặc biệt cho Sinh viên & Người già"
                  : "Special discounts for Students & Seniors"}
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
              {language === "vi" ? "Tạo tài khoản" : "Create Account"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {language === "vi"
                ? "Nhập đầy đủ thông tin cá nhân của bạn dưới đây để bắt đầu đăng ký."
                : "Enter your personal details below to register."}
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {/* Full Name Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                {language === "vi" ? "Họ và tên" : "Full name"}
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-4.5 w-4.5 text-slate-400" />
                </div>
                <input
                  type="text"
                  disabled={loading}
                  {...register("fullName", {
                    required:
                      language === "vi"
                        ? "Họ và tên là bắt buộc"
                        : "Full name is required",
                    minLength: {
                      value: 3,
                      message:
                        language === "vi"
                          ? "Họ và tên phải dài tối thiểu 3 kí tự"
                          : "Full name must be at least 3 characters",
                    },
                  })}
                  placeholder="Nguyễn Văn A"
                  className={`block w-full rounded-xl border ${
                    errors.fullName
                      ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                      : "border-slate-300 focus:border-slate-900 focus:ring-slate-200"
                  } bg-white py-2.5 pl-9 pr-4 text-slate-900 text-sm outline-none transition focus:ring-4`}
                />
              </div>
              {errors.fullName && (
                <p className="text-[11px] font-medium text-red-600 mt-1">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            {/* Phone Number Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                {language === "vi" ? "Số điện thoại" : "Phone number"}
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Phone className="h-4.5 w-4.5 text-slate-400" />
                </div>
                <input
                  type="tel"
                  disabled={loading}
                  {...register("phoneNumber", {
                    required:
                      language === "vi"
                        ? "Số điện thoại là bắt buộc"
                        : "Phone number is required",
                    pattern: {
                      value: /(84|0[3|5|7|8|9])+([0-9]{8})\b/g,
                      message:
                        language === "vi"
                          ? "Số điện thoại Việt Nam không hợp lệ"
                          : "Invalid phone number format",
                    },
                  })}
                  placeholder="0912345678"
                  className={`block w-full rounded-xl border ${
                    errors.phoneNumber
                      ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                      : "border-slate-300 focus:border-slate-900 focus:ring-slate-200"
                  } bg-white py-2.5 pl-9 pr-4 text-slate-900 text-sm outline-none transition focus:ring-4`}
                />
              </div>
              {errors.phoneNumber && (
                <p className="text-[11px] font-medium text-red-600 mt-1">
                  {errors.phoneNumber.message}
                </p>
              )}
            </div>

            {/* Email Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                {language === "vi" ? "Địa chỉ Email" : "Email Address"}
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4.5 w-4.5 text-slate-400" />
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
                  } bg-white py-2.5 pl-9 pr-4 text-slate-900 text-sm outline-none transition focus:ring-4`}
                />
              </div>
              {errors.email && (
                <p className="text-[11px] font-medium text-red-600 mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                {language === "vi" ? "Mật khẩu" : "Password"}
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4.5 w-4.5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  disabled={loading}
                  {...register("password", {
                    required:
                      language === "vi"
                        ? "Mật khẩu là bắt buộc"
                        : "Password is required",
                    minLength: {
                      value: 8,
                      message:
                        language === "vi"
                          ? "Mật khẩu phải dài tối thiểu 8 kí tự"
                          : "Password must be at least 8 characters",
                    },
                  })}
                  placeholder={
                    language === "vi"
                      ? "Tối thiểu 8 kí tự"
                      : "At least 8 characters"
                  }
                  className={`block w-full rounded-xl border ${
                    errors.password
                      ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                      : "border-slate-300 focus:border-slate-900 focus:ring-slate-200"
                  } bg-white py-2.5 pl-9 pr-10 text-slate-900 text-sm outline-none transition focus:ring-4`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition border-none bg-transparent cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4.5 w-4.5" />
                  ) : (
                    <Eye className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
              {watchPassword && (
                <div className="space-y-1.5 pt-1">
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strength.color}`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>
                      {language === "vi" ? "Độ mạnh: " : "Strength: "}
                      <span className="font-semibold">{strength.label}</span>
                    </span>
                    <span>
                      {language === "vi"
                        ? "Yêu cầu: chữ hoa, chữ thường, số, kí tự đặc biệt"
                        : "Required: uppercase, lowercase, digit, special char"}
                    </span>
                  </div>
                </div>
              )}
              {errors.password && (
                <p className="text-[11px] font-medium text-red-600 mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                {language === "vi" ? "Xác nhận mật khẩu" : "Confirm Password"}
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4.5 w-4.5 text-slate-400" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  disabled={loading}
                  {...register("confirmPassword", {
                    required:
                      language === "vi"
                        ? "Vui lòng xác nhận mật khẩu"
                        : "Please confirm your password",
                    validate: (value) =>
                      value === watchPassword ||
                      (language === "vi"
                        ? "Mật khẩu xác nhận không khớp"
                        : "Passwords do not match"),
                  })}
                  placeholder={
                    language === "vi"
                      ? "Nhập lại mật khẩu"
                      : "Re-enter password"
                  }
                  className={`block w-full rounded-xl border ${
                    errors.confirmPassword
                      ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                      : "border-slate-300 focus:border-slate-900 focus:ring-slate-200"
                  } bg-white py-2.5 pl-9 pr-10 text-slate-900 text-sm outline-none transition focus:ring-4`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition border-none bg-transparent cursor-pointer"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4.5 w-4.5" />
                  ) : (
                    <Eye className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-[11px] font-medium text-red-600 mt-1">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Terms Agreement Checkbox */}
            <div className="flex items-start">
              <div className="flex h-5 items-center">
                <input
                  id="agree-terms"
                  type="checkbox"
                  required
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>
              <div className="ml-3 text-xs">
                <label
                  htmlFor="agree-terms"
                  className="font-medium text-slate-700 select-none cursor-pointer"
                >
                  {language === "vi" ? "Tôi đồng ý với " : "I agree to the "}
                  <Link
                    to="/terms"
                    className="font-semibold text-blue-600 hover:text-blue-500 transition text-decoration-none"
                  >
                    {language === "vi"
                      ? "Điều khoản dịch vụ"
                      : "Terms of Service"}
                  </Link>
                  {language === "vi" ? " và " : " and "}
                  <Link
                    to="/privacy"
                    className="font-semibold text-blue-600 hover:text-blue-500 transition text-decoration-none"
                  >
                    {language === "vi"
                      ? "Chính sách bảo mật"
                      : "Privacy Policy"}
                  </Link>
                  {language === "vi" ? " của GoTrain VN." : " of GoTrain VN."}
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 py-3 text-sm font-semibold text-white transition focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:opacity-75 shadow-md shadow-slate-900/10 cursor-pointer border-none"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                  {language === "vi" ? "Đang đăng ký..." : "Registering..."}
                </>
              ) : (
                <>
                  {language === "vi" ? "Đăng ký" : "Sign Up"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm font-medium text-slate-600">
            {language === "vi"
              ? "Đã có tài khoản? "
              : "Already have an account? "}
            <Link
              to="/login"
              className="font-semibold text-blue-600 hover:text-blue-500 transition text-decoration-none"
            >
              {language === "vi" ? "Đăng nhập ngay" : "Sign in now"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

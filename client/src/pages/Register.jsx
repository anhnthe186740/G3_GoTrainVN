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
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";

export function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
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
    if (!pass) return { score: 0, label: "Trống", color: "bg-slate-200" };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { score, label: "Yếu", color: "bg-red-500 w-1/3" };
    if (score <= 4)
      return { score, label: "Trung bình", color: "bg-amber-500 w-2/3" };
    return { score, label: "Mạnh", color: "bg-emerald-500 w-full" };
  };

  const strength = calculatePasswordStrength(watchPassword);

  const onSubmit = async (data) => {
    setLoading(true);
    const toastId = toast.loading("Đang tạo tài khoản mới...");
    try {
      // Remove confirmPassword before sending to server
      const { confirmPassword, ...registerData } = data;
      await api.post("/auth/register", registerData);

      toast.success("Tạo tài khoản thành công! Đang chuyển hướng...", {
        id: toastId,
      });
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin!";
      toast.error(errorMsg, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
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
            Tham gia cùng chúng tôi <br />
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              GoTrain VN
            </span>
          </h1>
          <p className="text-lg text-slate-300">
            Tạo tài khoản hôm nay để bắt đầu chuyến hành trình nhanh chóng, tiện
            lợi và tiết kiệm nhất.
          </p>

          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-medium text-slate-200">
                Đặt chỗ nhanh trong 3 bước
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-medium text-slate-200">
                Ví điện tử nạp/rút không mất phí
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-medium text-slate-200">
                Nhiều ưu đãi đặc biệt cho Sinh viên & Người già
              </span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-slate-400">
          © {new Date().getFullYear()} GoTrain VN. Thiết kế giao diện Modern UI
          Redesign.
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
              Tạo tài khoản
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Nhập đầy đủ thông tin cá nhân của bạn dưới đây để bắt đầu đăng ký.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {/* Full Name Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Họ và tên
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-4.5 w-4.5 text-slate-400" />
                </div>
                <input
                  type="text"
                  disabled={loading}
                  {...register("fullName", {
                    required: "Họ và tên là bắt buộc",
                    minLength: {
                      value: 3,
                      message: "Họ và tên phải dài tối thiểu 3 kí tự",
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
                <p className="text-[11px] font-medium text-red-600">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            {/* Phone Number Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Số điện thoại
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Phone className="h-4.5 w-4.5 text-slate-400" />
                </div>
                <input
                  type="tel"
                  disabled={loading}
                  {...register("phoneNumber", {
                    required: "Số điện thoại là bắt buộc",
                    pattern: {
                      value: /(84|0[3|5|7|8|9])+([0-9]{8})\b/g,
                      message: "Số điện thoại Việt Nam không hợp lệ",
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
                <p className="text-[11px] font-medium text-red-600">
                  {errors.phoneNumber.message}
                </p>
              )}
            </div>

            {/* Email Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Địa chỉ Email
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4.5 w-4.5 text-slate-400" />
                </div>
                <input
                  type="email"
                  disabled={loading}
                  {...register("email", {
                    required: "Email là bắt buộc",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Địa chỉ email không hợp lệ",
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
                <p className="text-[11px] font-medium text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Mật khẩu
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4.5 w-4.5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  disabled={loading}
                  {...register("password", {
                    required: "Mật khẩu là bắt buộc",
                    minLength: {
                      value: 8,
                      message: "Mật khẩu phải dài tối thiểu 8 kí tự",
                    },
                  })}
                  placeholder="Tối thiểu 8 kí tự"
                  className={`block w-full rounded-xl border ${
                    errors.password
                      ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                      : "border-slate-300 focus:border-slate-900 focus:ring-slate-200"
                  } bg-white py-2.5 pl-9 pr-10 text-slate-900 text-sm outline-none transition focus:ring-4`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition"
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
                      Độ mạnh:{" "}
                      <span className="font-semibold">{strength.label}</span>
                    </span>
                    <span>
                      Yêu cầu: chữ hoa, chữ thường, số, kí tự đặc biệt
                    </span>
                  </div>
                </div>
              )}
              {errors.password && (
                <p className="text-[11px] font-medium text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Xác nhận mật khẩu
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4.5 w-4.5 text-slate-400" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  disabled={loading}
                  {...register("confirmPassword", {
                    required: "Vui lòng xác nhận mật khẩu",
                    validate: (value) =>
                      value === watchPassword || "Mật khẩu xác nhận không khớp",
                  })}
                  placeholder="Nhập lại mật khẩu"
                  className={`block w-full rounded-xl border ${
                    errors.confirmPassword
                      ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                      : "border-slate-300 focus:border-slate-900 focus:ring-slate-200"
                  } bg-white py-2.5 pl-9 pr-10 text-slate-900 text-sm outline-none transition focus:ring-4`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4.5 w-4.5" />
                  ) : (
                    <Eye className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-[11px] font-medium text-red-600">
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
                  className="font-medium text-slate-700 select-none"
                >
                  Tôi đồng ý với{" "}
                  <Link
                    to="/terms"
                    className="font-semibold text-blue-600 hover:text-blue-500 transition"
                  >
                    Điều khoản dịch vụ
                  </Link>{" "}
                  và{" "}
                  <Link
                    to="/privacy"
                    className="font-semibold text-blue-600 hover:text-blue-500 transition"
                  >
                    Chính sách bảo mật
                  </Link>{" "}
                  của GoTrain VN.
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 py-3 text-sm font-semibold text-white transition focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:opacity-75 shadow-md shadow-slate-900/10 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Đang đăng ký...
                </>
              ) : (
                <>
                  Đăng ký
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm font-medium text-slate-600">
            Đã có tài khoản?{" "}
            <Link
              to="/login"
              className="font-semibold text-blue-600 hover:text-blue-500 transition"
            >
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

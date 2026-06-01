import { registerUser, loginUser } from "../services/auth.service.js";

export async function register(req, res, next) {
  try {
    const user = await registerUser(req.body);
    res.status(201).json({
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        role: user.userType,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    if (error.code === "P2002") {
      return res.status(400).json({ message: "Email đã được sử dụng" });
    }
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const result = await loginUser(req.body.email, req.body.password);
    if (!result) return res.status(401).json({ message: "Email hoặc mật khẩu không chính xác" });
    res.cookie("token", result.token, { httpOnly: true, sameSite: "lax" });
    res.json({ user: result.user, token: result.token });
  } catch (error) {
    console.error("Login Error:", error);
    next(error);
  }
}

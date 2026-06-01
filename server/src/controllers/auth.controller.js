import { registerUser, loginUser } from "../services/auth.service.js";

export async function register(req, res) {
  const user = await registerUser(req.body);
  res.status(201).json({
    user: {
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: user.userType,
    },
  });
}

export async function login(req, res) {
  const result = await loginUser(req.body.email, req.body.password);
  if (!result) return res.status(401).json({ message: "Invalid credentials" });
  res.cookie("token", result.token, { httpOnly: true, sameSite: "lax" });
  res.json({ user: result.user, token: result.token });
}

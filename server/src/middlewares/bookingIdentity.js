import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";

const GUEST_COOKIE = "guest_booking";

export function bookingIdentity(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      req.user = null;
    }
  }

  if (req.user?.id) {
    req.bookingIdentity = {
      userId: req.user.id,
      role: req.user.role,
      guestToken: req.cookies?.[GUEST_COOKIE] || null,
    };
    return next();
  }

  const guestToken =
    req.cookies?.[GUEST_COOKIE] || randomBytes(24).toString("hex");
  const isProduction = process.env.NODE_ENV === "production";
  if (!req.cookies?.[GUEST_COOKIE]) {
    res.cookie(GUEST_COOKIE, guestToken, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  req.bookingIdentity = { userId: null, guestToken };
  next();
}

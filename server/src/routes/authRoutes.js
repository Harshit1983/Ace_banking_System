import express from "express";
import rateLimit from "express-rate-limit";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  forgotAccount,
  refreshSession,
} from "../controllers/authController.js";

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // Maximum 5 login requests per IP
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
});

const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // Maximum 5 recovery requests per IP
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many recovery attempts. Please try again after 15 minutes.",
  },
});

router.post("/register", register);
router.post("/login", loginLimiter, login);
router.post("/forgot-password", recoveryLimiter, forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/forgot-account", recoveryLimiter, forgotAccount);
router.post("/refresh-session", authMiddleware, refreshSession);

export default router;

import { Router } from "express";
import {
  register,
  login,
  deleteOwnUser,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  getCurrentUser,
  googleAuth,
  googleCallback,
  googleTokenAuth,
  checkUserDeletionStatus,
  selectClub,
  getAvailableClubs,
  adminAddClubToUser,
  adminRemoveClubFromUser,
  adminGetUserClubs,
  debugClearClubId
} from "../controllers/auth.controller";
import { isAdmin } from "../middlewares/isAdmin";
import { requireAuth } from "../middlewares/requireAuth";
import { honeypotMiddleware } from "../middlewares/honeypotMiddleware";
import { validateAuthInput } from "../middlewares/validateAuthInput";
import { rateLimiter, loginLimiter } from "../middlewares/rateLimiter";
import { strictRateLimiter } from "../middlewares/queryRateLimiter";
import { requireClubOwnerAuth } from "../middlewares/authMiddleware";

const router = Router();

// Public routes
router.post("/register", rateLimiter, honeypotMiddleware, validateAuthInput(), register);
router.post("/login", loginLimiter, honeypotMiddleware, validateAuthInput(), login);

// ✅ Forgot/reset password - with strict rate limiting for security
router.post("/forgot-password", strictRateLimiter, honeypotMiddleware, forgotPassword);
router.post("/reset-password", strictRateLimiter, honeypotMiddleware, resetPassword);

// ✅ Google OAuth routes
router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);
router.post("/google/token", rateLimiter, googleTokenAuth);

// Authenticated user routes - with rate limiting for security
router.post("/logout", requireAuth, logout);
router.post("/change-password", requireAuth, strictRateLimiter, changePassword);
router.delete("/me", requireAuth, deleteOwnUser);
router.get("/me", requireAuth, getCurrentUser); // New route to test something in mock frontend
router.get("/me/deletion-status", requireAuth, checkUserDeletionStatus);

// Club owner only routes
router.get("/available-clubs", requireAuth, requireClubOwnerAuth, getAvailableClubs);
router.post("/select-club", requireAuth, requireClubOwnerAuth, rateLimiter, selectClub);

// Admin only routes - Club ownership management
router.post("/admin/add-club-to-user", requireAuth, isAdmin, rateLimiter, adminAddClubToUser);
router.post("/admin/remove-club-from-user", requireAuth, isAdmin, rateLimiter, adminRemoveClubFromUser);
router.get("/admin/user/:userId/clubs", requireAuth, isAdmin, adminGetUserClubs);

// DEBUG: Test endpoint to manually clear clubId
router.post("/debug/clear-club-id", requireAuth, debugClearClubId);

export default router;

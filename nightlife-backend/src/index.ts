import "reflect-metadata";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import { AppDataSource } from "./config/data-source";
import clubRoutes from "./routes/club.routes";
import ticketRoutes from "./routes/ticket.routes";
import authRoutes from "./routes/auth.routes";
import cookieParser from "cookie-parser";
import bouncerRoutes from "./routes/bouncer.routes";
import cartRoutes from "./routes/ticketCart.routes";
import { attachSessionId } from "./middlewares/sessionMiddleware";
import purchaseRoutes from "./routes/ticketPurchases.routes";
import eventRoutes from "./routes/event.routes";
import menuCategoryRoutes from "./routes/menuCategory.routes";
import menuItemRoutes from "./routes/menuItem.routes";
import menuVariantRoutes from "./routes/menuVariant.routes";
import menuCartRoutes from "./routes/menuCart.routes";
import menuPurchaseRoutes from "./routes/menuPurchases.routes";
import waiterRoutes from "./routes/waiter.routes";
import menuQRRoutes from "./routes/menuQR.routes";
import ticketQRRoutes from "./routes/ticketQR.routes";
import menuFromTicketQRRoutes from "./routes/menuFromTicketQR.routes";
import ticketIncludedMenuRoutes from "./routes/ticketIncludedMenu.routes";
import menuConfigRoutes from "./routes/menuConfig.routes";
import fileUploadRoutes from "./routes/fileUpload.routes";
import adRoutes from "./routes/ads.routes";
import adminRoutes from "./routes/admin";


// Wompi Integration Routes
import ticketInitiateWompiRoutes from "./routes/ticketInitiateWompi.routes";
import ticketCheckoutWompiRoutes from "./routes/ticketCheckoutWompi.routes";
import menuInitiateWompiRoutes from "./routes/menuInitiateWompi.routes";
import menuCheckoutWompiRoutes from "./routes/menuCheckoutWompi.routes";
import webhookRoutes from './routes/webhook.routes';
import pseRoutes from './routes/pse.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;


// 🛡️ Required for trusting proxy headers (like ngrok)
app.set("trust proxy", 1);

// Middleware
app.use(express.json());
app.use(cookieParser()); // must come before attachSessionId
app.use(attachSessionId); // injects sessionId or user

// CORS must allow the Next.js dev app and send cookies
const FRONTEND = process.env.FRONTEND_URL ?? "http://localhost:3000";
app.use(
  cors({
    origin: FRONTEND, // e.g., http://localhost:3000
    credentials: true, // allow cookies
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "Authorization"],
    optionsSuccessStatus: 204,
  })
);

const isDev = process.env.NODE_ENV !== "production";

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        // Next dev sometimes uses inline/eval; keep only in dev
        scriptSrc: ["'self'", "https://unpkg.com", "https://cdn.jsdelivr.net", ...(isDev ? ["'unsafe-inline'", "'unsafe-eval'"] : [])],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        // Allow the Next dev app + websockets + your own API
        connectSrc: ["'self'", "http://localhost:3000", "ws:", "wss:"],
        // Disallow being framed
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    // Other protective headers are enabled by default
  })
);

// ✅ Static HTML for testing (optional)
app.use(express.static("public"));

// Payment Success Page Route
app.get("/payment-success", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/payment-success.html"));
});

// Routes
app.use("/auth", authRoutes);
app.use("/clubs", clubRoutes);
app.use("/tickets", ticketRoutes); // public GET access
app.use("/bouncers", bouncerRoutes);
app.use("/waiters", waiterRoutes);
app.use("/cart", cartRoutes);
app.use("/purchases", purchaseRoutes);
app.use("/events", eventRoutes);
app.use("/ads", adRoutes);

// Menu System
app.use("/menu/categories", menuCategoryRoutes);
app.use("/menu/items", menuItemRoutes);
app.use("/menu/variants", menuVariantRoutes);
app.use("/menu/cart", menuCartRoutes);
app.use("/menu/purchases", menuPurchaseRoutes);
app.use("/menu", menuConfigRoutes);

// File Upload System
app.use("/upload", fileUploadRoutes);

// QR Validation System
app.use("/validate/menu", menuQRRoutes);
app.use("/validate/ticket", ticketQRRoutes);
app.use("/validate/menu-from-ticket", menuFromTicketQRRoutes);

// Ticket Menu Management
app.use("/ticket-menu", ticketIncludedMenuRoutes);

// Wompi Integration Routes
app.use("/wompi/tickets/initiate", ticketInitiateWompiRoutes);
app.use("/wompi/tickets/checkout", ticketCheckoutWompiRoutes);
app.use("/wompi/menu/initiate", menuInitiateWompiRoutes);
app.use("/wompi/menu/checkout", menuCheckoutWompiRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/pse', pseRoutes);

// Admin Routes
app.use("/admin", adminRoutes);

// DB Connection
AppDataSource.initialize()
  .then(() => {
    console.log("✅ Connected to DB");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error: any) => {
    console.error("❌ DB connection failed:", error);
  });


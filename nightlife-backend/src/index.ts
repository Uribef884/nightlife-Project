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
import { attachSessionId } from "./middlewares/sessionMiddleware";
import eventRoutes from "./routes/event.routes";
import menuCategoryRoutes from "./routes/menuCategory.routes";
import menuItemRoutes from "./routes/menuItem.routes";
import menuVariantRoutes from "./routes/menuVariant.routes";
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
import webhookRoutes from './routes/webhook.routes';
import pseRoutes from './routes/pse.routes';

// Unified Cart and Checkout Routes
import unifiedCheckoutRoutes from "./routes/unifiedCheckout.routes";
import unifiedCartRoutes from "./routes/unifiedCart.routes";
import unifiedPurchasesRoutes from "./routes/unifiedPurchases.routes";
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
const FRONTEND = process.env.FRONTEND_BASE_URL;
// Allow both localhost and IP-based access for mobile testing
const allowedOrigins = [
  FRONTEND,
  // Allow any local IP for development (no hardcoding)
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // For development, allow any localhost or IP-based origin
      if (process.env.NODE_ENV !== "production") {
        const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
        const isLocalIP = /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin) || 
                         /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/.test(origin) ||
                         /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/.test(origin);
        
        if (isLocalhost || isLocalIP) {
          console.log(`[CORS] Allowing development origin: ${origin}`);
          return callback(null, true);
        }
        
        // Additional fallback for any local development URL
        if (origin.startsWith('http://') && (origin.includes('192.168.') || origin.includes('10.') || origin.includes('172.'))) {
          console.log(`[CORS] Allowing local development origin: ${origin}`);
          return callback(null, true);
        }
      }
      
      callback(new Error("Not allowed by CORS"));
    },
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
        // Allow the Next dev app + websockets + your own API + mobile access
        connectSrc: [
          "'self'", 
          "ws:", 
          "wss:",
          ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
        ],
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
app.use("/events", eventRoutes);
app.use("/ads", adRoutes);

// Menu System
app.use("/menu/categories", menuCategoryRoutes);
app.use("/menu/items", menuItemRoutes);
app.use("/menu/variants", menuVariantRoutes);
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
app.use('/api/webhook', webhookRoutes);
app.use('/api/pse', pseRoutes);

// Server-Sent Events Routes
import sseRoutes from './routes/sse.routes';
app.use('/api/sse', sseRoutes);

// Unified Cart and Checkout Routes
app.use("/unified-cart", unifiedCartRoutes);
app.use("/checkout/unified", unifiedCheckoutRoutes);
app.use("/unified-purchases", unifiedPurchasesRoutes);

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


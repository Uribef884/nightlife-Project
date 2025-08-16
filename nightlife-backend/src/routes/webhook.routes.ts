// src/routes/webhook.routes.ts
import { Router } from "express";
import { handleWompiWebhook, pingWebhook } from "../controllers/webhook.controller";

const router = Router();

// POST /api/webhook/wompi   (because index.ts mounts: app.use('/api/webhook', router))
router.post("/wompi", handleWompiWebhook);

// GET /api/webhook/wompi/ping
router.get("/wompi/ping", pingWebhook);

export default router;

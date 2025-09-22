// src/controllers/webhook.controller.ts
import crypto from "crypto";
import { Request, Response } from "express";
import { getEventKey } from "../config/wompi";
import { AppDataSource } from "../config/data-source";
import { getValueByPath } from "../utils/wompiUtils";
// Import SSE controller dynamically to avoid circular dependencies
// Optional: if/when you want DB idempotency, wire this in later
// import { upsertWompiTransaction } from "../services/wompiWebhook.service";

/**
 * Optional GET ping for connectivity tests
 * GET /api/webhook/wompi/ping
 */
export const pingWebhook = (req: Request, res: Response) => {
  res.status(200).json({ ok: true, path: req.originalUrl, method: req.method });
};

/**
 * Hardened Wompi webhook handler.
 * - Keeps your current policy: 200 on invalid (by default)
 * - Adds `WOMPI_STRICT=true` env flag to return 403 on invalid if you ever want dashboard-accurate failures
 * - Uses timing-safe checksum compare
 * - Normalizes undefined values before hashing
 * - Avoids logging secrets
 */
export const handleWompiWebhook = async (req: Request, res: Response): Promise<void> => {
  // Feature flag: strict mode returns 4xx on invalid; default stays lenient (200 on invalid)
  const STRICT = (process.env.WOMPI_STRICT ?? "false").toLowerCase() === "true";

  try {
    const eventIntegrity = getEventKey(); // your Wompi “event key”
    const { signature, timestamp, data } = req.body ?? {};

    // Quick helpers
    const ack = () => res.status(200).json({ received: true }); // your policy for invalids by default
    const deny = (code: number, message: string) => res.status(code).json({ success: false, code: message });

    // 1) Validate shape
    const hasMinimalShape =
      signature?.checksum &&
      Array.isArray(signature?.properties) &&
      typeof timestamp !== "undefined" &&
      data?.transaction?.id;

    if (!hasMinimalShape) {
      // Log only the essentials—never print integrity key or raw string
      console.warn("[WOMPI] Invalid shape", {
        txId: data?.transaction?.id ?? null,
        hasSignature: !!signature,
        hasProps: Array.isArray(signature?.properties),
        hasTimestamp: typeof timestamp !== "undefined",
      });
      if (STRICT) {
        deny(403, "INVALID_SIGNATURE_FORMAT");
        return;
      }
      ack();
      return;
    }

    // 2) Compute checksum
    // normalize missing properties to '' to match Wompi’s concat model safely
    const valuesToHash = signature.properties.map((prop: string) => {
      const v = getValueByPath(data, prop);
      return v == null ? "" : String(v);
    });

    const rawString = valuesToHash.join("") + String(timestamp) + eventIntegrity;

    const computedChecksum = crypto.createHash("sha256").update(rawString).digest("hex").toLowerCase();
    const receivedChecksum = String(signature.checksum).toLowerCase();

    // 3) Timing-safe compare
    const sameLength = computedChecksum.length === receivedChecksum.length;
    const match =
      sameLength &&
      crypto.timingSafeEqual(Buffer.from(computedChecksum, "utf8"), Buffer.from(receivedChecksum, "utf8"));

    if (!match) {
      console.warn("[WOMPI] Invalid checksum", {
        txId: data.transaction.id,
        // DO NOT log rawString or eventIntegrity
      });
      if (STRICT) {
        deny(403, "INVALID_CHECKSUM");
        return;
      }
      ack();
      return;
    }

    // 4) At this point the event is authentic. You can safely process it.
    const wompiTxId: string = data.transaction.id;
    const status: string = String(data.transaction.status ?? "UNKNOWN").toUpperCase();
    const reference: string | undefined = data.transaction.reference;
    const allowedStatuses = new Set(["APPROVED", "DECLINED", "VOIDED", "PENDING"]);

    if (!allowedStatuses.has(status)) {
      console.warn("[WOMPI] Unrecognized status", { txId: wompiTxId, status });
    }

    // OPTIONAL (recommended): make writes idempotent by transaction id
    // try {
    //   await upsertWompiTransaction(wompiTxId, status);
    // } catch (dbErr) {
    //   console.error("[WOMPI] DB error while upserting", { txId: wompiTxId, status, err: dbErr });
    //   // Your current policy is to acknowledge, but you could choose to 500 here if you prefer retries.
    //   // For your stated preference (no dashboard retries), we keep ack:
    //   return ack();
    // }

    // Handle unified transactions by reference
    if (reference && reference.startsWith("unified_")) {
      try {
        const { UnifiedPurchaseTransaction } = await import("../entities/UnifiedPurchaseTransaction");
        const repo = AppDataSource.getRepository(UnifiedPurchaseTransaction);
        const existing = await repo.findOne({ where: { paymentProviderReference: reference } });
        
        if (!existing) {
          console.warn("[WOMPI] Unified transaction reference not found", { reference, txId: wompiTxId });
        } else {
          // Idempotency: skip if no state change
          if (
            existing.paymentProviderTransactionId === wompiTxId &&
            String(existing.paymentStatus).toUpperCase() === status
          ) {
            console.log("[WOMPI] Unified transaction already up-to-date", { reference, txId: wompiTxId, status });
            res.status(200).json({ success: true, message: "Already processed" });
            return;
          } else {
            existing.paymentProvider = "wompi";
            existing.paymentProviderTransactionId = wompiTxId;
            // clamp status to allowed enum values
            const allowed: any = new Set(["APPROVED", "DECLINED", "PENDING", "VOIDED", "ERROR"]);
            existing.paymentStatus = (allowed.has(status) ? status : "PENDING") as any;
            await repo.save(existing);
            console.log("[WOMPI] Unified transaction updated", { id: existing.id, reference, status });
            
            // 🚨 CRITICAL: Handle late APPROVED transactions (after polling timeout)
            if (status === "APPROVED" && String(existing.paymentStatus).toUpperCase() === "TIMEOUT") {
              console.log("[WOMPI] 🚨 Late APPROVED transaction detected! Processing order...", { 
                transactionId: existing.id, 
                wompiTxId 
              });
              
              try {
                // Import the checkout controller to process the late payment
                const { UnifiedCheckoutController } = await import("./unifiedCheckout.controller");
                const checkoutController = new UnifiedCheckoutController();
                
                // Process the successful checkout
                await checkoutController.processWompiSuccessfulUnifiedCheckout({
                  userId: existing.userId || null,
                  sessionId: existing.sessionId || null,
                  email: existing.buyerEmail || 'unknown@example.com',
                  req: {} as any, // Mock request object for webhook context
                  res: {} as any, // Mock response object for webhook context
                  transactionId: existing.id,
                  cartItems: [], // Will be fetched from stored data
                });
                
                console.log("[WOMPI] ✅ Late APPROVED transaction processed successfully", { 
                  transactionId: existing.id 
                });
              } catch (lateProcessError) {
                console.error("[WOMPI] ❌ Failed to process late APPROVED transaction:", lateProcessError);
                // Don't throw - we still want to acknowledge the webhook
              }
            }
            
            // Broadcast status update via SSE (dynamic import to avoid circular dependencies)
            try {
              const { SSEController } = await import("./sse.controller");
              console.log(`[WOMPI] Broadcasting status update via SSE: ${existing.id} -> ${existing.paymentStatus}`);
              SSEController.broadcastStatusUpdate(existing.id, existing.paymentStatus, {
                wompiTransactionId: wompiTxId,
                reference: reference
              });
              console.log(`[WOMPI] SSE broadcast completed for transaction: ${existing.id}`);
            } catch (sseError) {
              console.error("[WOMPI] Failed to broadcast SSE update:", sseError);
            }
          }
        }
      } catch (dbErr) {
        console.error("[WOMPI] DB update error", { reference, txId: wompiTxId, status, err: dbErr });
        // Acknowledge regardless to avoid infinite retries per your policy
        res.status(200).json({ received: true, updated: false });
        return;
      }
    } else if (reference && (reference.startsWith("ticket_") || reference.startsWith("menu_"))) {
      // Legacy transactions - just log for now
      console.warn("[WOMPI] Legacy transaction reference received - unified system handles this now", { reference, txId: wompiTxId, status });
    } else {
      console.warn("[WOMPI] Missing or unrecognized reference", { txId: wompiTxId, reference });
    }

    console.log("[WOMPI] Processed", { txId: wompiTxId, status, strict: STRICT });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("[WOMPI] Handler error", { err });
    // If STRICT, you could return 500 to get a retry. You said you don't care about retries → keep 200.
    if (STRICT) {
      res.status(500).json({ success: false, code: "SERVER_ERROR" });
      return;
    }
    res.status(200).json({ received: true });
  }
};

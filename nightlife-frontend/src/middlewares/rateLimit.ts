// src/middlewares/rateLimit.ts
type Bucket = { tokens: number; last: number };
const store = new Map<string, Bucket>();

/**
 * Token bucket limiter. For real prod, move to Redis/Upstash.
 * @param key unique key (e.g., IP)
 * @param cfg tokens per interval & interval length
 * @returns true if allowed; false if rate-limited
 */
export function rateLimit(
  key: string,
  cfg: { tokens: number; intervalMs: number } = { tokens: 60, intervalMs: 60_000 }
): boolean {
  const now = Date.now();
  const prev = store.get(key) ?? { tokens: cfg.tokens, last: now };

  // Refill proportional to elapsed time
  const elapsed = now - prev.last;
  const refill = (elapsed / cfg.intervalMs) * cfg.tokens;
  const tokens = Math.min(cfg.tokens, prev.tokens + refill);

  if (tokens < 1) {
    store.set(key, { tokens, last: now });
    return false;
  }

  store.set(key, { tokens: tokens - 1, last: now });
  return true;
}

/**
 * Same token bucket as above, but returns an accurate local Retry-After time.
 * Useful when the caller wants to set a backoff window instead of hammering.
 *
 * - Does NOT throw; always returns { allowed, retryAfterMs }.
 * - retryAfterMs is 0 when allowed=true.
 */
export function rateLimitWithRetry(
  key: string,
  cfg: { tokens: number; intervalMs: number } = { tokens: 60, intervalMs: 60_000 }
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const prev = store.get(key) ?? { tokens: cfg.tokens, last: now };

  // Refill proportional to elapsed time (same math as rateLimit)
  const elapsed = now - prev.last;
  const refill = (elapsed / cfg.intervalMs) * cfg.tokens;
  const tokens = Math.min(cfg.tokens, prev.tokens + refill);

  if (tokens < 1) {
    // Compute the time until 1 token becomes available:
    // tokensPerMs = cfg.tokens / cfg.intervalMs
    // needed = 1 - tokens (fractional)
    const tokensPerMs = cfg.tokens / cfg.intervalMs;
    const needed = 1 - tokens;
    const retryAfterMs = Math.max(0, Math.ceil(needed / tokensPerMs));

    store.set(key, { tokens, last: now }); // persist state
    return { allowed: false, retryAfterMs };
  }

  store.set(key, { tokens: tokens - 1, last: now });
  return { allowed: true, retryAfterMs: 0 };
}

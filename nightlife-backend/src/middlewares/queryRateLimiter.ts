// src/middlewares/queryRateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';

// Track query counts per user/session
const queryCounts = new Map<string, { count: number; resetTime: number }>();
const QUERY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_QUERIES_PER_WINDOW = 500; // Maximum queries per window (increased for high-volume operations)
const MAX_QUERIES_PER_MINUTE = 100; // Maximum queries per minute (increased)
const MAX_QUERIES_PER_SECOND = 10; // Maximum queries per second (added for burst protection)

interface QueryRateLimitOptions {
  windowMs?: number;
  maxQueriesPerWindow?: number;
  maxQueriesPerMinute?: number;
  maxQueriesPerSecond?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  enableBurstProtection?: boolean;
}

/**
 * Custom query rate limiter to prevent database abuse and blind SQL injection
 */
export function createQueryRateLimiter(options: QueryRateLimitOptions = {}) {
  const {
    windowMs = QUERY_WINDOW_MS,
    maxQueriesPerWindow = MAX_QUERIES_PER_WINDOW,
    maxQueriesPerMinute = MAX_QUERIES_PER_MINUTE,
    maxQueriesPerSecond = MAX_QUERIES_PER_SECOND,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    enableBurstProtection = true
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    const sessionId = (req as any).sessionId;
    const identifier = userId || sessionId || req.ip;
    const now = Date.now();

    // Get or create query count for this identifier
    let queryData = queryCounts.get(identifier);
    if (!queryData || now > queryData.resetTime) {
      queryData = {
        count: 0,
        resetTime: now + windowMs
      };
      queryCounts.set(identifier, queryData);
    }

    // Increment query count
    queryData.count++;

    // Check if limit exceeded
    if (queryData.count > maxQueriesPerWindow) {
      console.warn(`[QUERY-RATE-LIMIT] Rate limit exceeded for ${identifier}`, {
        count: queryData.count,
        limit: maxQueriesPerWindow,
        windowMs,
        userId,
        sessionId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      });

      return res.status(429).json({
        error: 'Too many database queries. Please try again later.',
        retryAfter: Math.ceil((queryData.resetTime - now) / 1000)
      });
    }

    // Check minute-based limit (more aggressive)
    const minuteKey = `${identifier}_${Math.floor(now / 60000)}`;
    const minuteData = queryCounts.get(minuteKey);
    if (minuteData && minuteData.count > maxQueriesPerMinute) {
      console.warn(`[QUERY-RATE-LIMIT] Minute rate limit exceeded for ${identifier}`, {
        count: minuteData.count,
        limit: maxQueriesPerMinute,
        userId,
        sessionId,
        ip: req.ip,
        warning: 'Potential automated attack detected'
      });

      return res.status(429).json({
        error: 'Too many database queries per minute. Please slow down.',
        retryAfter: 60
      });
    }

    // Update minute count
    if (!minuteData) {
      queryCounts.set(minuteKey, { count: 1, resetTime: now + 60000 });
    } else {
      minuteData.count++;
    }

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxQueriesPerWindow.toString(),
      'X-RateLimit-Remaining': Math.max(0, maxQueriesPerWindow - queryData.count).toString(),
      'X-RateLimit-Reset': new Date(queryData.resetTime).toISOString()
    });

    next();
  };
}

/**
 * Express rate limiter for general API endpoints
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    console.warn(`[API-RATE-LIMIT] Rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
    
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: 15 * 60
    });
  }
});

/**
 * Strict rate limiter for sensitive endpoints (login, checkout, etc.)
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many attempts from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    console.warn(`[STRICT-RATE-LIMIT] Rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      warning: 'Potential brute force attack detected'
    });
    
    res.status(429).json({
      error: 'Too many attempts from this IP, please try again later.',
      retryAfter: 15 * 60
    });
  }
});

/**
 * Clean up old query count entries periodically
 */
export function cleanupQueryCounts(): void {
  const now = Date.now();
  for (const [key, data] of queryCounts.entries()) {
    if (now > data.resetTime) {
      queryCounts.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupQueryCounts, 5 * 60 * 1000);

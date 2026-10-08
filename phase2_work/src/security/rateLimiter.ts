import type { Request, Response, NextFunction } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

export function rateLimiter(options: RateLimitOptions) {
  const store: RateLimitStore = {};
  const message = options.message || 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.';

  // Periodic cleanup to avoid memory leak under load
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const key of Object.keys(store)) {
      const entry = store[key];
      if (entry && entry.resetTime < now) {
        delete store[key];
      }
    }
  }, Math.min(options.windowMs, 60000));
  if (cleanupTimer.unref) cleanupTimer.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.user?.uid || req.ip || req.socket.remoteAddress || 'unknown');
    const now = Date.now();

    const setHeader = (header: string, value: string | number | readonly string[]) => {
      if (typeof res.setHeader === 'function') {
        res.setHeader(header, value);
      }
    };

    if (!store[key] || now > store[key].resetTime) {
      store[key] = {
        count: 1,
        resetTime: now + options.windowMs,
      };
      setHeader('RateLimit-Limit', options.max);
      setHeader('RateLimit-Remaining', options.max - 1);
      setHeader('RateLimit-Reset', Math.ceil(store[key].resetTime / 1000));
      return next();
    }

    store[key].count++;
    const remaining = Math.max(0, options.max - store[key].count);
    setHeader('RateLimit-Limit', options.max);
    setHeader('RateLimit-Remaining', remaining);
    setHeader('RateLimit-Reset', Math.ceil(store[key].resetTime / 1000));

    if (store[key].count > options.max) {
      const retryAfterSeconds = Math.ceil((store[key].resetTime - now) / 1000);
      setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        error: 'Too Many Requests',
        message,
        retryAfterSeconds,
      });
    }

    next();
  };
}

/**
 * Striktes Rate-Limiting für KI-Aufrufe (Gemini API / LLM-Token-Schutz)
 * Maximal 15 Anfragen pro Minute pro Benutzer oder IP
 */
export const kiRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: 'KI-Ratenbegrenzung erreicht. Bitte warte kurz vor der nächsten Analyse.',
  keyGenerator: (req) => `ki_${req.user?.uid || ipKeyGenerator(req.ip ?? '') || 'anon'}`,
});

/**
 * Optimiertes Rate-Limiting für Chat-Endpunkte (Spam- und DDoS-Schutz)
 * Maximal 30 Nachrichten pro Minute
 */
export const chatRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Nachrichtenlimit erreicht. Bitte reduziere die Sendefrequenz.',
  keyGenerator: (req) => `chat_${req.user?.uid || ipKeyGenerator(req.ip ?? '') || 'anon'}`,
});

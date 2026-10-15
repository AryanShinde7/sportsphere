import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) {
  const store: RateLimitStore = {};
  const { windowMs, max, message = 'Too many requests, please try again later.' } = options;

  // Cleanup expired entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const key of Object.keys(store)) {
      const entry = store[key];
      if (entry && entry.resetTime <= now) {
        delete store[key];
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = options.keyGenerator 
      ? options.keyGenerator(req) 
      : `${req.ip || req.socket.remoteAddress || 'unknown'}:${req.originalUrl || req.path}`;
    
    const now = Date.now();
    const record = store[key];

    if (!record || record.resetTime <= now) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    record.count += 1;

    if (record.count > max) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        error: message,
        retryAfter: retryAfterSec,
      });
    }

    next();
  };
}

// Instruction 7.5: Rate limiter instances for login and sensitive operations
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // max 15 login attempts per 15 min per IP/email
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
  keyGenerator: (req) => {
    const email = (req.body?.email || '').toLowerCase().trim();
    const ip = req.ip || req.socket.remoteAddress || 'ip';
    return `auth:${ip}:${email}`;
  }
});

export const sensitiveEndpointLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 operations per 15 min
  message: 'Too many sensitive requests. Please wait a few moments and try again.',
  keyGenerator: (req: any) => {
    const userId = req.user?.id || req.ip || 'anon';
    return `sensitive:${userId}:${req.baseUrl || ''}${req.path}`;
  }
});

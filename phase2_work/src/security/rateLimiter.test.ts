import { vi, describe, it, expect, beforeEach } from 'vitest';
import { rateLimiter } from './rateLimiter';
import type { Request, Response, NextFunction } from 'express';

describe('rateLimiter middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { ip: '127.0.0.1', socket: {} as unknown };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  it('should allow requests within the limit', () => {
    const limiter = rateLimiter({ windowMs: 60000, max: 2 });

    limiter(req as Request, res as Response, next);
    limiter(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should block requests exceeding the limit with 429', () => {
    const limiter = rateLimiter({ windowMs: 60000, max: 1 });

    limiter(req as Request, res as Response, next);
    limiter(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Too Many Requests' })
    );
  });
});

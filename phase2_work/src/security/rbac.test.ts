import { vi, describe, it, expect, beforeEach } from 'vitest';
import { rbacGuard, UserRole } from './rbac';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../core/auth/authMiddleware';
import type { DecodedIdToken } from 'firebase-admin/auth';

describe('rbacGuard middleware', () => {
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  it('should allow access if user role meets or exceeds required role', () => {
    const req: Partial<AuthenticatedRequest> = {
      user: { role: UserRole.ADMIN } as unknown as DecodedIdToken,
    };

    const guard = rbacGuard(UserRole.USER);
    guard(req as AuthenticatedRequest, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should deny access with 403 if user role is below required role', () => {
    const req: Partial<AuthenticatedRequest> = {
      user: { role: UserRole.GUEST } as unknown as DecodedIdToken,
    };

    const guard = rbacGuard(UserRole.VERIFIED);
    guard(req as AuthenticatedRequest, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Forbidden' })
    );
  });
});

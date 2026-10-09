import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../core/auth/authMiddleware';

export enum UserRole {
  GUEST = 'GUEST',
  USER = 'USER',
  VERIFIED = 'VERIFIED',
  ADMIN = 'ADMIN',
}

export function rbacGuard(requiredRole: UserRole) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRole = typeof req.user?.role === 'string' ? req.user.role : UserRole.GUEST;

    const roleHierarchy: Record<UserRole, number> = {
      [UserRole.GUEST]: 0,
      [UserRole.USER]: 1,
      [UserRole.VERIFIED]: 2,
      [UserRole.ADMIN]: 3,
    };

    if (roleHierarchy[userRole as keyof typeof roleHierarchy] < roleHierarchy[requiredRole]) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Zugriff verweigert: Unzureichende Berechtigungen.',
      });
    }

    next();
  };
}

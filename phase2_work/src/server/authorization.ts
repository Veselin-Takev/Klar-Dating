import type { NextFunction, Request, Response } from 'express';

export type KlarRole = 'user' | 'moderator' | 'support' | 'trust_safety' | 'finance' | 'admin' | 'super_admin';

export function currentUserId(req: Request): string | null {
  const uid = (req as { user?: { uid?: unknown } }).user?.uid;
  return typeof uid === 'string' && uid.length > 0 ? uid : null;
}

export function requireRole(...roles: KlarRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as { user?: { uid?: unknown; admin?: boolean; role?: unknown; roles?: unknown } }).user;
    const claimed = new Set<KlarRole>();
    if (user?.admin === true) claimed.add('admin');
    if (typeof user?.role === 'string') claimed.add(user.role as KlarRole);
    if (Array.isArray(user?.roles)) {
      for (const role of user.roles) if (typeof role === 'string') claimed.add(role as KlarRole);
    }
    const directClaims = user as Record<string, unknown> | undefined;
    for (const role of ['moderator', 'support', 'trust_safety', 'finance', 'admin', 'super_admin'] as KlarRole[]) {
      if (directClaims?.[role] === true) claimed.add(role);
    }
    if (roles.some(role => claimed.has(role)) || claimed.has('super_admin')) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}

export function assertSelf(req: Request, requestedUid: unknown): string {
  const own = currentUserId(req);
  if (!own) throw new Error('Unauthorized');
  if (requestedUid !== undefined && requestedUid !== null && requestedUid !== '' && requestedUid !== own) {
    throw new Error('Forbidden');
  }
  return own;
}

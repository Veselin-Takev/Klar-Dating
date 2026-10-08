import { Router } from 'express';

/**
 * Legacy self/manual verification is retired.
 * Identity verification is granted only by the signed Didit V3 webhook pipeline.
 */
export const verificationRouter = Router();
for (const path of ['/verify', '/status', '/challenge', '/submit', '/decide']) {
  verificationRouter.all(path, (_req, res) => {
    res.status(410).json({ code: 'verification_retired', error: 'Use the Didit identity verification flow.' });
  });
}
export default verificationRouter;

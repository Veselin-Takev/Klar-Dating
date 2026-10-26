import { logSafeFailure } from '../safeErrorLog';
import { Router } from 'express';
import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Firestore } from 'firebase-admin/firestore';
import {
  getAnonymizedComplianceAuditLogs,
  exportComplianceLogsAsCSV,
} from '../platform/auditComplianceExport';

export type AuditLogRouterDeps = {
  getFirestore: () => Firestore;
};

export function serializeTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      const date = (value as { toDate: () => unknown }).toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function createAuditLogRouter({ getFirestore }: AuditLogRouterDeps): Router {
  const router = Router();
  const adminAuditReadLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 20,
    keyGenerator: (req) => (req as Request & { user?: { uid?: string } }).user?.uid ?? ipKeyGenerator(req.ip ?? ''),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Zu viele Audit-Log-Abfragen. Bitte später erneut versuchen.' },
  });
  const complianceReadLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 30,
    keyGenerator: (req) => (req as Request & { user?: { uid?: string } }).user?.uid ?? ipKeyGenerator(req.ip ?? ''),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Zu viele Compliance-Audit-Abfragen. Bitte später erneut versuchen.' },
  });
  const complianceCsvLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    keyGenerator: (req) => (req as Request & { user?: { uid?: string } }).user?.uid ?? ipKeyGenerator(req.ip ?? ''),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Zu viele Compliance-CSV-Exporte. Bitte später erneut versuchen.' },
  });

  router.get('/audit-logs', adminAuditReadLimiter, async (_req, res) => {
    try {
      const snapshot = await getFirestore().collection('audit_logs')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      const logs = snapshot.docs.map(doc => {
        const data = doc.data() as Record<string, unknown>;
        return {
          id: doc.id,
          actorPseudonym: typeof data.actorPseudonym === 'string' ? data.actorPseudonym : null,
          type: typeof data.type === 'string' ? data.type : 'unknown',
          timestamp: serializeTimestamp(data.timestamp),
          hasEncryptedPayload: typeof data.encryptedInput === 'string' || typeof data.encryptedOutput === 'string',
        };
      });

      return res.json({ logs });
    } catch (error) {
      logSafeFailure('audit_log_read_failure');
      return res.status(503).json({ error: 'Audit logs are temporarily unavailable' });
    }
  });

  router.get('/compliance/audit-logs', complianceReadLimiter, async (req, res) => {
    try {
      const parsedLimit = req.query.limit === undefined ? 100 : Number(req.query.limit);
      const limit = Number.isSafeInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 100;
      const kind = req.query.kind as 'cancel' | 'withdraw' | 'all' | undefined;
      const db = getFirestore();
      const records = await getAnonymizedComplianceAuditLogs(db, { limit, kind });
      return res.json({ ok: true, count: records.length, records });
    } catch (error) {
      console.error('Error fetching compliance audit logs:', error);
      return res.status(503).json({ ok: false, error: 'Compliance audit logs are temporarily unavailable' });
    }
  });

  router.get('/compliance/audit-logs/csv', complianceCsvLimiter, async (req, res) => {
    try {
      const kind = req.query.kind as 'cancel' | 'withdraw' | 'all' | undefined;
      const delimiter = (req.query.delimiter === ',' ? ',' : ';') as ';' | ',';
      const db = getFirestore();
      const { csv, filename } = await exportComplianceLogsAsCSV(db, { limit: 500, kind, delimiter });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csv);
    } catch (error) {
      console.error('Error exporting compliance audit CSV:', error);
      return res.status(503).send('Fehler beim Exportieren der Konformitäts-Logs als CSV');
    }
  });

  return router;
}

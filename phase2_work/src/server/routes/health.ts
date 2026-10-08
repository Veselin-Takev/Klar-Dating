/**
 * Health / ready / metrics / system-health routes.
 * Extracted from server.ts (move-only). Behavior unchanged.
 */
import { timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response, type RequestHandler } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { observabilityPrometheus } from '../observability';

export type HealthStats = {
  startedAt: number;
  apiRequests: number;
  apiErrors: number;
  apiLatencies: { route: string; duration: number; timestamp: number }[];
  firebaseLatencies: { operation: string; duration: number; timestamp: number }[];
  statusCodes: Map<number, number>;
};

export type HealthRouterDeps = {
  getFirestore: () => Firestore;
  healthStats: HealthStats;
  /** Optional: system-health (moderator). Omit to skip that route. */
  requireAuth?: RequestHandler;
  nurModeration?: RequestHandler;
};

export function createHealthRouter(deps: HealthRouterDeps): Router {
  const router = Router();
  const { getFirestore, healthStats } = deps;

  // Version, keine Zaehlwerte. Sie ist ohne Anmeldung erreichbar, und
  // alles darin waere oeffentlich.
  router.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  router.get('/ready', async (_req, res) => {
    try {
      await getFirestore().collection('system').doc('readiness').get();
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  router.get('/metrics', (req, res) => {
    const configuredToken = process.env.METRICS_TOKEN;
    const suppliedToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const configuredBytes = configuredToken ? Buffer.from(configuredToken, 'utf8') : null;
    const suppliedBytes = suppliedToken ? Buffer.from(suppliedToken, 'utf8') : null;
    const tokenMatches = Boolean(
      configuredBytes && suppliedBytes &&
      configuredBytes.length === suppliedBytes.length &&
      timingSafeEqual(configuredBytes, suppliedBytes)
    );
    if (!tokenMatches) {
      return res.status(404).end();
    }

    const durations = healthStats.apiLatencies.map((entry) => entry.duration).sort((a, b) => a - b);
    const percentile = (p: number) =>
      durations.length === 0
        ? 0
        : durations[Math.min(durations.length - 1, Math.ceil(durations.length * p) - 1)] || 0;
    const lines = [
      '# HELP klar_uptime_seconds Process uptime in seconds.',
      '# TYPE klar_uptime_seconds gauge',
      `klar_uptime_seconds ${Math.floor((Date.now() - healthStats.startedAt) / 1000)}`,
      '# HELP klar_http_requests_total Completed API requests.',
      '# TYPE klar_http_requests_total counter',
      `klar_http_requests_total ${healthStats.apiRequests}`,
      '# HELP klar_http_errors_total Completed API requests with a 5xx response.',
      '# TYPE klar_http_errors_total counter',
      `klar_http_errors_total ${healthStats.apiErrors}`,
      '# HELP klar_http_latency_ms Recent API latency percentiles.',
      '# TYPE klar_http_latency_ms gauge',
      `klar_http_latency_ms{quantile="0.50"} ${percentile(0.5)}`,
      `klar_http_latency_ms{quantile="0.95"} ${percentile(0.95)}`,
      `klar_http_latency_ms{quantile="0.99"} ${percentile(0.99)}`,
      ...[...healthStats.statusCodes.entries()].map(
        ([code, count]) => `klar_http_responses_total{status="${code}"} ${count}`
      ),
    ];
    const otel = observabilityPrometheus().trim();
    res.type('text/plain; version=0.0.4').send(lines.join('\n') + '\n' + (otel ? otel + '\n' : ''));
  });

  if (deps.requireAuth && deps.nurModeration) {
    // SEC-12: must sit behind requireAuth + moderation (not before global /api auth).
    router.get('/system-health', deps.requireAuth, deps.nurModeration, (_req: Request, res: Response) => {
      const recentApi = healthStats.apiLatencies.slice(-100);
      const avgApi =
        recentApi.length > 0
          ? Math.round(recentApi.reduce((acc, curr) => acc + curr.duration, 0) / recentApi.length)
          : null;

      res.json({
        apiAvgResponseTimeMs: avgApi,
        apiMessungen: recentApi.length,
        nichtVerfuegbar: [
          'crashFreeRate — es gibt keine Absturzerfassung',
          'startupTimeMs — die Startzeit wird nicht gemessen',
          'susScore, susHistory — es liegen keine erhobenen SUS-Antworten vor',
          'latencyHistory, latencyHeatmap — es gibt keine Messwerte ueber die letzten 100 Aufrufe hinaus',
          'cacheHitRate — es gibt keine Zwischenspeicher-Statistik',
        ],
      });
    });
  }

  return router;
}

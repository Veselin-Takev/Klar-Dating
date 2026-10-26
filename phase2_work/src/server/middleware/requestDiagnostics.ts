import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { extractTraceContext, startHttpSpan, runInSpan } from '../observability';
import { requestRouteForTelemetry } from '../requestTelemetry';
import type { HealthStats } from '../routes/health';

export type FailedApiCall = { path: string; method: string; status: number; time: string };
type RequestLog = {
  level: 'ERROR' | 'INFO'; event: 'http_request' | 'http_request_aborted';
  requestId: string; traceId: string; method: string; route: string;
  status?: number; durationMs: number;
};

/** Per-app operational state. Neither response bodies nor raw URLs are retained.
 * Completed responses and disconnected requests have distinct semantics:
 * finish is not proof that the client received the response.
 */
export function createRequestDiagnostics(log: (record: RequestLog) => void = record => console.log(JSON.stringify(record))) {
  const healthStats: HealthStats = {
    startedAt: Date.now(), apiRequests: 0, apiErrors: 0,
    apiLatencies: [], firebaseLatencies: [], statusCodes: new Map(),
  };
  const failures: FailedApiCall[] = [];

  const correlation: RequestHandler = (req, res, next) => {
    const startedAt = Date.now();
    const incoming = req.headers['x-request-id'];
    const requestId = typeof incoming === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(incoming)
      ? incoming : randomUUID();
    const parentContext = extractTraceContext(typeof req.headers.traceparent === 'string' ? req.headers.traceparent : undefined);
    const httpSpan = startHttpSpan(req.method, requestRouteForTelemetry(req), parentContext);
    const traceId = httpSpan.spanContext().traceId;
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Trace-ID', traceId);
    res.setHeader('traceparent', `00-${traceId}-${httpSpan.spanContext().spanId}-01`);
    Object.assign(req, { requestId, traceId });

    let ended = false;
    const complete = (aborted: boolean) => {
      if (ended) return;
      ended = true;
      res.off('finish', onFinish);
      res.off('close', onClose);
      httpSpan.setAttribute('http.route', requestRouteForTelemetry(req));
      if (aborted) {
        httpSpan.setAttribute('error.type', 'client_disconnect');
        httpSpan.setStatus({ code: 2 });
      } else {
        httpSpan.setAttribute('http.response.status_code', res.statusCode);
        if (res.statusCode >= 500) httpSpan.setStatus({ code: 2 });
      }
      httpSpan.end();
      if (!req.path.startsWith('/api/health') && !req.path.startsWith('/api/metrics')) {
        log({
          level: aborted || res.statusCode >= 500 ? 'ERROR' : 'INFO',
          event: aborted ? 'http_request_aborted' : 'http_request',
          requestId, traceId, method: req.method, route: requestRouteForTelemetry(req),
          ...(aborted ? {} : { status: res.statusCode }),
          durationMs: Date.now() - startedAt,
        });
      }
    };
    const onFinish = () => complete(false);
    const onClose = () => complete(!res.writableFinished);
    res.once('finish', onFinish);
    res.once('close', onClose);
    void runInSpan(httpSpan, async () => { next(); });
  };

  const apiMetrics: RequestHandler = (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      const startedAt = Date.now();
      res.once('finish', () => {
        healthStats.apiRequests++;
        if (res.statusCode >= 500) healthStats.apiErrors++;
        healthStats.statusCodes.set(res.statusCode, (healthStats.statusCodes.get(res.statusCode) ?? 0) + 1);
        healthStats.apiLatencies.push({
          route: requestRouteForTelemetry(req), duration: Date.now() - startedAt, timestamp: Date.now(),
        });
        if (healthStats.apiLatencies.length > 1000) healthStats.apiLatencies.shift();
      });
    }
    next();
  };

  const failedResponses: RequestHandler = (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      res.once('finish', () => {
        if (res.statusCode < 400) return;
        failures.unshift({ path: requestRouteForTelemetry(req), method: req.method,
          status: res.statusCode, time: new Date().toISOString() });
        if (failures.length > 10) failures.pop();
      });
    }
    next();
  };

  return { correlation, apiMetrics, failedResponses, healthStats,
    failedApiCalls: (): FailedApiCall[] => failures.map(entry => ({ ...entry })) };
}

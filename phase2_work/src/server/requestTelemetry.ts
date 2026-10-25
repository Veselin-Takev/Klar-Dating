/** Use only Express's registered route template in telemetry.
 * Raw path/originalUrl values may contain identifiers, tokens or query data.
 * Early failures and unmatched requests intentionally share one label.
 */
export function requestRouteForTelemetry(request: { route?: { path?: unknown } }): string {
  const route = request.route?.path;
  return typeof route === 'string' && route.startsWith('/') && route.length <= 256 && !/[\r\n\u0000]/.test(route)
    ? route
    : 'unmatched';
}

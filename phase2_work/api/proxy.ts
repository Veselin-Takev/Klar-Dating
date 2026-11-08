/**
 * Vercel Vite frontend -> separately approved HTTPS API backend.
 *
 * This is a same-origin proxy, NOT a new account/age authority. The existing
 * Cloud Run Express backend must validate Firebase tokens, age, consent,
 * rate limits and tenant scope. No frontend-only "success" is ever returned.
 * Without a pinned/approved backend the proxy responds 503, not a fake 200.
 */
const MAX_BODY_BYTES = 900 * 1024;
const TIMEOUT_MS = 15_000;
// Applies before fetch(). The upstream fetch timeout cannot protect against
// a client who never completes an incoming chunked request body.
const BODY_READ_TIMEOUT_MS = 10_000;
class BodyReadDeadlineExceeded extends Error {}
const ROUTE_PARAM = '__klar_api_path';

function unavailable(code: string, status = 503): Response {
  return Response.json({
    code,
    error: 'Der Klar-Dienst ist momentan nicht verfügbar. Bitte später erneut versuchen.',
  }, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...(status === 503 ? { 'retry-after': '60' } : {}),
    },
  });
}

function validatedBackendOrigin(env: NodeJS.ProcessEnv): URL | null {
  const raw = env.KLAR_API_UPSTREAM_ORIGIN;
  const pinnedHost = env.KLAR_API_ALLOWED_HOST;
  if (!raw || !pinnedHost || pinnedHost !== pinnedHost.toLowerCase()) return null;
  try {
    const origin = new URL(raw);
    if (origin.protocol !== 'https:' || origin.hostname !== pinnedHost
        || origin.username || origin.password || origin.port
        || origin.pathname !== '/' || origin.search || origin.hash
        || origin.hostname === 'localhost' || origin.hostname.endsWith('.localhost')
        || origin.hostname.endsWith('.internal') || origin.hostname.endsWith('.vercel.app')
        || /^[0-9.]+$/.test(origin.hostname) || origin.hostname.includes(':')) {
      return null;
    }
    return origin;
  } catch {
    return null;
  }
}

function validatedRoute(url: URL): string | null {
  // Rewrites can preserve the original path or expose the explicitly captured
  // segment as a query parameter. Never trust a caller-supplied target URL.
  const injected = url.searchParams.getAll(ROUTE_PARAM);
  if (injected.length > 1) return null;
  const path = url.pathname.startsWith('/api/') && url.pathname !== '/api/proxy'
    ? url.pathname.slice('/api/'.length)
    : injected.length === 1 ? injected[0] : null;
  if (!path || path.length > 250 || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(path)
      || path === 'proxy') return null;
  return path;
}

/**
 * Enforce the request-body limit while streaming. Reading request.arrayBuffer()
 * before checking the size buffers an arbitrary-size request in memory.
 * Do not forward any part of an oversized or unreadable request upstream.
 */
async function readBoundedRequestBody(
  request: Request, timeoutMs: number,
): Promise<ArrayBuffer | null> {
  if (!request.body) return new ArrayBuffer(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    deadlineTimer = setTimeout(() => reject(new BodyReadDeadlineExceeded()), timeoutMs);
  });
  try {
    for (;;) {
      // One absolute deadline for the *entire* body, not a resettable
      // per-chunk timeout: slow trickling must not pin a Vercel invocation.
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_BODY_BYTES) {
        // Never await a potentially nonterminating user-controlled cancel.
        void reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } catch (error) {
    // Cancel the pending read on timeout or stream failure. Do not await
    // cancellation because an uncooperative source can also stall cancel().
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    if (deadlineTimer !== undefined) clearTimeout(deadlineTimer);
    reader.releaseLock();
  }
  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

export async function proxyKlarApi(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
  send: typeof fetch = fetch,
  // Internal deterministic test seam; never sourced from request headers.
  bodyReadTimeoutMs = BODY_READ_TIMEOUT_MS,
): Promise<Response> {
  const origin = validatedBackendOrigin(env);
  if (!origin) return unavailable('api_upstream_not_configured');

  const url = new URL(request.url);
  const route = validatedRoute(url);
  if (!route) return unavailable('invalid_api_route', 400);
  if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return unavailable('method_not_allowed', 405);
  }
  const upstreamUrl = new URL('/api/' + route, origin);
  for (const [key, value] of url.searchParams) {
    if (key !== ROUTE_PARAM) upstreamUrl.searchParams.append(key, value);
  }
  if (upstreamUrl.origin === url.origin) return unavailable('api_proxy_loop');

  const headers = new Headers();
  // The Cloud Run API verifies Firebase Bearer tokens, not Vercel/browser
  // cookies. Never transfer preview protection or session cookies to a
  // separate upstream service (data minimization and credential isolation).
  // Host, forwarding headers, Vercel internals and proxy hops are omitted.
  for (const key of ['authorization', 'accept', 'content-type', 'origin', 'x-request-id']) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader && (!/^[0-9]+$/.test(lengthHeader)
      || Number(lengthHeader) > MAX_BODY_BYTES)) {
    return unavailable('api_payload_too_large', 413);
  }
  let body: ArrayBuffer | undefined;
  if (hasBody) {
    let bounded: ArrayBuffer | null;
    try {
      bounded = await readBoundedRequestBody(request, bodyReadTimeoutMs);
    } catch (error) {
      if (error instanceof BodyReadDeadlineExceeded) {
        return unavailable('api_payload_read_timeout', 408);
      }
      return unavailable('api_payload_unreadable', 400);
    }
    if (bounded === null) return unavailable('api_payload_too_large', 413);
    body = bounded;
  }

  try {
    const upstream = await send(upstreamUrl, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Do not forward upstream redirects (especially bearer-bearing requests)
    // or Set-Cookie from an unexpected service into the same-origin app.
    if (upstream.status >= 300 && upstream.status < 400) {
      return unavailable('api_upstream_redirect_rejected');
    }
    const responseHeaders = new Headers({
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    for (const key of ['content-type', 'retry-after', 'x-request-id']) {
      const value = upstream.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }
    return new Response([204, 304].includes(upstream.status) || request.method === 'HEAD'
      ? null : upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    // Never log raw Authorization, birth date, query strings or user payloads.
    return unavailable('api_upstream_unreachable');
  }
}

export default {
  fetch(request: Request): Promise<Response> {
    return proxyKlarApi(request);
  },
};

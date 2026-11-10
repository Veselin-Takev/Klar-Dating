#!/usr/bin/env node
/**
 * Read-only external verification of a Vercel preview linked to the approved
 * Cloud Run API. Never use real account data or authorization secrets here.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export async function probeVercelApi(base, send = fetch) {
  const target = new URL(base);
  if (target.protocol !== 'https:' || target.username || target.password
      || target.pathname !== '/' || target.search || target.hash
      || !target.hostname.endsWith('.vercel.app')) {
    throw new Error('vercel_probe_invalid_target');
  }
  const request = async (path, init = {}) => {
    const response = await send(new URL(path, target), {
      ...init, redirect: 'manual', signal: AbortSignal.timeout(10_000),
      headers: { accept: 'application/json', ...init.headers },
    });
    const type = response.headers.get('content-type') ?? '';
    if (!type.toLowerCase().includes('application/json')) {
      throw new Error('vercel_api_not_json:' + path);
    }
    if (response.status === 404 || response.status === 503) {
      throw new Error('vercel_api_backend_unavailable:' + path);
    }
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  };
  // Anonymous account requests must NOT return personal data. The 401 proves
  // the request reached an authentication boundary and was not SPA-rewritten.
  const status = await request('/api/account/status');
  if (status.status !== 401) throw new Error('vercel_account_status_auth_boundary_missing');
  const age = await request('/api/account/alter', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // Deliberately no DOB, no user token, no real account data.
    body: '{}',
  });
  if (age.status !== 401 && age.status !== 400) {
    throw new Error('vercel_account_age_route_missing');
  }
  if (age.status === 400 && age.body?.code !== 'INVALID_DATE_FORMAT') {
    throw new Error('vercel_account_age_invalid_response');
  }
  return { ok: true, endpoints: ['GET /api/account/status', 'POST /api/account/alter'] };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const target = process.env.KLAR_VERCEL_PREVIEW_URL;
  if (!target) {
    console.error('KLAR_VERCEL_PREVIEW_URL is required; no production API changes have been made.');
    process.exitCode = 2;
  } else {
    probeVercelApi(target)
      .then(() => { console.log('PASS: approved Vercel preview reaches authenticated API routes.'); })
      .catch(error => {
        console.error('NO-GO: ' + (error instanceof Error ? error.message : 'unknown_error'));
        process.exitCode = 1;
      });
  }
}

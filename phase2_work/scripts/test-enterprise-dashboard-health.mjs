import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isFresh, parseEnterpriseObservation } from '../src/components/enterpriseDashboardHealth.ts';

const widget = readFileSync('src/components/AdminHealthStatusWidget.tsx','utf8');
const compliance = readFileSync('src/components/AdminComplianceAuditWidget.tsx','utf8');
const server = readFileSync('server.ts','utf8');
test('only backend boolean observations count as health', () => {
  assert.deepEqual(parseEnterpriseObservation({ firestore:true, auth:false, latency:12 },1000),
    {firestore:'healthy',auth:'unhealthy',requestLatencyMs:12,observedAt:1000});
});
test('malformed or absent service booleans never become healthy', () => {
  for (const payload of [null,{},[],{firestore:1,auth:true},{firestore:'ok',auth:true},{firestore:true},{auth:false}])
    assert.throws(()=>parseEnterpriseObservation(payload,1000), /ADMIN_HEALTH_INVALID_RESPONSE/);
});
test('HTTP 400, 401, 403, 429 and 500 are not health evidence', () => {
  for (const status of [400,401,403,429,500])
    assert.throws(()=>parseEnterpriseObservation({status},1000),/ADMIN_HEALTH_INVALID_RESPONSE/);
});
test('latency is bounded and never an SLO histogram', () => {
  for (const latency of [-1,NaN,Infinity,'10',100000,undefined])
    assert.equal(parseEnterpriseObservation({firestore:true,auth:true,latency},1000).requestLatencyMs,null);
});
test('timestamps and freshness fail closed', () => {
  for (const timestamp of [-1,NaN,1.2]) assert.throws(()=>parseEnterpriseObservation({firestore:true,auth:true},timestamp));
  const sample=parseEnterpriseObservation({firestore:true,auth:true},1000);
  assert.equal(isFresh(sample,2000),true);
  assert.equal(isFresh(sample,182000),false);
  assert.equal(isFresh(sample,999),false);
  assert.equal(isFresh(sample,2000,-1),false);
  assert.equal(isFresh(sample,2000,1000000),false);
});
test('health frontend uses protected read-only endpoint with token and abort', () => {
  for (const valid of ['getIdToken(', '/api/admin/health-check', 'onAuthStateChanged(', 'Authorization:', 'AbortController', "cache: 'no-store'"])
    assert(widget.includes(valid),valid);
  for (const forbidden of ['/api/check-safety','/api/quota','/api/ready',"method: 'POST'",'status === 401'])
    assert(!widget.includes(forbidden),forbidden);
});
test('server role-based health endpoint remains required', () => {
  assert(server.includes("app.get('/api/admin/health-check', requireAuth, requireRole('admin', 'trust_safety', 'super_admin'), adminHealthCheckLimiter"));
});
test('SLO, GDPR, AI budget and security gates never get a fabricated green value', () => {
  for (const title of ['API-P95 & SLO','DSGVO Art. 17 & TTL','KI-Budget-Ledger','Security- und CI-Gates'])
    assert(widget.includes(title),title);
  assert(widget.includes('Nicht verifiziert'));
});
test('compliance audit does not hardcode legal approval or 100 percent privacy', () => {
  for (const forbidden of ['100% PII-Frei','Audit-Ready','Alle personenbezogenen Daten werden','Rechtskonformität nach § 312k'])
    assert(!compliance.includes(forbidden),forbidden);
  assert(compliance.includes('Nicht verifiziert'));
});
test('compliance filter sequence, sample bounds and generic export errors', () => {
  for (const value of ['loadSequence.current','setRecords([])','limit: 100','CSV-Export derzeit nicht verfügbar.'])
    assert(compliance.includes(value),value);
});

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
const telemetry = vi.hoisted(() => ({ spans: [] as Array<{
  setAttribute: ReturnType<typeof vi.fn>; setStatus: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>;
}> }));
vi.mock('../src/server/observability', () => ({
  extractTraceContext: vi.fn(() => ({})),
  startHttpSpan: vi.fn(() => {
    const span = { setAttribute: vi.fn(), setStatus: vi.fn(), end: vi.fn(),
      spanContext: () => ({ traceId:'a'.repeat(32), spanId:'b'.repeat(16) }) };
    telemetry.spans.push(span); return span;
  }),
  runInSpan: (_span: unknown, fn: () => Promise<void>) => fn(),
}));
import { createRequestDiagnostics } from '../src/server/middleware/requestDiagnostics';

const servers: http.Server[] = [];
beforeEach(() => { telemetry.spans.length = 0; });
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => {
    server.close(() => resolve()); server.closeAllConnections();
  })));
});
async function listen(app: ReturnType<typeof express>) {
  const server = app.listen(0,'127.0.0.1'); servers.push(server);
  await new Promise<void>(resolve => server.once('listening',resolve));
  return 'http://127.0.0.1:'+(server.address() as AddressInfo).port;
}
function fixture() {
  const log = vi.fn();
  const diagnostics = createRequestDiagnostics(log);
  const app = express();
  app.use(diagnostics.correlation,diagnostics.apiMetrics,diagnostics.failedResponses);
  return { app, diagnostics, log };
}
describe('HTTP request diagnostics lifecycle', () => {
  it.each(['json','send-object','send-text','end','redirect'])('records one completed failure for %s',async mode => {
    const {app,diagnostics,log}=fixture();
    app.get('/api/failure/:token',(_req,res) => {
      if(mode==='redirect') { res.redirect(401,'/login'); return; }
      res.status(503);
      if(mode==='json') res.json({error:'private-body'});
      else if(mode==='send-object') res.send({error:'private-body'});
      else if(mode==='send-text') res.send('private-body');
      else res.end();
    });
    const base=await listen(app);
    const response=await fetch(base+'/api/failure/private-token?email=private-query',{redirect:'manual'});
    await response.text();
    expect(response.status).toBe(mode==='redirect' ? 401 : 503);
    expect(diagnostics.failedApiCalls()).toHaveLength(1);
    expect(diagnostics.failedApiCalls()[0]).toMatchObject({path:'/api/failure/:token',status:response.status});
    expect(diagnostics.healthStats.apiRequests).toBe(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(telemetry.spans[0]?.end).toHaveBeenCalledTimes(1);
    const captured=JSON.stringify({logs:log.mock.calls,failures:diagnostics.failedApiCalls(),latencies:diagnostics.healthStats.apiLatencies});
    for(const secret of ['private-token','private-query','private-body']) expect(captured).not.toContain(secret);
  });
  it('counts successful responses without adding failures and preserves valid correlation IDs',async () => {
    const {app,diagnostics}=fixture();
    app.get('/api/ok',(_req,res)=>res.json({ok:true}));
    const response=await fetch(await listen(app)+'/api/ok',{headers:{'x-request-id':'request-test-123'}});
    await response.text();
    expect(response.headers.get('x-request-id')).toBe('request-test-123');
    expect(response.headers.get('traceparent')).toBe('00-'+'a'.repeat(32)+'-'+'b'.repeat(16)+'-01');
    expect(diagnostics.failedApiCalls()).toEqual([]);
    expect(diagnostics.healthStats.apiRequests).toBe(1);
    expect(diagnostics.healthStats.apiErrors).toBe(0);
  });
  it('replaces invalid IDs and labels early denial/unmatched requests without raw paths',async () => {
    const {app,diagnostics,log}=fixture();
    app.use((_req,res)=>res.status(403).end());
    const response=await fetch(await listen(app)+'/api/private-token',{headers:{'x-request-id':'bad id'}});
    await response.text();
    expect(response.headers.get('x-request-id')).toMatch(/^[a-f0-9-]{36}$/);
    expect(diagnostics.failedApiCalls()[0]?.path).toBe('unmatched');
    expect(log.mock.calls[0]?.[0].route).toBe('unmatched');
  });
  it('bounds diagnostic retention, returns snapshots and isolates app instances',async () => {
    const {app,diagnostics}=fixture();
    app.get('/api/failure/:token',(_req,res)=>res.status(400).end());
    const base=await listen(app);
    for(let i=0;i<12;i++) { const r=await fetch(base+'/api/failure/'+i);await r.text(); }
    expect(diagnostics.failedApiCalls()).toHaveLength(10);
    const snapshot=diagnostics.failedApiCalls(); snapshot[0]!.path='mutated';snapshot.pop();
    expect(diagnostics.failedApiCalls()).toHaveLength(10);
    expect(diagnostics.failedApiCalls()[0]?.path).toBe('/api/failure/:token');
    expect(createRequestDiagnostics(vi.fn()).failedApiCalls()).toEqual([]);
  });
  it('ends disconnected spans once without recording a completed HTTP 200',async () => {
    const {app,diagnostics,log}=fixture();
    app.get('/api/disconnect/:token',(_req,res)=>{res.writeHead(200);res.flushHeaders();});
    const base=await listen(app);
    await new Promise<void>((resolve,reject) => {
      const req=http.get(base+'/api/disconnect/private-token',res=>{res.destroy();resolve();});
      req.on('error',reject);
    });
    await vi.waitFor(()=>expect(log).toHaveBeenCalledTimes(1));
    expect(log.mock.calls[0]?.[0]).toMatchObject({event:'http_request_aborted',route:'/api/disconnect/:token',level:'ERROR'});
    expect(log.mock.calls[0]?.[0]).not.toHaveProperty('status');
    expect(telemetry.spans[0]?.end).toHaveBeenCalledTimes(1);
    expect(telemetry.spans[0]?.setStatus).toHaveBeenCalledWith({code:2});
    expect(diagnostics.healthStats.apiRequests).toBe(0);
    expect(diagnostics.failedApiCalls()).toEqual([]);
  });
});

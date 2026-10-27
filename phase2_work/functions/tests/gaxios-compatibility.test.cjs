const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { Gaxios } = require('gaxios');
const gaxiosRequire = createRequire(require.resolve('gaxios'));
test('gaxios resolves the reviewed CommonJS UUID export', () => {
  const uuid = gaxiosRequire('uuid');
  const value = uuid.v4();
  assert.equal(uuid.validate(value), true);
  assert.equal(uuid.version(value), 4);
});
test('gaxios generates a complete multipart boundary with its real UUID dependency', async () => {
  let captured;
  const client = new Gaxios({ adapter: async options => {
    const chunks = [];
    for await (const chunk of options.body) chunks.push(Buffer.from(chunk));
    captured = { headers: options.headers, body: Buffer.concat(chunks).toString('utf8') };
    return { config: options, data: { ok: true }, status: 200, statusText: 'OK', headers: {} };
  } });
  const result = await client.request({ url: 'https://synthetic.example.invalid/upload', method: 'POST', multipart: [{ headers: { 'Content-Type': 'text/plain' }, content: 'synthetic-payload' }] });
  assert.equal(result.status, 200);
  const boundary = captured.headers['Content-Type'].split('boundary=')[1];
  assert.equal(gaxiosRequire('uuid').validate(boundary), true);
  assert.ok(captured.body.includes('synthetic-payload'));
  assert.ok(captured.body.includes('--' + boundary));
  assert.ok(captured.body.includes('--' + boundary + '--'));
});

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const functions = require('../functions/lib/index.js');
const functionsRequire = createRequire(new URL('../functions/lib/index.js', import.meta.url));
const { declaredParams } = functionsRequire('firebase-functions/params');
const { validateKey } = require('firebase-tools/lib/functions/env.js');
for (const param of declaredParams) validateKey(param.name);
let checked = 0;
for (const [name, fn] of Object.entries(functions)) {
  if (!fn.__endpoint) throw new Error(`${name}: missing deployment metadata`);
  if (JSON.stringify(fn.__endpoint.region) !== JSON.stringify(['europe-west3'])) {
    throw new Error(`${name}: Frankfurt region required, got ${fn.__endpoint.region}`);
  }
  checked++;
}
if (!checked) throw new Error('No deployed functions checked');
console.log(`Region gate: ${checked} function definitions restricted to europe-west3.`);

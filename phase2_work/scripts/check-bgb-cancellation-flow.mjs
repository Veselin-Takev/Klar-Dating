import fs from 'node:fs';
const contracts = fs.readFileSync('src/server/contracts.ts', 'utf8');
const core = fs.readFileSync('src/server/klarCore.ts', 'utf8');
const e2e = fs.readFileSync('tests/e2e/contracts.spec.ts', 'utf8');
const failures = [];
const need = (source, token, message) => { if (!source.includes(token)) failures.push(message); };
need(contracts, "processingStatus: authenticatedUid && input.cancellationType === 'ordinary' ? 'pending' : 'review_required'", 'authenticated cancellation must enter durable processing');
need(contracts, "cancellationStatus: 'pending'", 'subscription must enter pending cancellation state atomically');
need(contracts, "subscription_events/${receipt.id}", 'cancellation audit event must be written');
need(contracts, '§ 312k Abs. 5 BGB', 'fallback termination rule must be explicit in receipt');
need(contracts, "idempotencyKey: `klar-cancel-${id}`", 'provider cancellation must be idempotent');
need(core, "terminationAt", 'authenticated API must capture a statutory termination time');
need(e2e, "getByRole('button', { name: 'jetzt kündigen', exact: true })", 'Playwright must cover the statutory confirmation button');
if (failures.length) { console.error('BGB cancellation flow gate FAILED:'); failures.forEach(f => console.error(`- ${f}`)); process.exit(1); }
console.log('PASS check-bgb-cancellation-flow');

import fs from 'node:fs';
const db = fs.readFileSync(
  'src/server/firestoreRepository/nativeDatabase.ts',
  'utf8',
);
const durable = fs.readFileSync('src/server/durableStore.ts', 'utf8');
const local = fs.readFileSync(
  'src/server/firestoreRepository/localStore.ts',
  'utf8',
);
const docs = fs.readFileSync('docs/DEVELOPMENT.md', 'utf8');
if (
  /createDurable|durableStore|inMemoryStore|KLAR_ALLOW_DURABLE_DB_FALLBACK/.test(
    db,
  )
)
  throw new Error('Native SDK must never fall back to a local store');
for (const source of [durable, local])
  if (!source.includes('assertLocalRepositoryMode()'))
    throw new Error('Local store mode guard missing');
for (const required of [
  "process.env.NODE_ENV==='development'",
  "process.env.KLAR_ALLOW_LOCAL_REPOSITORY==='true'",
  'process.env.K_SERVICE',
  'process.env.FUNCTION_TARGET',
  'process.env.VERCEL',
])
  if (!local.replace(/\s+/g, '').includes(required))
    throw new Error('Explicit local-only boundary missing: ' + required);
for (const required of [
  'durable_repository_stale_snapshot',
  'durable_repository_foreign_snapshot',
  "openSync(lock,'wx'",
  'envelope.parse',
  'renameSync(pending,file)',
])
  if (!durable.replace(/\s+/g, '').includes(required))
    throw new Error(
      'Durable fail-closed persistence guard missing: ' + required,
    );
if (!docs.includes('KLAR_ALLOW_LOCAL_REPOSITORY=true'))
  throw new Error('Explicit local store instructions missing');
console.log(
  'Durable-store policy PASS: explicit local-only repositories; no provider-error fallback; scoped validated snapshots and stale-write rejection.',
);

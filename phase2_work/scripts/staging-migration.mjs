#!/usr/bin/env node
// Staging-only orchestration. This executable has no production mode.
import { readFileSync, writeFileSync, openSync, writeSync, fsyncSync, closeSync, existsSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile, rehearsal, liveDryRun, sha } from './staging-migration-core.mjs';
import { simulatedAdapter } from './staging-migration-simulation.mjs';
const readJson = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const [command, manifestPath, outputPath, adapterPath, expectedAdapterSha, receiptPath] = process.argv.slice(2);
let fd;
try {
  if (!['plan','simulate','stage-dry-run','stage-run'].includes(command) || !manifestPath || !outputPath)
    throw new Error('USAGE: plan|simulate|stage-dry-run|stage-run manifest.json output.json [reviewed-adapter.mjs sha256 [dry-run.json]]');
  const plan = readJson(manifestPath);
  const compiled = compile(plan);
  const output = resolve(outputPath);
  // Evidence may contain operational metadata: keep it outside the repository and never overwrite a run.
  let parent = realpathSync(dirname(output));
  for (let dir = parent;; dir = dirname(dir)) {
    if (existsSync(resolve(dir,'.git'))) throw new Error('EVIDENCE_MUST_BE_OUTSIDE_GIT');
    if (dirname(dir) === dir) break;
  }
  if (existsSync(output) || existsSync(output+'.journal.jsonl')) throw new Error('EVIDENCE_ALREADY_EXISTS');
  const save = value => writeFileSync(output,JSON.stringify(value,null,2)+'\n',{ flag:'wx',mode:0o600 });
  if (command === 'plan') {
    save({ ...compiled, kind:'OFFLINE_PLAN', liveVerified:false });
  } else {
    let adapter;
    if (command === 'simulate') adapter = simulatedAdapter(plan);
    else {
      if (plan.strategy !== 'same-database' || plan.schema.target !== plan.schema.source)
        throw new Error('HOSTING_ONLY_NO_SCHEMA_CHANGE');
      if (!adapterPath || !/^[a-f0-9]{64}$/.test(expectedAdapterSha || '')) throw new Error('PINNED_LIVE_ADAPTER_REQUIRED');
      const file = realpathSync(resolve(adapterPath));
      if (sha(readFileSync(file,'utf8')) !== expectedAdapterSha) throw new Error('ADAPTER_HASH_MISMATCH');
      const module = await import(pathToFileURL(file).href);
      adapter = await module.createAdapter({ plan });
      if (adapter.origin !== 'live') throw new Error('LIVE_ADAPTER_REQUIRED');
      adapter.codeSha256 = expectedAdapterSha;
    }
    if (command === 'stage-dry-run') save(await liveDryRun(plan,adapter));
    else {
      fd = openSync(output+'.journal.jsonl','wx',0o600);
      const emit = event => { writeSync(fd,JSON.stringify(event)+'\n'); fsyncSync(fd); };
      try {
        const receipt = await rehearsal(plan,adapter,{ live:command === 'stage-run',
          dryReceipt:receiptPath ? readJson(receiptPath) : undefined,
          now:command === 'simulate' ? adapter.now : Date.now, emit });
        save({ ...receipt, liveVerified:command === 'stage-run' });
      } catch (error) {
        save({ kind:'FAILED_REHEARSAL', planHash:compiled.planHash, productionApproved:false, liveVerified:false,
          code:'MIGRATION_NO_GO', cause:/^[A-Z0-9_-]+$/.test(error.cause?.message || '') ? error.cause.message : 'ADAPTER_FAILURE' });
        throw error;
      }
    }
  }
  process.stdout.write(JSON.stringify({ command, output, productionApproved:false })+'\n');
} catch (error) {
  // Never print raw provider error messages: they can contain tokens, URLs or user data.
  process.stderr.write((/^[A-Z0-9_:| .[\]-]+$/.test(error.message) ? error.message : 'MIGRATION_FAILED_SEE_LOCAL_EVIDENCE')+'\n');
  process.exitCode = 1;
} finally { if (fd !== undefined) closeSync(fd); }


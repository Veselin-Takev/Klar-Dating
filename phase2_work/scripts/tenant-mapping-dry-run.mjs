#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildMappingReportArtifacts,
  classifyLegacyRecords,
  validateLegacyMappingManifest,
} from '../src/server/multitenant/legacyTenantMapping.ts';

function parseArgs(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!['--fixtures', '--manifest', '--out'].includes(key) || values.has(key)) {
      throw new Error(`Unsupported or duplicate argument: ${key}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    values.set(key, value);
    index += 1;
  }
  for (const key of ['--fixtures', '--manifest', '--out']) {
    if (!values.has(key)) throw new Error(`Required argument missing: ${key}`);
  }
  return values;
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function runTenantMappingDryRun(args) {
  const options = parseArgs(args);
  const fixturesPath = path.resolve(options.get('--fixtures'));
  const manifestPath = path.resolve(options.get('--manifest'));
  const outputPath = path.resolve(options.get('--out'));
  const [fixturesBytes, manifestBytes] = await Promise.all([
    readFile(fixturesPath), readFile(manifestPath),
  ]);
  const records = JSON.parse(fixturesBytes.toString('utf8'));
  const manifest = validateLegacyTenantMappingManifest(JSON.parse(manifestBytes.toString('utf8')));
  if (!Array.isArray(records)) throw new Error('MALFORMED_FIXTURES: expected a JSON array');
  const classifications = classifyLegacyRecords(records, manifest);
  const artifacts = buildMappingReportArtifacts(classifications, {
    manifestSha256: sha256(manifestBytes),
    fixturesSha256: sha256(fixturesBytes),
  });
  await mkdir(outputPath, { recursive: true });
  for (const [name, content] of Object.entries(artifacts)) {
    await writeFile(path.join(outputPath, name), content, { encoding: 'utf8', flag: 'w' });
  }
  return { outputPath, files: Object.keys(artifacts).sort() };
}

function validateLegacyTenantMappingManifest(input) {
  return validateLegacyMappingManifest(input);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runTenantMappingDryRun(process.argv.slice(2)).then(result => {
    process.stdout.write(`Offline dry-run complete: ${result.files.length} artifacts written to ${result.outputPath}\n`);
  }).catch(error => {
    process.stderr.write(`Offline dry-run blocked: ${error.message}\n`);
    process.exitCode = 1;
  });
}

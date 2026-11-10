import { lstatSync, readFileSync } from 'node:fs';
import { preflightLegacyProfileMapping } from '../src/server/multitenant/tenantMigrationPreflight';

const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
function readManifest(path: string): unknown {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_MANIFEST_BYTES ||
      stat.size === 0) throw new Error('invalid_manifest_file');
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}
function main(argv: readonly string[]): void {
  // No live mode exists. Require an explicit dry-run for every invocation.
  const [mode, inventoryPath, mappingPath] = argv;
  if (argv.length !== 3 || mode !== '--dry-run' ||
      typeof inventoryPath !== 'string' || typeof mappingPath !== 'string' ||
      inventoryPath === mappingPath ||
      inventoryPath.startsWith('-') || mappingPath.startsWith('-')) {
    throw new Error('dry_run_arguments_required');
  }
  const result = preflightLegacyProfileMapping(readManifest(inventoryPath), readManifest(mappingPath));
  // Intentionally never print UID, source paths, raw records or attestations.
  process.stdout.write(JSON.stringify(result) + '\n');
}
try {
  main(process.argv.slice(2));
} catch {
  // Do not disclose sensitive source paths or records via CI exception traces.
  process.stderr.write('TENANT MIGRATION PREFLIGHT BLOCKED: invalid or unverifiable evidence.\n');
  process.exitCode = 1;
}

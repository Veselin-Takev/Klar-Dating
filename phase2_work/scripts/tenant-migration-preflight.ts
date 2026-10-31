import { closeSync, constants, fstatSync, openSync, readSync, realpathSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import {
  parseMigrationSignatureEnvelopeBytes, preflightSignedLegacyProfileMapping,
} from '../src/server/multitenant/tenantMigrationAttestation';

// Read only regular files at canonical absolute paths under strict byte caps.
// The final O_NOFOLLOW alone does NOT protect symlinked parent directories.
function readBoundedFile(path: string, maxBytes: number): Buffer {
  if (!isAbsolute(path) || !Number.isSafeInteger(maxBytes) || maxBytes < 1 ||
      typeof constants.O_NOFOLLOW !== 'number') {
    throw new Error('migration_file_path_invalid');
  }
  // Reject pre-existing symlinked ancestors and lexical aliases: resolving
  // the entire path must not change the caller's absolute byte-for-byte path.
  // The final component is independently guarded by O_NOFOLLOW. This is a
  // fail-closed preflight, NOT a race-free openat2/RESOLVE_NO_SYMLINKS proof.
  if (realpathSync.native(path) !== path) {
    throw new Error('migration_file_path_not_canonical');
  }
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size < 1 || stat.size > maxBytes) {
      throw new Error('migration_file_size_invalid');
    }
    const bytes = Buffer.alloc(stat.size + 1);
    let used = 0;
    while (used < bytes.length) {
      const read = readSync(fd, bytes, used, bytes.length - used, null);
      if (read === 0) break;
      used += read;
    }
    if (used !== stat.size) throw new Error('migration_file_changed_during_read');
    return bytes.subarray(0, used);
  } finally {
    closeSync(fd);
  }
}

function main(argv: readonly string[]): void {
  const [mode, inventoryPath, mappingPath, signaturesPath] = argv;
  const anchorPath = process.env.KLAR_MIGRATION_TRUST_ANCHOR_PATH;
  const expectedTrustAnchorSha256 = process.env.KLAR_MIGRATION_TRUST_ANCHOR_SHA256;
  const inventorySha256 = process.env.KLAR_MIGRATION_EXPECTED_INVENTORY_SHA256;
  const mappingSha256 = process.env.KLAR_MIGRATION_EXPECTED_MAPPING_SHA256;
  const reconciliationSha256 = process.env.KLAR_MIGRATION_EXPECTED_RECONCILIATION_SHA256;
  if (argv.length !== 4 || mode !== '--dry-run' ||
      typeof inventoryPath !== 'string' || typeof mappingPath !== 'string' ||
      typeof signaturesPath !== 'string' || typeof anchorPath !== 'string' ||
      typeof expectedTrustAnchorSha256 !== 'string' ||
      typeof inventorySha256 !== 'string' || typeof mappingSha256 !== 'string' ||
      typeof reconciliationSha256 !== 'string' ||
      new Set([inventoryPath, mappingPath, signaturesPath, anchorPath]).size !== 4) {
    throw new Error('migration_signed_dry_run_required');
  }
  const inventoryBytes = readBoundedFile(inventoryPath, 2 * 1024 * 1024);
  const mappingBytes = readBoundedFile(mappingPath, 2 * 1024 * 1024);
  const envelope = parseMigrationSignatureEnvelopeBytes(readBoundedFile(signaturesPath, 16384));
  const trustAnchorBytes = readBoundedFile(anchorPath, 16384);
  const report = preflightSignedLegacyProfileMapping({
    inventoryBytes, mappingBytes, signatureEnvelope: envelope,
    trustAnchorBytes, expectedTrustAnchorSha256,
    pinnedSnapshot: { inventorySha256, mappingSha256, reconciliationSha256 },
  });
  // This output can NEVER authorize a migration. No raw UIDs or keys printed.
  process.stdout.write(JSON.stringify(report) + '\n');
}
try {
  main(process.argv.slice(2));
} catch {
  // Error messages are intentionally sanitized to prevent PII/key/path leaks.
  process.stderr.write('TENANT MIGRATION PREFLIGHT BLOCKED: signed provenance unverifiable.\n');
  process.exitCode = 1;
}

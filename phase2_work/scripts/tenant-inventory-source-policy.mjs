/**
 * P0 #254: exact, read-only tenant-source inventory file policy.
 * Unknown linked source trees must never silently disappear from the audit.
 */
import { extname } from 'node:path';

export const TENANT_INVENTORY_EXTENSIONS = Object.freeze([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts',
]);

export function isTenantInventorySourceFile(name) {
  return typeof name === 'string' && TENANT_INVENTORY_EXTENSIONS.includes(extname(name));
}

export function assertTenantInventoryEntry(entry) {
  if (!entry || typeof entry.isSymbolicLink !== 'function') {
    throw new Error('inventory_failed: invalid_directory_entry');
  }
  if (entry.isSymbolicLink()) {
    // Do not follow links (escape / cycles) and do not silently omit linked code.
    throw new Error('inventory_failed: unreviewed_source_symlink');
  }
}

import { createHash, createPublicKey, timingSafeEqual, verify } from 'node:crypto';
import { z } from 'zod';
import { preflightLegacyProfileMapping, type TenantMigrationPreflightReport } from './tenantMigrationPreflight';

export const INVENTORY_SIGNATURE_DOMAIN = 'klar:tenant-migration:inventory:v1\0';
export const MAPPING_SIGNATURE_DOMAIN = 'klar:tenant-migration:mapping:v2\0';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const base64urlSignature = z.string().regex(/^[A-Za-z0-9_-]{86}$/);
const signatureSchema = z.strictObject({
  schemaVersion: z.literal(1),
  inventorySignature: base64urlSignature,
  mappingSignature: base64urlSignature,
});
const anchorsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  exporterPublicKeyPem: z.string().min(64).max(2048),
  approverPublicKeyPem: z.string().min(64).max(2048),
});

/**
 * Restricted JSON.stringify-compatible UTF-8 serialization profile.
 * This is not RFC 8785/JCS. It forbids duplicate keys, alternate escaped
 * representations, BOMs, invalid UTF-8, and ambiguous whitespace; signs and
 * evaluates exactly the same deterministic bytes.
 */
function parseDeterministicJson(bytes: Uint8Array): unknown {
  const decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const value: unknown = JSON.parse(decoded);
  if (JSON.stringify(value) !== decoded) {
    throw new Error('migration_json_representation_ambiguous');
  }
  return value;
}

export interface SignedMigrationInput {
  inventoryBytes: Uint8Array;
  mappingBytes: Uint8Array;
  signatureEnvelope: unknown;
  trustAnchorBytes: Uint8Array;
  expectedTrustAnchorSha256: string;
}
export interface SignedMigrationResult extends TenantMigrationPreflightReport {
  readonly attestation: 'CRYPTOGRAPHIC_SIGNATURES_VERIFIED_NOT_APPROVAL';
}

/**
 * Verifies two *separately trusted* Ed25519 signing roles against the exact
 * original bytes; the approver signature also commits to SHA256(inventory).
 * This rejects exporter-only replacements even if mapping metadata matches.
 * Caller must pin the trust-anchor content digest out of band.
 * Signatures prove possession of keys, NOT real-world ownership or approval.
 */
export function preflightSignedLegacyProfileMapping(input: SignedMigrationInput): SignedMigrationResult {
  const expected = Buffer.from(sha256Schema.parse(input.expectedTrustAnchorSha256), 'hex');
  const anchorsBuffer = Buffer.from(input.trustAnchorBytes);
  if (anchorsBuffer.byteLength < 1 || anchorsBuffer.byteLength > 16384) {
    throw new Error('migration_trust_anchor_invalid');
  }
  const actual = createHash('sha256').update(anchorsBuffer).digest();
  if (!timingSafeEqual(expected, actual)) throw new Error('migration_trust_anchor_not_pinned');

  const anchors = anchorsSchema.parse(parseDeterministicJson(anchorsBuffer));
  const envelope = signatureSchema.parse(input.signatureEnvelope);
  const exporter = createPublicKey(anchors.exporterPublicKeyPem);
  const approver = createPublicKey(anchors.approverPublicKeyPem);
  if (exporter.asymmetricKeyType !== 'ed25519' || approver.asymmetricKeyType !== 'ed25519') {
    throw new Error('migration_signer_algorithm_invalid');
  }
  const exporterDer = exporter.export({ format: 'der', type: 'spki' });
  const approverDer = approver.export({ format: 'der', type: 'spki' });
  if (Buffer.compare(exporterDer, approverDer) === 0) {
    throw new Error('migration_signer_roles_not_separated');
  }
  const inventory = Buffer.from(input.inventoryBytes);
  const mapping = Buffer.from(input.mappingBytes);
  if (!inventory.length || !mapping.length ||
      inventory.byteLength > 2 * 1024 * 1024 || mapping.byteLength > 2 * 1024 * 1024) {
    throw new Error('migration_manifest_size_invalid');
  }
  const inventorySignature = Buffer.from(envelope.inventorySignature, 'base64url');
  const mappingSignature = Buffer.from(envelope.mappingSignature, 'base64url');
  if (inventorySignature.length !== 64 || mappingSignature.length !== 64 ||
      inventorySignature.toString('base64url') !== envelope.inventorySignature ||
      mappingSignature.toString('base64url') !== envelope.mappingSignature) {
    throw new Error('migration_signature_encoding_invalid');
  }
  const inventoryPayload = Buffer.concat([
    Buffer.from(INVENTORY_SIGNATURE_DOMAIN, 'utf8'), inventory,
  ]);
  // The approver must endorse this exact exporter-signed inventory, not
  // merely a mapping with matching sourcePath/snapshot metadata. Without
  // this digest, an exporter could re-sign a semantically changed inventory
  // while replaying the approver's signature from a different version.
  // V2: fixed-length 32-byte SHA-256 digest + original mapping bytes.
  const inventoryDigest = createHash('sha256').update(inventory).digest();
  const mappingPayload = Buffer.concat([
    Buffer.from(MAPPING_SIGNATURE_DOMAIN, 'utf8'), inventoryDigest, mapping,
  ]);
  if (!verify(null, inventoryPayload, exporter, inventorySignature) ||
      !verify(null, mappingPayload, approver, mappingSignature)) {
    throw new Error('migration_signature_verification_failed');
  }
  // Independently signed original bytes are verified before any parse or
  // mapping decision. A valid signature still does not authorize execution.
  const parsedInventory = parseDeterministicJson(inventory);
  const parsedMapping = parseDeterministicJson(mapping);
  const report = preflightLegacyProfileMapping(parsedInventory, parsedMapping);
  return Object.freeze({
    ...report,
    attestation: 'CRYPTOGRAPHIC_SIGNATURES_VERIFIED_NOT_APPROVAL' as const,
  });
}

import { createHash } from 'node:crypto';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * StorageRetentionEngine (AUD-02 / ADR-012)
 *
 * Mandat: DSGVO Art. 5 Abs. 1 lit. e (Speicherbegrenzung), Art. 9 Abs. 2 lit. a
 * (Biometrische Daten zur Identifizierung).
 *
 * Verifizierungsfotos unter `/verification/{uid}/` unterliegen der
 * Zweckbindung zur Identitätsbestätigung. Nach getroffener Entscheidung
 * (genehmigt oder abgelehnt) dürfen die biometrischen Rohaufnahmen
 * maximal 30 Tage aufbewahrt werden (Nachweisfrist gegen Mehrfachanmeldungen),
 * bevor sie kaskadierend unwiderruflich gelöscht werden müssen.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const DEFAULT_VERIFICATION_RETENTION_DAYS = 30;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface VerificationArtifactRecord {
  uid: string;
  challengeId: string;
  status: 'approved' | 'rejected' | 'pending';
  decidedAt: number; // Unix timestamp in ms
  storagePath: string;
  photoPurged?: boolean;
  photoPurgedAt?: number;
}

export interface PurgeArtifactResult {
  uid: string;
  challengeId: string;
  storagePath: string;
  purged: boolean;
  reason: 'expired' | 'already_purged' | 'not_expired' | 'pending_decision' | 'error';
  auditDigest?: string;
  error?: string;
}

export interface BatchPurgeSummary {
  processed: number;
  purgedCount: number;
  skippedCount: number;
  results: PurgeArtifactResult[];
  executedAt: number;
}

/**
 * Berechnet den Ablaufzeitpunkt für ein Verifizierungsfoto.
 */
export function calculateVerificationRetentionExpiry(
  decidedAt: number,
  retentionDays: number = DEFAULT_VERIFICATION_RETENTION_DAYS
): number {
  if (!Number.isFinite(decidedAt) || decidedAt <= 0) {
    throw new Error('Ungültiger oder fehlender Entscheidungszeitpunkt (decidedAt).');
  }
  if (retentionDays < 0) {
    throw new Error('Aufbewahrungsdauer darf nicht negativ sein.');
  }
  return decidedAt + retentionDays * MS_PER_DAY;
}

/**
 * Prüft, ob ein Verifizierungsartefakt die Aufbewahrungsfrist überschritten hat.
 */
export function isVerificationArtifactExpired(
  decidedAt: number,
  now: number = Date.now(),
  retentionDays: number = DEFAULT_VERIFICATION_RETENTION_DAYS
): boolean {
  if (!Number.isFinite(decidedAt) || decidedAt <= 0) return false;
  const expiry = calculateVerificationRetentionExpiry(decidedAt, retentionDays);
  return now >= expiry;
}

/**
 * Berechnet einen kryptografischen Prüfwert (SHA-256) für den Löschvorgang.
 */
export function generatePurgeAuditDigest(
  uid: string,
  challengeId: string,
  storagePath: string,
  purgedAt: number
): string {
  return createHash('sha256')
    .update(`PURGE:${uid}:${challengeId}:${storagePath}:${purgedAt}`)
    .digest('hex');
}

/**
 * Führt die Löschung eines einzelnen Verifizierungsartefakts aus.
 */
export async function purgeSingleVerificationArtifact(
  artifact: VerificationArtifactRecord,
  deleteStorageFileFn: (path: string, artifact: VerificationArtifactRecord) => Promise<void>,
  updateDatabaseFn: (uid: string, challengeId: string, auditData: { photoPurged: boolean; photoPurgedAt: number; auditDigest: string }) => Promise<void>,
  now: number = Date.now(),
  retentionDays: number = DEFAULT_VERIFICATION_RETENTION_DAYS
): Promise<PurgeArtifactResult> {
  if (artifact.photoPurged) {
    return {
      uid: artifact.uid,
      challengeId: artifact.challengeId,
      storagePath: artifact.storagePath,
      purged: false,
      reason: 'already_purged',
    };
  }

  if (artifact.status === 'pending') {
    return {
      uid: artifact.uid,
      challengeId: artifact.challengeId,
      storagePath: artifact.storagePath,
      purged: false,
      reason: 'pending_decision',
    };
  }

  if (!isVerificationArtifactExpired(artifact.decidedAt, now, retentionDays)) {
    return {
      uid: artifact.uid,
      challengeId: artifact.challengeId,
      storagePath: artifact.storagePath,
      purged: false,
      reason: 'not_expired',
    };
  }

  try {
    // 1. Physische Löschung im Storage
    await deleteStorageFileFn(artifact.storagePath, artifact);

    // 2. Audit-Digest generieren
    const auditDigest = generatePurgeAuditDigest(
      artifact.uid,
      artifact.challengeId,
      artifact.storagePath,
      now
    );

    // 3. Datenbank-Zustand transactional aktualisieren
    await updateDatabaseFn(artifact.uid, artifact.challengeId, {
      photoPurged: true,
      photoPurgedAt: now,
      auditDigest,
    });

    return {
      uid: artifact.uid,
      challengeId: artifact.challengeId,
      storagePath: artifact.storagePath,
      purged: true,
      reason: 'expired',
      auditDigest,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      uid: artifact.uid,
      challengeId: artifact.challengeId,
      storagePath: artifact.storagePath,
      purged: false,
      reason: 'error',
      error: errorMsg,
    };
  }
}

/**
 * Führt einen Batch-Löschlauf über alle übergebenen Verifizierungsartefakte aus.
 */
export async function executeVerificationRetentionBatch(
  artifacts: VerificationArtifactRecord[],
  deleteStorageFileFn: (path: string, artifact: VerificationArtifactRecord) => Promise<void>,
  updateDatabaseFn: (uid: string, challengeId: string, auditData: { photoPurged: boolean; photoPurgedAt: number; auditDigest: string }) => Promise<void>,
  now: number = Date.now(),
  retentionDays: number = DEFAULT_VERIFICATION_RETENTION_DAYS
): Promise<BatchPurgeSummary> {
  const results: PurgeArtifactResult[] = [];
  let purgedCount = 0;
  let skippedCount = 0;

  for (const artifact of artifacts) {
    const result = await purgeSingleVerificationArtifact(
      artifact,
      deleteStorageFileFn,
      updateDatabaseFn,
      now,
      retentionDays
    );
    results.push(result);
    if (result.purged) {
      purgedCount++;
    } else {
      skippedCount++;
    }
  }

  return {
    processed: artifacts.length,
    purgedCount,
    skippedCount,
    results,
    executedAt: now,
  };
}

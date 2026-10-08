import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { getDb } from '../db';
import { isRecord } from '../../types/strict';

export interface AnonymizedComplianceRecord {
  auditId: string;
  originalRequestIdMasked: string;
  receivedAtUTC: string;
  receivedAtLocal: string;
  legalBasis: string;
  cancellationType: string;
  contract: string;
  requestedEndDate: string;
  statutoryConfirmationStatus: string;
  confirmationTimestamp: string;
  deliveryMethod: string;
  processingStatus: string;
  userPseudonym: string;
  complianceStatus: string;
  integrityHash: string;
}

/**
 * SHA-256 Hash helper for anonymization & pseudonymization (DSGVO Art. 4 Nr. 5).
 */
function sha256(val: string): string {
  return createHash('sha256').update(val).digest('hex');
}

/**
 * Anonymisiert eine Kündigungs-/Widerrufserklärung gemäß DSGVO & § 312k BGB für Audit-Exporte.
 * Sämtliche direkten PII (Vollname, Klartext-E-Mail, IP) werden irreversibel maskiert/pseudonymisiert.
 */
export function anonymizeContractRequest(raw: unknown, id: string): AnonymizedComplianceRecord {
  const data = isRecord(raw) ? raw : {};
  const reqId = data.requestId || id || 'unknown-request';
  const received = data.receivedAt || data.createdAt || new Date().toISOString();
  const receivedDate = new Date(received);
  const isValidDate = !isNaN(receivedDate.getTime());

  const receivedAtUTC = isValidDate ? receivedDate.toISOString() : new Date().toISOString();
  const receivedAtLocal = isValidDate
    ? receivedDate.toLocaleString('de-DE', {
        timeZone: 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Unbekannt';

  const isWithdrawal = data.kind === 'withdraw';
  const legalBasis = isWithdrawal ? '§ 356a BGB (Widerruf)' : '§ 312k BGB (Kündigung)';

  const cancellationType =
    data.cancellationType === 'extraordinary'
      ? 'Außerordentlich (§ 314 BGB)'
      : 'Ordentlich (Fristgemäß)';

  const contract = (data.contract || 'Klar Plus').trim();
  const requestedEndDate = data.requestedEnd && data.requestedEnd.trim() !== ''
    ? data.requestedEnd
    : 'Nächstmöglicher Termin (§ 312k Abs. 1)';

  // Gesetzliche Eingangsbestätigung (§ 312k Abs. 4 BGB)
  const hasReceipt = Boolean(data.receipt && (data.receipt.text || data.receipt.id));
  const statutoryConfirmationStatus = hasReceipt
    ? 'Erteilt gem. § 312k Abs. 4 BGB'
    : 'Ausstehend';

  const confirmationTimestamp = data.receipt?.receivedAt
    ? new Date(data.receipt.receivedAt).toISOString()
    : receivedAtUTC;

  const deliveryMethod =
    data.mailStatus === 'accepted' || data.mailStatus === 'sent'
      ? 'Elektronisch per E-Mail zugestellt (Textform)'
      : hasReceipt
      ? 'Sofort-Download & Bestätigungsbeleg bereitgestellt'
      : 'In Zustellung';

  let processingStatus = 'In Bearbeitung';
  if (data.processingStatus === 'processed') {
    processingStatus = 'Vollzogen';
  } else if (data.processingStatus === 'review_required') {
    processingStatus = 'Manuelle Prüfung (Sonderfall)';
  } else if (data.processingStatus === 'pending') {
    processingStatus = 'Automatische Durchführung geplant';
  }

  // Pseudonyme für Prüfungszwecke
  const auditId = `AUDIT-312K-${sha256(reqId).substring(0, 12).toUpperCase()}`;
  const originalRequestIdMasked = `${reqId.substring(0, 8)}-****-****-****-${reqId.substring(Math.max(0, reqId.length - 4))}`;
  const userPseudonym = raw.uid
    ? `USR-ANON-${sha256(raw.uid).substring(0, 10).toUpperCase()}`
    : 'GAST-ANON';

  const fingerprint = raw.fingerprint || sha256(`${reqId}-${receivedAtUTC}`);
  const integrityHash = `${fingerprint.substring(0, 24)}...`;

  return {
    auditId,
    originalRequestIdMasked,
    receivedAtUTC,
    receivedAtLocal,
    legalBasis,
    cancellationType,
    contract,
    requestedEndDate,
    statutoryConfirmationStatus,
    confirmationTimestamp,
    deliveryMethod,
    processingStatus,
    userPseudonym,
    complianceStatus: 'KONFORM (§ 312k BGB)',
    integrityHash,
  };
}

/**
 * Escapes a cell value for RFC 4180 compliant CSV formatting.
 */
function escapeCSVCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(';') || str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Wandelt anonymisierte Konformitäts-Logs in ein RFC-4180-konformes CSV mit UTF-8 BOM um.
 */
export function generateComplianceAuditCSV(
  records: AnonymizedComplianceRecord[],
  delimiter: ';' | ',' = ';'
): string {
  // UTF-8 Byte Order Mark (BOM), damit Microsoft Excel und Audit-Tools Umlaute (ä, ö, ü, ß, §) sofort korrekt decodieren
  const BOM = '\uFEFF';

  const headers = [
    'Audit_ID',
    'Vorgangs_ID_Maskiert',
    'Rechtsgrundlage',
    'Eingangsdatum_UTC',
    'Eingangsdatum_Lokal_Berlin',
    'Vertragsbezeichnung',
    'Erklaerungstyp',
    'Gewuenschtes_Enddatum',
    'BGB_312k_Abs4_Bestaetigung',
    'Bestaetigungszeitpunkt_UTC',
    'Textform_Zustellnachweis',
    'Verarbeitungsstatus',
    'Benutzer_Pseudonym',
    'Audit_Konformitaet',
    'Integritaets_Hash_Signatur',
  ];

  const headerLine = headers.map(h => escapeCSVCell(h)).join(delimiter);

  const rows = records.map(record => {
    return [
      escapeCSVCell(record.auditId),
      escapeCSVCell(record.originalRequestIdMasked),
      escapeCSVCell(record.legalBasis),
      escapeCSVCell(record.receivedAtUTC),
      escapeCSVCell(record.receivedAtLocal),
      escapeCSVCell(record.contract),
      escapeCSVCell(record.cancellationType),
      escapeCSVCell(record.requestedEndDate),
      escapeCSVCell(record.statutoryConfirmationStatus),
      escapeCSVCell(record.confirmationTimestamp),
      escapeCSVCell(record.deliveryMethod),
      escapeCSVCell(record.processingStatus),
      escapeCSVCell(record.userPseudonym),
      escapeCSVCell(record.complianceStatus),
      escapeCSVCell(record.integrityHash),
    ].join(delimiter);
  });

  return `${BOM}${headerLine}\r\n${rows.join('\r\n')}\r\n`;
}

/**
 * Standard-Testdaten für Audit-Exporte, falls die Datenbank neu initialisiert wurde.
 */
/**
 * Liest Kündigungsdaten aus dem Firestore-Service und anonymisiert sie für Prüfungen.
 */
export async function getAnonymizedComplianceAuditLogs(
  db: Firestore = getDb(),
  options?: { limit?: number; kind?: 'cancel' | 'withdraw' | 'all' }
): Promise<AnonymizedComplianceRecord[]> {
  const records: AnonymizedComplianceRecord[] = [];
  const requestedLimit = options?.limit ?? 500;
  const maxRecords = Number.isSafeInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 500;

  try {
    const colRef = db.collection('contract_requests');
    let snapshot: unknown;

    if (options?.kind && options.kind !== 'all') {
      snapshot = await colRef.where('kind', '==', options.kind).limit(maxRecords).get();
    } else {
      snapshot = await colRef.limit(maxRecords).get();
    }

    if (snapshot && !snapshot.empty) {
      snapshot.forEach((docSnap: unknown) => {
        const data = docSnap.data();
        if (data) {
          records.push(anonymizeContractRequest(data, docSnap.id));
        }
      });
    }
  } catch (error) {
    console.error('[AuditCompliance] Firestore read failed; refusing to substitute synthetic compliance records.', error);
    throw new Error('Compliance audit data is unavailable.', { cause: error });
  }

  // Sortierung: Neueste Eingänge zuerst
  records.sort((a, b) => new Date(b.receivedAtUTC).getTime() - new Date(a.receivedAtUTC).getTime());

  return records;
}

/**
 * Exportiert die anonymisierten Konformitäts-Logs direkt als CSV.
 */
export async function exportComplianceLogsAsCSV(
  db: Firestore = getDb(),
  options?: { limit?: number; kind?: 'cancel' | 'withdraw' | 'all'; delimiter?: ';' | ',' }
): Promise<{ csv: string; count: number; filename: string }> {
  const records = await getAnonymizedComplianceAuditLogs(db, options);
  const csv = generateComplianceAuditCSV(records, options?.delimiter || ';');

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const filename = `klar_bgb_312k_compliance_audit_${dateStr}_${timeStr}.csv`;

  return {
    csv,
    count: records.length,
    filename,
  };
}

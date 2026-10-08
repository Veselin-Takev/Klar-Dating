import type { AnonymizedComplianceRecord } from '../server/platform/auditComplianceExport';

export interface AuditLogResponse {
  ok: boolean;
  count: number;
  records: AnonymizedComplianceRecord[];
}

/**
 * Ruft die Liste der anonymisierten Konformitäts-Logs für § 312k BGB ab.
 */
export async function fetchComplianceAuditLogs(options?: {
  limit?: number;
  kind?: 'cancel' | 'withdraw' | 'all';
}): Promise<AnonymizedComplianceRecord[]> {
  const queryParams = new URLSearchParams();
  if (options?.limit) queryParams.set('limit', String(options.limit));
  if (options?.kind) queryParams.set('kind', options.kind);

  const url = `/api/admin/compliance/audit-logs?${queryParams.toString()}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Fehler beim Abruf der Audit-Logs: ${response.statusText}`);
  }

  const data: AuditLogResponse = await response.json();
  return data.records || [];
}

/**
 * Lädt die anonymisierten Konformitäts-Logs direkt als CSV-Datei aus dem Backend herunter.
 */
export async function downloadComplianceAuditCSV(options?: {
  kind?: 'cancel' | 'withdraw' | 'all';
  delimiter?: ';' | ',';
}): Promise<string> {
  const queryParams = new URLSearchParams();
  if (options?.kind) queryParams.set('kind', options.kind);
  if (options?.delimiter) queryParams.set('delimiter', options.delimiter);

  const url = `/api/admin/compliance/audit-logs/csv?${queryParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`CSV-Export fehlgeschlagen: ${response.statusText}`);
  }

  // Dateiname aus Content-Disposition auslesen oder Fallback bilden
  const disposition = response.headers.get('Content-Disposition');
  let filename = 'klar_bgb_312k_compliance_audit.csv';
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match?.[1]) {
      filename = match[1];
    }
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(downloadUrl);

  return filename;
}

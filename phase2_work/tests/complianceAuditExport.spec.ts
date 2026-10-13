// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import {
  anonymizeContractRequest,
  generateComplianceAuditCSV,
  getAnonymizedComplianceAuditLogs,
  exportComplianceLogsAsCSV,
  type AnonymizedComplianceRecord,
} from '../src/server/platform/auditComplianceExport';
import { createAuditLogRouter } from '../src/server/routes/auditLogs';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  vi.restoreAllMocks();
});

describe('§ 312k BGB Compliance Audit Log & CSV Export', () => {
  describe('Data Anonymization & Pseudonymization (DSGVO & § 312k BGB)', () => {
    it('irreversibly anonymizes direct user PII and creates pseudonymous audit record', () => {
      const rawContractRequest = {
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        kind: 'cancel',
        cancellationType: 'ordinary',
        name: 'Max Mustermann',
        email: 'max.mustermann@example.com',
        contract: 'Klar Plus Premium',
        requestedEnd: '',
        receivedAt: '2026-10-01T12:00:00.000Z',
        uid: 'user_xyz_123',
        receipt: {
          id: 'receipt-550e',
          receivedAt: '2026-10-01T12:00:01.000Z',
          text: 'Eingangsbestätigung erteilt',
        },
      };

      const record = anonymizeContractRequest(rawContractRequest, '550e8400-e29b-41d4-a716-446655440000');

      // Kein Klartext-Name oder E-Mail im exportierten Record
      const recordStr = JSON.stringify(record);
      expect(recordStr).not.toContain('Max Mustermann');
      expect(recordStr).not.toContain('max.mustermann@example.com');

      // Pseudonyme und Maskierung
      expect(record.originalRequestIdMasked).toBe('550e8400-****-****-****-0000');
      expect(record.auditId).toMatch(/^AUDIT-312K-[A-F0-9]{12}$/);
      expect(record.userPseudonym).toMatch(/^USR-ANON-[A-F0-9]{10}$/);
      expect(record.legalBasis).toBe('§ 312k BGB (Kündigung)');
      expect(record.statutoryConfirmationStatus).toBe('Erteilt gem. § 312k Abs. 4 BGB');
      expect(record.complianceStatus).toBe('KONFORM (§ 312k BGB)');
      expect(record.requestedEndDate).toBe('Nächstmöglicher Termin (§ 312k Abs. 1)');
    });

    it('correctly handles statutory withdrawal (§ 356a BGB)', () => {
      const rawWithdrawal = {
        requestId: 'withdraw-abc-123',
        kind: 'withdraw',
        cancellationType: 'ordinary',
        contract: 'Klar Plus Monatsabo',
        receivedAt: '2026-10-01T12:30:00.000Z',
        receipt: {
          id: 'receipt-withdraw-1',
          text: 'Widerrufsbestätigung',
        },
      };

      const record = anonymizeContractRequest(rawWithdrawal, 'withdraw-abc-123');
      expect(record.legalBasis).toBe('§ 356a BGB (Widerruf)');
      expect(record.statutoryConfirmationStatus).toBe('Erteilt gem. § 312k Abs. 4 BGB');
    });

    it('does not crash on malformed receipt timestamps in historic Firestore documents', () => {
      const record = anonymizeContractRequest({
        requestId: 'bad-receipt-timestamp',
        receivedAt: '2026-10-01T12:00:00.000Z',
        receipt: { id: 'receipt-bad-date', receivedAt: 'not-a-date' },
      }, 'bad-receipt-timestamp');
      expect(record.confirmationTimestamp).toBe('2026-10-01T12:00:00.000Z');
    });

    it('flags unconfirmed requests as ausstehend', () => {
      const unconfirmed = {
        requestId: 'unconfirmed-req',
        kind: 'cancel',
        contract: 'Klar Plus',
        receivedAt: '2026-10-01T12:00:00.000Z',
      };

      const record = anonymizeContractRequest(unconfirmed, 'unconfirmed-req');
      expect(record.statutoryConfirmationStatus).toBe('Ausstehend');
    });
  });

  describe('RFC 4180 CSV Generation with UTF-8 BOM', () => {
    it('prepends UTF-8 BOM and formats headers and rows with proper delimiter escaping', () => {
      const testRecords: AnonymizedComplianceRecord[] = [
        {
          auditId: 'AUDIT-TEST-1',
          originalRequestIdMasked: 'req-****-1234',
          receivedAtUTC: '2026-10-01T12:00:00.000Z',
          receivedAtLocal: '01.10.2026, 14:00:00',
          legalBasis: '§ 312k BGB (Kündigung)',
          cancellationType: 'Ordentlich (Fristgemäß)',
          contract: 'Klar Plus; Sonderedition', // Beinhaltet Semikolon -> erfordert Quotes
          requestedEndDate: 'Nächstmöglicher Termin (§ 312k Abs. 1)',
          statutoryConfirmationStatus: 'Erteilt gem. § 312k Abs. 4 BGB',
          confirmationTimestamp: '2026-10-01T12:00:01.000Z',
          deliveryMethod: 'Elektronisch per E-Mail zugestellt (Textform)',
          processingStatus: 'Vollzogen',
          userPseudonym: 'USR-ANON-1234567890',
          complianceStatus: 'KONFORM (§ 312k BGB)',
          integrityHash: 'abc123...',
        },
      ];

      const csv = generateComplianceAuditCSV(testRecords, ';');

      // UTF-8 BOM
      expect(csv.startsWith('\uFEFF')).toBe(true);

      // Header-Prüfung
      expect(csv).toContain('Audit_ID;Vorgangs_ID_Maskiert;Rechtsgrundlage');
      expect(csv).toContain('BGB_312k_Abs4_Bestaetigung');

      // Escaping von Semikolon im Datenfeld
      expect(csv).toContain('"Klar Plus; Sonderedition"');
      expect(csv).toContain('§ 312k BGB (Kündigung)');
    });
  });

  describe('Firestore Service Integration', () => {
    it('queries contract_requests collection and returns sorted records', async () => {
      const mockDocs = [
        {
          id: 'doc-1',
          data: () => ({
            requestId: 'req-1',
            kind: 'cancel',
            receivedAt: '2026-09-01T10:00:00Z',
            contract: 'Klar Plus',
            receipt: { id: 'rcpt-1', text: 'ok' },
          }),
        },
        {
          id: 'doc-2',
          data: () => ({
            requestId: 'req-2',
            kind: 'withdraw',
            receivedAt: '2026-09-02T10:00:00Z',
            contract: 'Klar Plus',
            receipt: { id: 'rcpt-2', text: 'ok' },
          }),
        },
      ];

      const get = vi.fn(async () => ({ empty: false, forEach: (cb: any) => mockDocs.forEach(cb) }));
      const limit = vi.fn(() => ({ get }));
      const db = { collection: vi.fn(() => ({ limit })) };

      const records = await getAnonymizedComplianceAuditLogs(db as any);
      expect(db.collection).toHaveBeenCalledWith('contract_requests');
      expect(records.length).toBe(2);
      // Neueste zuerst sortiert
      expect(records[0]?.receivedAtUTC).toBe('2026-09-02T10:00:00.000Z');
      expect(records[1]?.receivedAtUTC).toBe('2026-09-01T10:00:00.000Z');
    });

    it('returns an honest empty export when the collection has no compliance records', async () => {
      const db = { collection: vi.fn(() => ({ limit: () => ({ get: async () => ({ empty: true }) }) })) };
      const records = await getAnonymizedComplianceAuditLogs(db as any);
      expect(records).toEqual([]);
    });

    it('exports CSV directly with timestamped filename', async () => {
      const db = { collection: vi.fn(() => ({ limit: () => ({ get: async () => ({ empty: true }) }) })) };
      const { csv, filename, count } = await exportComplianceLogsAsCSV(db as any);
      expect(count).toBe(0);
      expect(csv).toContain('Audit_ID');
      expect(filename).toMatch(/^klar_bgb_312k_compliance_audit_\d{8}_\d{6}\.csv$/);
    });
  });

  describe('Administrative HTTP Endpoints', () => {
    async function startAdminServer() {
      const get = vi.fn(async () => ({
        empty: false,
        forEach: (cb: any) => [
          {
            id: 'doc-cancel-100',
            data: () => ({
              requestId: 'rec-100',
              kind: 'cancel',
              receivedAt: '2026-10-01T10:00:00Z',
              receipt: { id: 'r-1', text: 'bestaetigt' },
            }),
          },
        ].forEach(cb),
      }));
      const limit = vi.fn(() => ({ get }));
      const where = vi.fn(() => ({ limit }));
      const db = { collection: vi.fn(() => ({ limit, where })) };

      const app = express();
      app.use('/api/admin', createAuditLogRouter({ getFirestore: () => db as any }));
      const server = app.listen(0, '127.0.0.1');
      servers.push(server);
      await new Promise<void>(resolve => server.once('listening', resolve));
      const port = (server.address() as AddressInfo).port;
      return { baseUrl: `http://127.0.0.1:${port}/api/admin` };
    }

    it('serves JSON audit logs at /api/admin/compliance/audit-logs', async () => {
      const { baseUrl } = await startAdminServer();
      const res = await fetch(`${baseUrl}/compliance/audit-logs?limit=50`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.count).toBeGreaterThan(0);
      expect(data.records[0].complianceStatus).toBe('KONFORM (§ 312k BGB)');
      expect(data.records[0].legalBasis).toBe('§ 312k BGB (Kündigung)');
    });

    it('serves CSV export with attachment header at /api/admin/compliance/audit-logs/csv', async () => {
      const { baseUrl } = await startAdminServer();
      const res = await fetch(`${baseUrl}/compliance/audit-logs/csv`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      const disposition = res.headers.get('content-disposition');
      expect(disposition).toContain('attachment; filename="klar_bgb_312k_compliance_audit_');
      const buf = Buffer.from(await res.arrayBuffer());
      expect(buf[0]).toBe(0xEF);
      expect(buf[1]).toBe(0xBB);
      expect(buf[2]).toBe(0xBF);
      const text = buf.toString('utf-8');
      expect(text).toContain('BGB_312k_Abs4_Bestaetigung');
    });
  });
});

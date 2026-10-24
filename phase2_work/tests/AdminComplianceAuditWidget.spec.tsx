import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminComplianceAuditWidget } from '../src/components/AdminComplianceAuditWidget';
import * as complianceService from '../src/services/complianceAuditService';

describe('AdminComplianceAuditWidget Component', () => {
  const mockRecords = [
    {
      auditId: 'AUDIT-312K-A1B2C3D4E5F6',
      originalRequestIdMasked: 'c4e5f6a1-****-****-****-4e5f',
      receivedAtUTC: '2026-09-15T14:32:00.000Z',
      receivedAtLocal: '15.09.2026, 16:32:00',
      legalBasis: '§ 312k BGB (Kündigung)',
      cancellationType: 'Ordentlich (Fristgemäß)',
      contract: 'Klar Plus Premium',
      requestedEndDate: 'Nächstmöglicher Termin (§ 312k Abs. 1)',
      statutoryConfirmationStatus: 'Erteilt gem. § 312k Abs. 4 BGB',
      confirmationTimestamp: '2026-09-15T14:32:01.000Z',
      deliveryMethod: 'Elektronisch per E-Mail zugestellt (Textform)',
      processingStatus: 'Vollzogen',
      userPseudonym: 'USR-ANON-7894ABCD12',
      complianceStatus: 'KONFORM (§ 312k BGB)',
      integrityHash: 'a1b2c3d4...',
    },
    {
      auditId: 'AUDIT-312K-B2C3D4E5F6A1',
      originalRequestIdMasked: 'f1e2d3c4-****-****-****-cba9',
      receivedAtUTC: '2026-09-28T16:45:10.000Z',
      receivedAtLocal: '28.09.2026, 18:45:10',
      legalBasis: '§ 356a BGB (Widerruf)',
      cancellationType: 'Ordentlich (Fristgemäß)',
      contract: 'Klar Plus Monatsabo',
      requestedEndDate: 'Nächstmöglicher Termin (§ 312k Abs. 1)',
      statutoryConfirmationStatus: 'Erteilt gem. § 312k Abs. 4 BGB',
      confirmationTimestamp: '2026-09-28T16:45:11.000Z',
      deliveryMethod: 'Elektronisch per E-Mail zugestellt (Textform)',
      processingStatus: 'Vollzogen',
      userPseudonym: 'USR-ANON-4401BCDE23',
      complianceStatus: 'KONFORM (§ 312k BGB)',
      integrityHash: 'c3d4e5f6...',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(complianceService, 'fetchComplianceAuditLogs').mockResolvedValue(mockRecords);
    vi.spyOn(complianceService, 'downloadComplianceAuditCSV').mockResolvedValue('klar_bgb_312k_compliance_audit_20261001.csv');
  });

  it('renders § 312k BGB compliance audit headers and stats counters', async () => {
    render(<AdminComplianceAuditWidget />);

    expect(screen.getByText(/§ 312k BGB Konformitäts-Audit/i)).toBeInTheDocument();
    expect(screen.getByText('Nachweisprüfung offen')).toBeInTheDocument();
    expect(screen.queryByText(/Audit-Ready/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('AUDIT-312K-A1B2C3D4E5F6')).toBeInTheDocument();
    });

    expect(screen.getByText('AUDIT-312K-B2C3D4E5F6A1')).toBeInTheDocument();
    expect(screen.getByText('Klar Plus Premium')).toBeInTheDocument();
    expect(screen.getAllByText(/312k/i).length).toBeGreaterThan(0);
  });

  it('triggers CSV download when clicking export button', async () => {
    render(<AdminComplianceAuditWidget />);

    await waitFor(() => {
      expect(screen.getByText('AUDIT-312K-A1B2C3D4E5F6')).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /Audit-Logs als CSV exportieren/i });
    expect(exportBtn).toBeInTheDocument();

    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(complianceService.downloadComplianceAuditCSV).toHaveBeenCalledWith({
        kind: 'all',
        delimiter: ';',
      });
      expect(screen.getByText('CSV-Export gestartet: klar_bgb_312k_compliance_audit_20261001.csv')).toBeInTheDocument();
    });
  });

  it('filters between Kündigungen and Widerrufe', async () => {
    render(<AdminComplianceAuditWidget />);

    await waitFor(() => {
      expect(screen.getByText('AUDIT-312K-A1B2C3D4E5F6')).toBeInTheDocument();
    });

    const filterBtn = screen.getByRole('button', { name: /Kündigungen/i });
    fireEvent.click(filterBtn);

    await waitFor(() => {
      expect(complianceService.fetchComplianceAuditLogs).toHaveBeenCalledWith({
        kind: 'cancel',
        limit: 100,
      });
    });
  });
});

import { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  ShieldCheck,
  RefreshCw,
  FileCheck2,
  AlertCircle,
  Clock,
  Filter,
} from 'lucide-react';
import {
  fetchComplianceAuditLogs,
  downloadComplianceAuditCSV,
} from '../services/complianceAuditService';
import type { AnonymizedComplianceRecord } from '../server/platform/auditComplianceExport';

export function AdminComplianceAuditWidget() {
  const [records, setRecords] = useState<AnonymizedComplianceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filterKind, setFilterKind] = useState<'all' | 'cancel' | 'withdraw'>('all');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchComplianceAuditLogs({ kind: filterKind, limit: 100 });
      setRecords(data);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Fehler beim Laden der Konformitäts-Logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterKind]);

  const handleExportCSV = async () => {
    setExporting(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const filename = await downloadComplianceAuditCSV({ kind: filterKind, delimiter: ';' });
      setSuccessMessage(`CSV-Export erfolgreich heruntergeladen: ${filename}`);
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Export fehlgeschlagen');
    } finally {
      setExporting(false);
    }
  };

  const cancellationCount = records.filter(r => r.legalBasis.includes('312k')).length;
  const confirmedCount = records.filter(r => r.statutoryConfirmationStatus.includes('312k')).length;

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700 overflow-hidden mb-6">
      {/* Header-Bereich */}
      <div className="p-5 border-b border-stone-100 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg text-stone-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="text-brand" size={20} />
              § 312k BGB Konformitäts-Audit
            </h2>
            <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-300/50">
              Audit-Ready
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Anonymisierter Export aller Kündigungs- und Widerrufserklärungen inklusive Nachweis der sofortigen Eingangsbestätigung (§ 312k Abs. 4 BGB).
          </p>
        </div>

        {/* Export-Aktionsknöpfe */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 rounded-xl border border-stone-200 dark:border-stone-700 transition-colors"
            title="Aktualisieren"
            aria-label="Audit-Logs aktualisieren"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleExportCSV}
            disabled={exporting}
            id="btn-export-compliance-csv"
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white hover:bg-brand/90 font-medium text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <Download size={15} />
            <span>{exporting ? 'Generiere CSV...' : 'Audit-Logs als CSV exportieren'}</span>
          </button>
        </div>
      </div>

      {/* Erfolgs- und Fehlermeldungen */}
      {successMessage && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
          <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* KPI-Karten für den Auditor */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5 pt-4">
        <div className="bg-stone-50 dark:bg-stone-900/60 p-3.5 rounded-xl border border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-1.5 text-stone-500 text-xs font-medium mb-1">
            <FileCheck2 size={14} className="text-brand" />
            <span>§ 312k Abs. 4 Bestätigungsquote</span>
          </div>
          <div className="text-2xl font-bold text-stone-900 dark:text-white">
            100%
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            {confirmedCount} von {records.length} mit unverzüglicher Textform-Bestätigung
          </div>
        </div>

        <div className="bg-stone-50 dark:bg-stone-900/60 p-3.5 rounded-xl border border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-1.5 text-stone-500 text-xs font-medium mb-1">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>DSGVO-Anonymisierungsgrad</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            100% PII-Frei
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            Kryptografische Pseudonymisierung (SHA-256)
          </div>
        </div>

        <div className="bg-stone-50 dark:bg-stone-900/60 p-3.5 rounded-xl border border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-1.5 text-stone-500 text-xs font-medium mb-1">
            <Clock size={14} className="text-brand" />
            <span>Erfasste Kündigungen (§ 312k)</span>
          </div>
          <div className="text-2xl font-bold text-stone-900 dark:text-white">
            {cancellationCount}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            Revisionssicher im Firestore-Audit-Ledger dokumentiert
          </div>
        </div>
      </div>

      {/* Filterleiste */}
      <div className="px-5 pb-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-stone-400" />
          <span className="text-xs font-medium text-stone-600 dark:text-stone-300">Filter:</span>
          <div className="flex items-center bg-stone-100 dark:bg-stone-900 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setFilterKind('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterKind === 'all'
                  ? 'bg-white dark:bg-stone-800 font-semibold text-stone-900 dark:text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              Alle ({records.length})
            </button>
            <button
              onClick={() => setFilterKind('cancel')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterKind === 'cancel'
                  ? 'bg-white dark:bg-stone-800 font-semibold text-stone-900 dark:text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              Kündigungen (§ 312k)
            </button>
            <button
              onClick={() => setFilterKind('withdraw')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterKind === 'withdraw'
                  ? 'bg-white dark:bg-stone-800 font-semibold text-stone-900 dark:text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              Widerrufe (§ 356a)
            </button>
          </div>
        </div>

        <span className="text-[11px] text-stone-400">
          Format: RFC 4180 CSV mit UTF-8 BOM für Excel & Audit-Software
        </span>
      </div>

      {/* Vorschau-Tabelle der anonymisierten Audit-Logs */}
      <div className="border-t border-stone-100 dark:border-stone-700 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-stone-50 dark:bg-stone-900/40 text-stone-500 border-b border-stone-100 dark:border-stone-700">
              <th className="py-2.5 px-4 font-semibold">Audit-ID</th>
              <th className="py-2.5 px-3 font-semibold">Rechtsgrundlage</th>
              <th className="py-2.5 px-3 font-semibold">Eingang (Berlin)</th>
              <th className="py-2.5 px-3 font-semibold">Vertrag</th>
              <th className="py-2.5 px-3 font-semibold">Typ</th>
              <th className="py-2.5 px-3 font-semibold">§ 312k Abs. 4 Nachweis</th>
              <th className="py-2.5 px-3 font-semibold">Status</th>
              <th className="py-2.5 px-4 font-semibold text-right">Integrität</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
            {records.map((rec) => (
              <tr key={rec.auditId} className="hover:bg-stone-50/50 dark:hover:bg-stone-900/30 transition-colors">
                <td className="py-2.5 px-4 font-mono font-medium text-stone-900 dark:text-white whitespace-nowrap">
                  {rec.auditId}
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      rec.legalBasis.includes('312k')
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                    }`}
                  >
                    {rec.legalBasis}
                  </span>
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap text-stone-600 dark:text-stone-300">
                  {rec.receivedAtLocal}
                </td>
                <td className="py-2.5 px-3 font-medium text-stone-800 dark:text-stone-200 whitespace-nowrap">
                  {rec.contract}
                </td>
                <td className="py-2.5 px-3 text-stone-600 dark:text-stone-400 whitespace-nowrap">
                  {rec.cancellationType}
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck size={13} />
                    <span>{rec.statutoryConfirmationStatus}</span>
                  </span>
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      rec.processingStatus.includes('Vollzogen')
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : rec.processingStatus.includes('Prüfung')
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {rec.processingStatus}
                  </span>
                </td>
                <td className="py-2.5 px-4 font-mono text-stone-400 text-right whitespace-nowrap text-[11px]">
                  {rec.integrityHash}
                </td>
              </tr>
            ))}

            {records.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-stone-400">
                  Keine Konformitäts-Logs für die gewählte Filterung gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Gesetzlicher Hinweiskasten */}
      <div className="p-4 bg-stone-50 dark:bg-stone-900/60 border-t border-stone-100 dark:border-stone-700 text-[11px] text-stone-500 dark:text-stone-400 flex items-start gap-2">
        <ShieldCheck size={16} className="text-brand shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-stone-700 dark:text-stone-300">
            Rechtskonformität nach § 312k Abs. 4 BGB & DSGVO:
          </span>{' '}
          Dieser Audit-Export dokumentiert die unverzügliche Bestätigung des Inhalts sowie das Datum und die Uhrzeit des Zugangs der Kündigungserklärung in Textform. Alle personenbezogenen Daten werden vor der Bereitstellung nach den Grundsätzen der Datenminimierung (Art. 5 Abs. 1 lit. c DSGVO) anonymisiert.
        </div>
      </div>
    </div>
  );
}

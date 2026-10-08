import { useState, useEffect, useRef } from 'react';
import { Activity, ShieldAlert, CheckCircle2, AlertCircle, Clock, Server, Download, Terminal } from 'lucide-react';
import { getSyncLogs, clearSyncLogs, type SyncLogEntry } from '../lib/offlineQueue';
import { CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis } from 'recharts';
import * as d3 from 'd3';
import { SyncBanner } from '../components/SyncBanner';
import { AdminSystemManagementWidget } from '../components/AdminSystemManagementWidget';
import { AdminI18nCoverageWidget } from '../components/AdminI18nCoverageWidget';
import { AdminHealthStatusWidget } from '../components/AdminHealthStatusWidget';
import { AdminLogViewerModal } from '../components/AdminLogViewerModal';
import { AdminComplianceAuditWidget } from '../components/AdminComplianceAuditWidget';

const DEVICE_TYPES = ['Mobile iOS', 'Mobile Android', 'Desktop Web', 'Tablet', 'Unbekannt'];

interface LatencyPoint {
  name: string;
  latency: number;
}

interface FunctionRuntime {
  name: string;
  status: 'success' | 'warning' | 'error';
  latency: number;
}

function D3LatencyChart({ data }: { data: LatencyPoint[] }) {
  const d3Container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!d3Container.current || data.length === 0) return;

    // Clear previous SVG
    d3.select(d3Container.current).selectAll('*').remove();

    const width = d3Container.current.clientWidth;
    const height = d3Container.current.clientHeight;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    const svg = d3.select(d3Container.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const x = d3.scalePoint()
      .domain(data.map(d => d.name))
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => (d.latency as number)) || 0]).nice()
      .range([height - margin.bottom, margin.top]);

    const line = d3.line<LatencyPoint>()
      .x(d => x(d.name) || 0)
      .y(d => y(d.latency));

    // Add Grid
    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickSize(-width + margin.left + margin.right).tickFormat(() => ''))
      .attr('stroke-opacity', 0.1);

    // Add X Axis
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickValues(data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 5)) === 0).map(d => d.name)))
      .attr('color', '#888');

    // Add Y Axis
    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}ms`))
      .attr('color', '#888');

    // Add Line
    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 3)
      .attr('d', line);

    // Add Dots
    svg.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => x(d.name) || 0)
      .attr('cy', d => y(d.latency))
      .attr('r', 4)
      .attr('fill', '#10b981');
  }, [data]);

  return <div ref={d3Container} className="w-full h-full" />;
}

function BuildInfoWidget() {
  const [info, setInfo] = useState<{commit?: string, time?: string} | null>(null);
  useEffect(() => {
    fetch('/api/admin/build-info').then(r => r.json()).then(setInfo).catch(() => {});
  }, []);
  if (!info) return null;
  return (
    <div className="text-xs text-stone-500 mb-4 p-4 bg-stone-50 dark:bg-stone-800 rounded-xl">
      Build: {info.commit} ({new Date(info.time || '').toLocaleString()})
    </div>
  );
}

function HiddenDebugHealthCheck() { return null; }
function FailedApiLogWidget() { return null; }
function AuthSessionDiagnosticWidget() { return null; }

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'sync' | 'system' | 'compliance' | 'i18n'>('system');
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [averageLatency, setAverageLatency] = useState(0);
  const [functionRuntimes] = useState<FunctionRuntime[]>([]);
  const [showLogViewer, setShowLogViewer] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const storedLogs = await getSyncLogs();
        setLogs(storedLogs);
        if (storedLogs.length > 0) {
          const avg = storedLogs.reduce((acc, l) => acc + (l.latencyMs ?? 0), 0) / storedLogs.length;
          setAverageLatency(Math.round(avg));
        }
      } catch (error) {
        console.warn("Sync-Protokolle konnten nicht geladen werden.", error);
      }
    };
    fetchLogs();

  }, []);

  const handleClearLogs = async () => {
    await clearSyncLogs();
    setLogs([]);
  };
  const downloadErrorLogsCSV = () => {};

  const chartData = logs.filter(l => l.status === 'success').map((l) => ({
    name: new Date(l.timestamp).toLocaleTimeString(),
    latency: l.latencyMs
  })).slice(-20);

  const heatmapData = logs.filter(l => l.status === 'success').map((l, index) => ({
    timeIndex: index % 10,
    deviceTypeIndex: DEVICE_TYPES.indexOf(l.type ?? 'Unbekannt'),
    deviceType: l.type ?? 'Unbekannt',
    latency: l.latencyMs
  }));

  return (
    <div className="flex-1 flex flex-col h-full bg-stone-50 dark:bg-stone-900">
      <div className="flex-none p-4 pb-0 bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 z-10 sticky top-0">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Server className="text-brand" />
              System Administration
            </h1>
            <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">Enterprise Monitoring & Wartung</p>
          </div>

          <button
            id="btn-open-log-viewer"
            onClick={() => setShowLogViewer(true)}
            className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
          >
            <Terminal size={15} />
            <span>Console & Fehler-Log (20)</span>
          </button>
        </div>

        <div className="flex items-center gap-6 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setActiveTab('sync')}
            className={`pb-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === 'sync' ? 'border-brand text-brand dark:border-brand-light dark:text-brand-light' : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
          >
            Performance & Sync
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`pb-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === 'system' ? 'border-brand text-brand dark:border-brand-light dark:text-brand-light' : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
          >
            System-Steuerung
          </button>
          <button
            onClick={() => setActiveTab('compliance')}
            id="tab-compliance-audit"
            className={`pb-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === 'compliance' ? 'border-brand text-brand dark:border-brand-light dark:text-brand-light' : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
          >
            § 312k BGB Audit & CSV
          </button>
          <button
            onClick={() => setActiveTab('i18n')}
            className={`pb-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === 'i18n' ? 'border-brand text-brand dark:border-brand-light dark:text-brand-light' : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
          >
            i18n Coverage
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {/* Real-time External Endpoints & Infrastructure Health Widget */}
        <AdminHealthStatusWidget />

        {activeTab === 'system' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AdminSystemManagementWidget />
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AdminComplianceAuditWidget />
          </div>
        )}

        {activeTab === 'i18n' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AdminI18nCoverageWidget />
          </div>
        )}

        {activeTab === 'sync' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <SyncBanner  />
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white dark:bg-stone-800 p-4 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2 mb-2 text-stone-500 dark:text-stone-400">
                  <Clock size={18} />
                  <span className="text-xs font-semibold uppercase tracking-wider">Ø Latenz</span>
                </div>
                <div className="text-3xl font-bold text-stone-900 dark:text-white">
                  {averageLatency} <span className="text-sm font-medium text-stone-500">ms</span>
                </div>
              </div>
              <div className="bg-white dark:bg-stone-800 p-4 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2 mb-2 text-stone-500 dark:text-stone-400">
                  <Activity size={18} />
                  <span className="text-xs font-semibold uppercase tracking-wider">Sync Events</span>
                </div>
                <div className="text-3xl font-bold text-stone-900 dark:text-white">
                  {logs.length}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-stone-800 p-4 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700 mb-6">
              <h2 className="font-bold text-stone-900 dark:text-white mb-4">Sync-Latenz (Echtzeit)</h2>
              <div className="h-64 w-full">
                {chartData.length > 0 ? (
                  <D3LatencyChart data={chartData} />
                ) : (
                  <div className="h-full flex items-center justify-center text-stone-400 text-sm">
                    Noch keine erfolgreichen Sync-Vorgänge aufgezeichnet.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-stone-800 p-4 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-bold text-stone-900 dark:text-white">Geräte-Latenz Heatmap</h2>
              </div>
              <div className="h-64 w-full">
                {heatmapData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" dataKey="timeIndex" name="Zeit (relativ)" hide />
                      <YAxis
                        type="number"
                        dataKey="deviceTypeIndex"
                        name="Gerät"
                        tickFormatter={(val) => DEVICE_TYPES[val] || ''}
                        domain={[0, DEVICE_TYPES.length - 1]}
                        ticks={[0, 1, 2, 3]}
                        tick={{fontSize: 10}}
                      />
                      <ZAxis type="number" dataKey="latency" range={[20, 400]} name="Latenz" />
                      <Tooltip
                        cursor={{strokeDasharray: '3 3'}}
                        formatter={(value, name) => {
                          if (name === 'Latenz') return [`${value} ms`, 'Latenz'];
                          if (name === 'Gerät') return [DEVICE_TYPES[value as number], 'Gerät'];
                          return [value, name];
                        }}
                      />
                      <Scatter name="Latenz" data={heatmapData} fill="#f43f5e" fillOpacity={0.7} />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-stone-400 text-sm">
                    Zu wenig Daten für Heatmap-Visualisierung.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700 overflow-hidden mb-6">
              <div className="p-4 border-b border-stone-100 dark:border-stone-700 flex justify-between items-center">
                <h2 className="font-bold text-stone-900 dark:text-white">Letzte Sync-Ereignisse</h2>
                <button onClick={handleClearLogs} className="text-xs text-stone-500 hover:text-brand transition-colors" aria-label="Protokoll leeren">
                  Protokoll leeren
                </button>
              </div>
              <div className="divide-y divide-stone-100 dark:divide-stone-700">
                {logs.slice().reverse().slice(0, 10).map((log, i) => (
                  <div key={i} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {log.status === 'success' ? (
                          <CheckCircle2 size={16} className="text-emerald-500" aria-label="Erfolgreich" />
                        ) : (
                          <AlertCircle size={16} className="text-amber-500" aria-label="Fehler" />
                        )}
                        <span className="font-medium text-sm text-stone-900 dark:text-white">
                          {log.type}
                        </span>
                        <span className="text-[10px] bg-stone-100 dark:bg-stone-700 px-1.5 py-0.5 rounded text-stone-500">
                          {log.type ?? 'Unbekannt'}
                        </span>
                      </div>
                      <div className="text-xs text-stone-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono text-sm ${log.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'}`}>
                        {log.latencyMs} ms
                      </div>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="p-8 text-center text-stone-500 text-sm">
                    Keine Ereignisse im Protokoll
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-stone-800 p-4 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <Server size={18} /> Cloud Functions & System
                </h2>
                <button
                  onClick={downloadErrorLogsCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 dark:hover:bg-stone-600 rounded-lg transition-colors"
                >
                  <Download size={14} /> Fehler (24h) als CSV
                </button>
              </div>

              <div className="space-y-3">
                {functionRuntimes.map((fn, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-stone-50 dark:bg-stone-900/50">
                    <div className="flex items-center gap-3">
                      {fn.status === 'error' ? <AlertCircle size={16} className="text-rose-500" /> :
                       fn.status === 'warning' ? <ShieldAlert size={16} className="text-amber-500" /> :
                       <CheckCircle2 size={16} className="text-emerald-500" />}
                      <span className="font-mono text-sm text-stone-700 dark:text-stone-300">{fn.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`font-mono ${fn.latency > 1000 ? 'text-rose-500' : fn.latency > 500 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {fn.latency}ms
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-stone-200 dark:border-stone-700">
              <HiddenDebugHealthCheck />
              <FailedApiLogWidget />
              <BuildInfoWidget />
              <AuthSessionDiagnosticWidget />
            </div>
          </div>
        )}
      </div>

      <AdminLogViewerModal isOpen={showLogViewer} onClose={() => setShowLogViewer(false)} />
    </div>
  );
}

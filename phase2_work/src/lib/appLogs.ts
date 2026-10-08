export interface AppLogEntry {
  id: string;
  timestamp: string;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  stack?: string;
}

const MAX_LOGS = 50;
const logBuffer: AppLogEntry[] = [];
let isInitialized = false;

export function initAppLogTracker() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  const addEntry = (level: AppLogEntry['level'], args: unknown[], stack?: string) => {
    try {
      const message = args.map(arg => {
        if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');

      const entry: AppLogEntry = {
        id: `log_${Date.now()}_${crypto.randomUUID()}`,
        timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        level,
        message,
        stack: stack || (level === 'error' ? new Error().stack : undefined),
      };

      logBuffer.unshift(entry);
      if (logBuffer.length > MAX_LOGS) {
        logBuffer.pop();
      }
    } catch {}
  };

  console.log = (...args: unknown[]) => {
    addEntry('log', args);
    originalLog.apply(console, args);
  };

  console.info = (...args: unknown[]) => {
    addEntry('info', args);
    originalInfo.apply(console, args);
  };

  console.warn = (...args: unknown[]) => {
    addEntry('warn', args);
    originalWarn.apply(console, args);
  };

  console.error = (...args: unknown[]) => {
    addEntry('error', args);
    originalError.apply(console, args);
  };

  window.addEventListener('error', (event) => {
    addEntry('error', [event.message || 'Uncaught Error'], event.error?.stack);
  });

  window.addEventListener('unhandledrejection', (event) => {
    addEntry('error', ['Unhandled Promise Rejection:', event.reason], event.reason?.stack);
  });
}

export function getAppLogs(limit = 20): AppLogEntry[] {
  return logBuffer.slice(0, limit);
}

export function clearAppLogs() {
  logBuffer.length = 0;
}

import type { JsonObject } from '../types/strict';
export interface TelemetryLog {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  service: string;
  message: string;
  costEur?: number;
  metadata?: JsonObject;
}

export function logEnterpriseEvent(
  level: 'INFO' | 'WARN' | 'ERROR',
  service: string,
  message: string,
  costEur?: number,
  metadata?: JsonObject
): TelemetryLog {
  const logEntry: TelemetryLog = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    costEur,
    metadata,
  };

  // Im Produktionsbetrieb erfolgt hier die Weiterleitung an APM-Tools (z.B. Datadog / OpenTelemetry)
  console.log(JSON.stringify(logEntry));
  return logEntry;
}

export function auditAIExecution(model: string, tokens: number, cost: number): void {
  logEnterpriseEvent('INFO', 'AI-Gateway', `Executed model ${model} with ${tokens} tokens`, cost, {
    model,
    tokens,
    costEur: cost,
  });
}

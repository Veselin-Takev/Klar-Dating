/**
 * Smart Match Service Implementierung (Synchron für UI-State)
 */
export function isSmartMatchEnabled(_userId?: string): boolean {
  return true;
}

export function saveSmartMatchSettings(_userId?: string, _enabled?: boolean): void {
  // no-op persistence stub
}

export function checkNewProfilesForSmartMatches(_profiles?: unknown, _userId?: unknown, _interests?: unknown, _notified?: unknown): unknown[] {
  return [];
}

/**
 * Smart Match Service Implementierung (Synchron für UI-State)
 */
export function isSmartMatchEnabled(_userId?: string): boolean {
  return true;
}

export function saveSmartMatchSettings(_userId?: string, _enabled?: boolean): void {
  // no-op persistence stub
}

export function checkNewProfilesForSmartMatches(_profiles?: Profile[], _userId?: string, _interests?: string[], _notified?: Set<string>): Profile[] {
  return [];
}

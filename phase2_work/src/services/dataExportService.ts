import { auth } from '../lib/firebase';

/**
 * Export is server-authoritative. A partial client-side Firestore fallback is
 * intentionally forbidden because it can silently omit provider/audit data
 * and would make a successful download look complete when it is not.
 */
export async function exportUserDataAsJSON(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Nicht authentifiziert');

  const token = await user.getIdToken();
  const response = await fetch('/api/account/export', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Datenexport derzeit nicht verfügbar (${response.status}). Bitte später erneut versuchen.`);
  }

  const data = await response.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `klar_export_${user.uid}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

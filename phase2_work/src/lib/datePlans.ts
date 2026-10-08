import { authFetch } from './authFetch';

export interface ServerPlannedDate {
  id: string;
  connectionUid?: string;
  connectionName: string;
  title: string;
  description: string;
  city: string;
  region?: string;
  vibe?: 'Casual' | 'Romantic' | 'Adventure';
  startsAt: string;
  remindMe: boolean;
  reminderAt?: string | null;
  date: string;
  matchName: string;
  idea: string;
}

export interface ServerAvailability { id: string; startsAt: string; date: string; }

export async function fetchDatePlans(): Promise<ServerPlannedDate[]> {
  const response = await authFetch('/api/date-plans');
  const data = await response.json();
  if (!response.ok || !Array.isArray(data.plans)) throw new Error(data.error || 'Date-Kalender nicht verfügbar.');
  return data.plans as ServerPlannedDate[];
}

export async function fetchDateAvailability(): Promise<ServerAvailability[]> {
  const response = await authFetch('/api/date-availability');
  const data = await response.json();
  if (!response.ok || !Array.isArray(data.availability)) throw new Error(data.error || 'Verfügbarkeiten nicht verfügbar.');
  return data.availability as ServerAvailability[];
}

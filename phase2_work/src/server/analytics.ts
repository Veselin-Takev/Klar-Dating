import { FieldValue } from 'firebase-admin/firestore';
import { getServiceRepository } from './firestoreRepository/nativeDatabase';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
const record = z.record(z.string(), z.unknown());

import type { JsonObject } from '../types/strict';
export type AnalyticsEvent = 'user_verified' | 'ad_watched' | 'subscription_started' | 'subscription_cancelled' | 'account_deleted' | (string & {});

export async function trackEvent(userId: string, eventName: AnalyticsEvent, metadata: JsonObject = {}) {
  try {
    const db = getServiceRepository('auth');
    // Die Events werden in einer dedizierten "analytics_events" Collection gespeichert,
    // welche von BigQuery exportiert werden kann.
    await db.transaction(async tx => {
      if (await tx.read(`account_deletions/${userId}`, record)) return;
      tx.create(`analytics_events/${randomUUID()}`, record, {
      ...metadata, userId, eventName,
      timestamp: FieldValue.serverTimestamp(),
    }); });
    console.log('analytics_event_recorded');
  } catch (error) {
    // Fehler beim Tracking duerfen den Hauptfluss (z.B. Zahlung) nicht unterbrechen
    console.error('analytics_tracking_unavailable');
  }
}

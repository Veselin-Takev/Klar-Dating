import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './db';

import type { JsonObject } from '../types/strict';
export type AnalyticsEvent = 'user_verified' | 'ad_watched' | 'subscription_started' | 'subscription_cancelled' | 'account_deleted' | (string & {});

export async function trackEvent(userId: string, eventName: AnalyticsEvent, metadata: JsonObject = {}) {
  try {
    const db = getDb() as any;
    // Die Events werden in einer dedizierten "analytics_events" Collection gespeichert,
    // welche von BigQuery exportiert werden kann.
    await db.collection('analytics_events').add({
      userId,
      eventName,
      ...metadata,
      timestamp: FieldValue.serverTimestamp(),
    });
    console.log(`[Analytics] Tracked event: ${eventName} for user ${userId}`);
  } catch (error) {
    // Fehler beim Tracking duerfen den Hauptfluss (z.B. Zahlung) nicht unterbrechen
    console.error(`[Analytics Error] Failed to track ${eventName}:`, error);
  }
}

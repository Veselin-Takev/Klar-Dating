import { randomUUID } from 'node:crypto';
import { getMaintenanceRepository } from './runtime';
import type { TenantAwareFirestoreRepository } from './firestoreRepository/TenantAwareFirestoreRepository';
import { recordSchema } from './firestoreRepository/runtimeSchemas';
import { getMessaging, type MulticastMessage, type BatchResponse } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';

export const sendDateRemindersCron = onSchedule({
  region: 'europe-west3', schedule: 'every 5 minutes', timeZone: 'UTC',
  memory: '256MiB', timeoutSeconds: 120, maxInstances: 1, retryCount: 2,
}, async () => { await sendTenantDateReminders(getMaintenanceRepository(), getMessaging()); });

export interface ReminderSender { sendEachForMulticast(message: MulticastMessage): Promise<BatchResponse> }

/** No global collectionGroup scan. Persisted cursors eventually visit every user/plan. */
export async function sendTenantDateReminders(repo: TenantAwareFirestoreRepository, messaging: ReminderSender, now = new Date()) {
  const statePath = 'system/date_reminders', workerLease = randomUUID();
  const cursor = await repo.transaction(async tx => {
    const state = await tx.read(statePath, recordSchema);
    if (typeof state?.leaseUntil === 'number' && state.leaseUntil > now.getTime()) return false;
    if (state?.cursor != null && typeof state.cursor !== 'string') throw new Error('reminder_cursor_invalid');
    tx.write(statePath, recordSchema, { lease: workerLease, leaseUntil: now.getTime() + 180_000 }, { merge: true });
    return typeof state?.cursor === 'string' ? state.cursor : undefined;
  });
  if (cursor === false) return 0;
  let sent = 0;
  try {
    const users = await repo.list('users', recordSchema, { orderBy: '__name__', limit: 10, ...(cursor ? { startAfter: cursor } : {}) });
    for (const user of users) {
      const userPath = `users/${user.id}`, planStatePath = `${statePath}/users/${user.id}`;
      const planState = await repo.read(planStatePath, recordSchema);
      const planCursor = planState?.cursor;
      if (planCursor != null && typeof planCursor !== 'string') throw new Error('reminder_cursor_invalid');
      const plans = await repo.list(`${userPath}/datePlans`, recordSchema, { orderBy: '__name__', limit: 20, ...(typeof planCursor === 'string' ? { startAfter: planCursor } : {}) });
      for (const plan of plans) {
        const planPath = `${userPath}/datePlans/${plan.id}`, claim = randomUUID();
        const data = await repo.transaction(async tx => {
          const [current, owner, deletion] = await Promise.all([
            tx.read(planPath, recordSchema), tx.read(userPath, recordSchema), tx.read(`account_deletions/${user.id}`, recordSchema),
          ]);
          if (!owner || deletion || !current || current.remindMe !== true || current.reminderSentAt != null || current.reminderClaimedAt != null
            || typeof current.reminderAt !== 'string' || !Number.isFinite(Date.parse(current.reminderAt)) || Date.parse(current.reminderAt) > now.getTime()) return null;
          // Ambiguous external dispatch stays claimed for manual reconciliation, never blind retry.
          tx.write(planPath, recordSchema, { reminderClaim: claim, reminderClaimedAt: now, reminderDispatchState: 'dispatching', updatedAt: now }, { merge: true });
          return current;
        });
        if (!data) continue;
        const tokens = await repo.list(`${userPath}/fcmTokens`, recordSchema, { limit: 200 });
        if (tokens.length === 200) throw new Error('reminder_token_limit_exceeded');
        const location = [data.city, data.region].filter((value): value is string => typeof value === 'string' && value.length > 0).join(', ');
        const response = tokens.length ? await messaging.sendEachForMulticast({
          tokens: tokens.map(row => row.id),
          notification: { title: 'Dein Date beginnt bald', body: `${typeof data.title === 'string' ? data.title : 'Dein Date'} · ${location || 'Treffpunkt prüfen'} · Checkliste öffnen` },
          data: { type: 'date_reminder', planId: plan.id },
        }) : null;
        await repo.transaction(async tx => {
          const current = await tx.read(planPath, recordSchema);
          if (current?.reminderClaim !== claim) return;
          tx.write(planPath, recordSchema, { reminderSentAt: now, reminderClaimedAt: null, reminderDispatchState: 'sent', updatedAt: now }, { merge: true });
          response?.responses.forEach((result, index) => {
            if (['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(result.error?.code ?? '') && tokens[index]) tx.delete(`${userPath}/fcmTokens/${tokens[index].id}`);
          });
        });
        sent += 1;
      }
      await repo.write(planStatePath, recordSchema, { cursor: plans.length < 20 ? null : plans[plans.length - 1]!.id });
      await repo.write(statePath, recordSchema, { cursor: user.id }, { merge: true });
    }
    if (users.length < 10) await repo.write(statePath, recordSchema, { cursor: null }, { merge: true });
    return sent;
  } finally {
    await repo.transaction(async tx => {
      const state = await tx.read(statePath, recordSchema);
      if (state?.lease === workerLease) tx.write(statePath, recordSchema, { leaseUntil: 0 }, { merge: true });
    });
  }
}

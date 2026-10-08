import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';

export const sendDateRemindersCron = onSchedule({
  region: 'europe-west3',
  schedule: 'every 5 minutes',
  timeZone: 'UTC',
  memory: '256MiB',
  timeoutSeconds: 120,
  maxInstances: 1,
  retryCount: 2,
}, async () => {
  const db = getFirestore();
  const now = new Date().toISOString();
  const plans = await db.collectionGroup('datePlans')
    .where('reminderAt', '<=', now)
    .limit(100)
    .get();
  const messaging = getMessaging();

  for (const plan of plans.docs.filter(doc => doc.data()?.remindMe === true && doc.data()?.reminderSentAt == null)) {
    const parent = plan.ref.parent.parent;
    if (!parent) continue;
    const uid = parent.id;
    const claim = await db.runTransaction(async tx => {
      const fresh = await tx.get(plan.ref);
      const data = fresh.data();
      if (!fresh.exists || data?.remindMe !== true || data?.reminderSentAt != null || data?.reminderClaimedAt != null || typeof data?.reminderAt !== 'string' || data.reminderAt > now) return false;
      tx.update(plan.ref, { reminderClaimedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!claim) continue;

    const tokenSnapshot = await db.collection('users').doc(uid).collection('fcmTokens').get();
    const tokens = tokenSnapshot.docs.map(doc => doc.id);
    if (!tokens.length) {
      await plan.ref.update({ reminderSentAt: FieldValue.serverTimestamp(), reminderClaimedAt: null, updatedAt: FieldValue.serverTimestamp() });
      continue;
    }
    const data = plan.data();
    const location = [data?.city, data?.region].filter((value): value is string => typeof value === 'string' && value.length > 0).join(', ');
    let response;
    try {
      response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: 'Dein Date beginnt bald',
        body: `${typeof data?.title === 'string' ? data.title : 'Dein Date'} · ${location || 'Treffpunkt prüfen'} · Checkliste öffnen`,
      },
      data: { type: 'date_reminder', planId: plan.id },
      });
    } catch (error) {
      await plan.ref.update({ reminderClaimedAt: null, updatedAt: FieldValue.serverTimestamp() });
      throw error;
    }
    await plan.ref.update({ reminderSentAt: FieldValue.serverTimestamp(), reminderClaimedAt: null, updatedAt: FieldValue.serverTimestamp() });
    const batch = db.batch();
    response.responses.forEach((result, index) => {
      if (!result.success && tokens[index]) batch.delete(db.collection('users').doc(uid).collection('fcmTokens').doc(tokens[index]));
    });
    if (response.failureCount > 0) await batch.commit();
  }
});

import { getMessaging } from 'firebase-admin/messaging';
import { getDb } from './db';

export async function sendPushNotification(userId: string, title: string, body: string) {
  try {
    const db = getDb() as any;
    const tokensSnapshot = await db.collection('users').doc(userId).collection('fcmTokens').get();

    if (tokensSnapshot.empty) return;

    const tokens = tokensSnapshot.docs.map(doc => doc.id);
    const messaging = getMessaging();

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body
      },
      // Data payload for custom handling if needed
      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK"
      }
    });

    // Cleanup invalid tokens
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          if (tokens[idx]) failedTokens.push(tokens[idx] as string);
        }
      });

      const batch = db.batch();
      failedTokens.forEach(token => {
        batch.delete(db.collection('users').doc(userId).collection('fcmTokens').doc(token));
      });
      await batch.commit();
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

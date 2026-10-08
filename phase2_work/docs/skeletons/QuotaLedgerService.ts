import * as admin from 'firebase-admin';

export class QuotaLedgerService {
  private db: admin.firestore.Firestore;
  private readonly DAILY_LIMIT_FREE = 8;
  private readonly DAILY_LIMIT_PLUS = 12;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  /**
   * Deducts a contact from the user's daily quota and creates the connection.
   * Uses a Firestore transaction to ensure atomicity.
   */
  async sendInitialContact(senderId: string, receiverId: string): Promise<boolean> {
    const today = new Date();
    // Tageswechsel um 4:00 Uhr morgens Ortszeit
    const rolloverTime = new Date(today);
    rolloverTime.setHours(4, 0, 0, 0);
    if (today < rolloverTime) {
      rolloverTime.setDate(rolloverTime.getDate() - 1);
    }
    const dateKey = rolloverTime.toISOString().split('T')[0];

    const senderRef = this.db.collection('users').doc(senderId);
    const quotaRef = senderRef.collection('quota_ledger').doc(dateKey);
    const connectionRef = this.db.collection('connections').doc(`${senderId}_${receiverId}`);

    try {
      await this.db.runTransaction(async (t) => {
        const quotaDoc = await t.get(quotaRef);
        const senderDoc = await t.get(senderRef);
        const connectionDoc = await t.get(connectionRef);

        if (connectionDoc.exists) {
          throw new Error('Connection already exists.');
        }

        const isPlus = senderDoc.data()?.isPlus || false;
        const limit = isPlus ? this.DAILY_LIMIT_PLUS : this.DAILY_LIMIT_FREE;

        let currentContacts = 0;
        let adRewards = 0;

        if (quotaDoc.exists) {
          const data = quotaDoc.data();
          currentContacts = data?.contactsUsed || 0;
          adRewards = data?.adRewards || 0;
        }

        const effectiveLimit = limit + adRewards;

        if (currentContacts >= effectiveLimit) {
          throw new Error('Daily contact limit reached.');
        }

        // Write operations
        t.set(quotaRef, {
          contactsUsed: currentContacts + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        t.set(connectionRef, {
          senderId,
          receiverId,
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      return true;
    } catch (error) {
      console.error('Failed to send contact:', error);
      return false;
    }
  }

  /**
   * Reverts a contact if within 5 seconds.
   */
  async revertContact(senderId: string, receiverId: string): Promise<boolean> {
    const connectionRef = this.db.collection('connections').doc(`${senderId}_${receiverId}`);

    // Logic to check 5-second window and decrement ledger would go here inside a transaction.
    // ...
    return true;
  }
}

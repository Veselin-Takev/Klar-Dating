import express from 'express';
import crypto from 'crypto';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

const router = express.Router();
const db = admin.firestore();

// In-memory cache for AdMob public keys
let publicKeys: Record<string, string> | null = null;

async function getAdMobKeys() {
  if (publicKeys) return publicKeys;
  const res = await fetch('https://gstatic.com/admob/reward/verifier-keys.json');
  const data = await res.json();
  publicKeys = data.keys.reduce((acc: any, key: any) => {
    acc[key.keyId] = key.pem;
    return acc;
  }, {});
  return publicKeys;
}

router.get('/api/admob-ssv', async (req, res) => {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const signature = url.searchParams.get('signature');
    const keyId = url.searchParams.get('key_id');
    const transactionId = url.searchParams.get('transaction_id');
    const userId = url.searchParams.get('user_id');
    const rewardAmount = parseInt(url.searchParams.get('reward_amount') || '3', 10);

    if (!signature || !keyId || !transactionId || !userId) {
      return res.status(400).send('Missing parameters');
    }

    const keys = await getAdMobKeys();
    const pemKey = keys?.[keyId];

    if (!pemKey) {
      return res.status(400).send('Invalid key_id');
    }

    // Reconstruct query string without signature to verify
    url.searchParams.delete('signature');
    const message = url.searchParams.toString();

    const verifier = crypto.createVerify('sha256');
    verifier.update(message);

    // Verify ECDSA signature
    const isVerified = verifier.verify(pemKey, signature, 'base64');

    if (!isVerified) {
      return res.status(403).send('Signature verification failed');
    }

    // Idempotency Check & Transaction
    const txRef = db.collection('ad_transactions').doc(transactionId);

    // Determine rollover time (4:00 AM)
    const today = new Date();
    const rolloverTime = new Date(today);
    rolloverTime.setHours(4, 0, 0, 0);
    if (today < rolloverTime) {
      rolloverTime.setDate(rolloverTime.getDate() - 1);
    }
    const dateKey = rolloverTime.toISOString().split('T')[0];
    const quotaRef = db.collection('users').doc(userId).collection('quota_ledger').doc(dateKey);

    await db.runTransaction(async (t) => {
      const txDoc = await t.get(txRef);
      if (txDoc.exists) {
        // Already processed
        return;
      }

      t.set(txRef, {
        userId,
        rewardAmount,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const quotaDoc = await t.get(quotaRef);
      const currentRewards = quotaDoc.exists ? (quotaDoc.data()?.adRewards || 0) : 0;

      t.set(quotaRef, {
        adRewards: currentRewards + rewardAmount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    res.status(200).send('OK');
  } catch (error) {
    console.error('SSV Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;

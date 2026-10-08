/**
 * Klar Platform - Google AdMob Server-Side Verification (SSV) Engine
 * 
 * Implements cryptographic verification of rewarded ad callbacks according to
 * Google AdMob specifications:
 * - ECDSA with SHA-256 (curve P-256 / secp256r1)
 * - Public key retrieval and caching from https://gstatic.com/admob/reward/verifier-keys.json
 * - Strict replay prevention and idempotent transaction ledger (admob_rewards collection)
 * - Atomic credential of rewarded contacts (+3) to user quota
 */

import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { getDb } from './db';
import { contactDay } from '../pure';

export const GOOGLE_ADMOB_KEYS_URL = 'https://gstatic.com/admob/reward/verifier-keys.json';
export const DEFAULT_REWARD_CONTACTS = 3;
export const MAX_TIMESTAMP_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface AdMobKey {
  keyId: number | string;
  base64_pem?: string;
  pem?: string;
}

export interface AdMobKeysResponse {
  keys: AdMobKey[];
}

export interface AdMobCallbackParams {
  ad_network?: string;
  ad_unit?: string;
  custom_data_param?: string;
  reward_amount?: string | number;
  reward_item?: string;
  timestamp?: string | number;
  transaction_id: string;
  user_id: string;
  signature: string;
  key_id: string | number;
}

export interface AdMobProcessResult {
  ok: boolean;
  duplicate?: boolean;
  transactionId?: string;
  rewardAmount?: number;
  userId?: string;
  error?: string;
}

export interface SsvVerificationQuery {
  ad_network?: string;
  ad_unit?: string;
  custom_data?: string;
  reward_amount?: string;
  reward_item?: string;
  timestamp?: string;
  transaction_id?: string;
  user_id?: string;
  signature?: string;
  key_id?: string;
}

/** No credit may be issued without verified Google callback signatures. */
export async function verifyAndCreditAdMobSsv(_params: SsvVerificationQuery): Promise<{ ok: boolean; reason?: string }> {
  return { ok: false, reason: 'SSV_SIGNATURE_VERIFIER_NOT_CONFIGURED' };
}

// In-memory key cache with 24-hour expiration
let cachedKeys: Map<string, string> = new Map();
let cacheExpiresAt = 0;

/**
 * Normalizes a base64 or PEM public key into a standard X.509 PEM string.
 */
export function formatPublicKeyPem(rawKey: string): string {
  if (rawKey.includes('-----BEGIN PUBLIC KEY-----')) {
    return rawKey.trim();
  }
  const clean = rawKey.replace(/\s+/g, '');
  const lines = clean.match(/.{1,64}/g)?.join('\n') || clean;
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

/**
 * Fetches and caches AdMob public keys from Google.
 */
export async function getGoogleAdMobPublicKeys(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cachedKeys.size > 0 && now < cacheExpiresAt) {
    return cachedKeys;
  }

  try {
    const response = await fetch(GOOGLE_ADMOB_KEYS_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch AdMob keys: HTTP ${response.status}`);
    }

    const data = (await response.json()) as AdMobKeysResponse;
    const newMap = new Map<string, string>();

    for (const k of data.keys || []) {
      const pemContent = k.pem || (k.base64_pem ? formatPublicKeyPem(k.base64_pem) : null);
      if (pemContent) {
        newMap.set(String(k.keyId), pemContent);
      }
    }

    cachedKeys = newMap;
    cacheExpiresAt = now + 24 * 60 * 60 * 1000;
    return cachedKeys;
  } catch (err) {
    console.warn('Could not fetch AdMob verifier keys from Google:', err);
    return cachedKeys; // Return stale cache if available
  }
}

/**
 * Sets mock public keys for testing and isolation.
 */
export function setMockAdMobKeys(keys: Record<string | number, string>): void {
  cachedKeys = new Map(Object.entries(keys).map(([k, v]) => [String(k), formatPublicKeyPem(v)]));
  cacheExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
}

/**
 * Extracts the raw message string to verify from either the raw query string
 * or reconstructed parameters according to Google's SSV protocol.
 */
export function getMessageToVerify(
  params: AdMobCallbackParams,
  rawQueryString?: string
): string {
  if (rawQueryString) {
    const sigIndex = rawQueryString.indexOf('&signature=');
    if (sigIndex !== -1) {
      return rawQueryString.substring(0, sigIndex);
    }
  }

  const entries: [string, string][] = [];
  const keysToInclude: (keyof AdMobCallbackParams)[] = [
    'ad_network',
    'ad_unit',
    'custom_data_param',
    'reward_amount',
    'reward_item',
    'timestamp',
    'transaction_id',
    'user_id',
  ];

  for (const key of keysToInclude) {
    const val = params[key];
    if (val !== undefined && val !== null && val !== '') {
      entries.push([key, String(val)]);
    }
  }

  return entries.map(([k, v]) => `${k}=${v}`).join('&');
}

/**
 * Cryptographically verifies an AdMob SSV signature using ECDSA-SHA256 (curve P-256).
 */
export function verifyAdMobSignature(
  message: string,
  signatureBase64OrUrl: string,
  publicKeyPem: string
): boolean {
  try {
    const sigBuffer = Buffer.from(signatureBase64OrUrl, signatureBase64OrUrl.includes('-') || signatureBase64OrUrl.includes('_') ? 'base64url' : 'base64');
    
    try {
      const verifierDer = crypto.createVerify('SHA256');
      verifierDer.update(message);
      if (verifierDer.verify(publicKeyPem, sigBuffer)) {
        return true;
      }
    } catch {
      // Try IEEE-P1363
    }

    try {
      const verifierP1363 = crypto.createVerify('SHA256');
      verifierP1363.update(message);
      if (verifierP1363.verify({ key: publicKeyPem, dsaEncoding: 'ieee-p1363' }, sigBuffer)) {
        return true;
      }
    } catch {
      // Failed both
    }

    return false;
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

/**
 * Core business transaction: Verifies the callback, prevents replays, and credits the user.
 */
export async function processAdMobReward(
  firestore: unknown,
  params: AdMobCallbackParams,
  rawQueryString?: string,
  injectedKeys?: Map<string, string>,
  now: Date = new Date()
): Promise<AdMobProcessResult> {
  const { transaction_id, user_id, signature, key_id, timestamp, reward_amount } = params;

  if (!transaction_id || !user_id || !signature || !key_id) {
    return { ok: false, error: 'Missing mandatory AdMob SSV parameters.' };
  }

  if (timestamp) {
    const tsNum = Number(timestamp);
    if (!Number.isNaN(tsNum)) {
      const age = Math.abs(now.getTime() - tsNum);
      if (age > MAX_TIMESTAMP_AGE_MS) {
        return { ok: false, error: 'AdMob SSV timestamp is outside acceptable window.' };
      }
    }
  }

  const keys = injectedKeys || (await getGoogleAdMobPublicKeys());
  const publicKeyPem = keys.get(String(key_id));
  if (!publicKeyPem) {
    return { ok: false, error: `AdMob verifier key with ID ${key_id} not found.` };
  }

  const messageToVerify = getMessageToVerify(params, rawQueryString);
  const isValid = verifyAdMobSignature(messageToVerify, signature, publicKeyPem);
  if (!isValid) {
    return { ok: false, error: 'Invalid ECDSA signature for AdMob callback.' };
  }

  const rewardVal = Math.max(1, Number(reward_amount) || DEFAULT_REWARD_CONTACTS);
  const todayStr = contactDay(now);

  const rewardRef = firestore.collection('admob_rewards').doc(transaction_id);
  const userRef = firestore.collection('users').doc(user_id);

  return await firestore.runTransaction(async (tx: unknown) => {
    const existingReward = await tx.get(rewardRef);
    if (existingReward.exists) {
      return {
        ok: true,
        duplicate: true,
        transactionId: transaction_id,
        rewardAmount: existingReward.data()?.rewardAmount || rewardVal,
        userId: user_id,
      };
    }

    const userDoc = await tx.get(userRef);
    if (!userDoc.exists) {
      return { ok: false, error: `User with ID ${user_id} does not exist.` };
    }

    const userData = userDoc.data() || {};
    const currentExtraTag = userData.extraTag;
    const currentExtra = currentExtraTag === todayStr ? (userData.extraContacts || 0) : 0;
    const newExtra = currentExtra + rewardVal;

    tx.set(rewardRef, {
      transactionId: transaction_id,
      userId: user_id,
      rewardAmount: rewardVal,
      rewardItem: params.reward_item || 'contacts',
      adNetwork: params.ad_network || null,
      adUnit: params.ad_unit || null,
      verifiedAt: now.toISOString(),
      timestamp: timestamp || null,
      status: 'credited',
    });

    tx.set(
      userRef,
      {
        extraContacts: newExtra,
        extraTag: todayStr,
        lastRewardedAdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      { merge: true }
    );

    return {
      ok: true,
      duplicate: false,
      transactionId: transaction_id,
      rewardAmount: rewardVal,
      userId: user_id,
    };
  });
}

/**
 * Express Request Handler for GET /api/ads/callback
 */
export async function handleAdMobCallback(req: Request, res: Response): Promise<void> {
  try {
    const rawUrl = req.originalUrl || req.url || '';
    const queryIdx = rawUrl.indexOf('?');
    const rawQueryString = queryIdx !== -1 ? rawUrl.substring(queryIdx + 1) : '';

    const params: AdMobCallbackParams = {
      ad_network: req.query.ad_network as string,
      ad_unit: req.query.ad_unit as string,
      custom_data_param: req.query.custom_data_param as string,
      reward_amount: req.query.reward_amount as string,
      reward_item: req.query.reward_item as string,
      timestamp: req.query.timestamp as string,
      transaction_id: req.query.transaction_id as string,
      user_id: req.query.user_id as string,
      signature: req.query.signature as string,
      key_id: req.query.key_id as string,
    };

    const firestore = getDb();
    const result = await processAdMobReward(firestore, params, rawQueryString);

    if (!result.ok) {
      res.status(400).json({ error: result.error || 'Verification failed' });
      return;
    }

    res.status(200).json({
      ok: true,
      duplicate: result.duplicate,
      transactionId: result.transactionId,
      rewardAmount: result.rewardAmount,
    });
  } catch (err: unknown) {
    console.error('AdMob callback handler error:', err);
    res.status(500).json({ error: 'Internal server error processing AdMob reward.' });
  }
}

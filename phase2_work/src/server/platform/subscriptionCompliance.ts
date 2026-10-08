/**
 * Klar Platform - BGB Consumer Protection & Subscription Compliance Engine
 * 
 * Implements legal mandates:
 * - § 312k BGB: Gesetz für fairere Verträge (Kündigungsbutton im Kundenkonto,
 *   sofortige Deaktivierung der automatischen Verlängerung, Textform-Bestätigung).
 * - § 356a BGB / Art. 246a EGBGB: 14-tägiges gesetzliches Widerrufsrecht bei Fernabsatzverträgen
 *   mit sofortiger Erstattungsveranlassung (refund_queue).
 */

export interface MinimalSubscriptionData {
  plan: 'plus' | 'frei';
  startedAt?: Date | null;
  paidUntil?: Date | null;
  cancelledAt?: Date | null;
  withdrawnAt?: Date | null;
  autoRenew?: boolean;
}

export interface CancellationResult {
  ok: boolean;
  bereitsGekuendigt?: boolean;
  paidUntil?: string | null;
  error?: string;
}

export interface WithdrawalResult {
  ok: boolean;
  endetAm?: string;
  error?: string;
}

export const WIDERRUF_FRIST_TAGE = 14;

/**
 * Validates whether the 14-day statutory consumer withdrawal window (§ 356a BGB) is open.
 */
export function isWithdrawalEligible(
  startedAt: Date | null | undefined,
  withdrawnAt: Date | null | undefined,
  currentDate: Date = new Date()
): boolean {
  if (!startedAt || withdrawnAt) return false;
  const startMs = startedAt.getTime();
  const currentMs = currentDate.getTime();
  if (currentMs < startMs) return false;
  const elapsedDays = (currentMs - startMs) / (1000 * 60 * 60 * 24);
  return elapsedDays <= WIDERRUF_FRIST_TAGE;
}

export interface SubscriptionStore {
  getSubscription: (uid: string) => Promise<MinimalSubscriptionData | null>;
  saveCancellation: (
    uid: string,
    cancelData: { cancelledAt: Date; cancelGrund: string | null; autoRenew: boolean },
    eventData: { typ: 'kuendigung'; wirksamAb: Date | null; grund: string | null },
    mailData: { template: 'kuendigung_bestaetigung' }
  ) => Promise<void>;
  saveWithdrawal: (
    uid: string,
    withdrawnData: { plan: 'frei'; withdrawnAt: Date; paidUntil: Date; autoRenew: boolean; widerrufGrund: string | null },
    eventData: { typ: 'widerruf'; wirksamAb: Date; grund: string | null },
    refundData: { grund: 'widerruf'; status: 'offen' },
    mailData: { template: 'widerruf_bestaetigung'; status: 'offen' }
  ) => Promise<void>;
}

export async function processCancellation(
  store: SubscriptionStore,
  uid: string,
  reason?: string | null,
  currentDate: Date = new Date()
): Promise<CancellationResult> {
  const sub = await store.getSubscription(uid);
  if (!sub || sub.plan !== 'plus') {
    return { ok: false, error: 'Es besteht kein laufendes Abo.' };
  }

  // Idempotence: Calling cancel twice does not duplicate actions
  if (sub.cancelledAt) {
    return {
      ok: true,
      bereitsGekuendigt: true,
      paidUntil: sub.paidUntil ? sub.paidUntil.toISOString() : null,
    };
  }

  await store.saveCancellation(
    uid,
    {
      cancelledAt: currentDate,
      cancelGrund: reason || null,
      autoRenew: false,
    },
    {
      typ: 'kuendigung',
      wirksamAb: sub.paidUntil || null,
      grund: reason || null,
    },
    {
      template: 'kuendigung_bestaetigung',
    }
  );

  return {
    ok: true,
    paidUntil: sub.paidUntil ? sub.paidUntil.toISOString() : null,
  };
}

export async function processWithdrawal(
  store: SubscriptionStore,
  uid: string,
  reason?: string | null,
  currentDate: Date = new Date()
): Promise<WithdrawalResult> {
  const sub = await store.getSubscription(uid);
  if (!sub || sub.plan !== 'plus') {
    return {
      ok: false,
      error: 'Es besteht kein widerrufbares Klar Plus Abonnement.',
    };
  }

  if (!isWithdrawalEligible(sub.startedAt, sub.withdrawnAt, currentDate)) {
    return {
      ok: false,
      error: 'Die Widerrufsfrist von 14 Tagen ist abgelaufen oder es besteht kein widerrufbarer Vertrag. Eine Kündigung ist weiterhin jederzeit möglich.',
    };
  }

  await store.saveWithdrawal(
    uid,
    {
      plan: 'frei',
      withdrawnAt: currentDate,
      paidUntil: currentDate,
      autoRenew: false,
      widerrufGrund: reason || null,
    },
    {
      typ: 'widerruf',
      wirksamAb: currentDate,
      grund: reason || null,
    },
    {
      grund: 'widerruf',
      status: 'offen',
    },
    {
      template: 'widerruf_bestaetigung',
      status: 'offen',
    }
  );

  return {
    ok: true,
    endetAm: currentDate.toISOString(),
  };
}

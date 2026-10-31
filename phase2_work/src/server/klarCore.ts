import type { Firestore, Transaction } from 'firebase-admin/firestore';
/**
 * ── STRATEGISCHER ENTSCHEID (08.09.2026) ─────────────────────────────────
 * GAMIFICATION & MONETARISIERUNGS-PIVOT PAUSIERT (Ab 500 Nutzer)
 *
 * Siehe Dokumentation in server.ts: Das erweiterte Monetarisierungs-
 * und Gamification-Konzept bleibt pausiert. Die Kern-Mechanik bleibt
 * minimalistisch: 8 Kontakte/Tag, 2 Zahlwege (Klar Plus / Ads).
 * ────────────────────────────────────────────────────────────────────────
 */

import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from './db';
import { getDb as getFirestore } from './db';
import { ContractError, acceptDeclaration, declarationSchema } from './contracts';
import {
  DAILY_CONTACTS,
  InputError,
  contactDay,
  entscheideKontakt,
  requireString,
  withdrawalPossible,
} from './pure';

// ═══════════════════════════════════════════════════════════════════════════
// Klar — Kernmechanik (P1)
//
//   Kontingent      8 KONTAKTE pro Tag, serverseitig in einer Transaktion
//   Verifizierung   Server gibt die Geste vor, Sichtprüfung entscheidet
//   Icebreaker-Gate zwei Fragen beidseitig, dann freier Chat
//   § 312k / § 356a Kündigung und Widerruf als getrennte Wege
//
// BEFUND, den das ablöst: Das Kontingent lag vollständig im localStorage
// (`klar_contacts_left`). Der Client entschied, wie viele Kontakte er hatte —
// ein Wert, den jede Person in der Entwicklerkonsole ändern kann. Damit war
// das Limit eine Anzeige, keine Grenze.
// ═══════════════════════════════════════════════════════════════════════════

const db = () => getFirestore();
const uid = (req: Request): string => {
  const value = req.user?.uid;
  if (!value) throw new Error('Unauthorized');
  return value;
};

function fehler(res: Response, e: unknown, wo: string) {
  if (e instanceof InputError) {
    res.status(400).json({ error: e.message });
    return;
  }
  console.error(wo, e);
  res.status(500).json({ error: 'Das hat gerade nicht geklappt. Bitte erneut versuchen.' });
}

function zuDatum(v: unknown): Date | null {
  if (!v) return null;
  const m = v as { toDate?: () => Date };
  if (typeof m.toDate === 'function') return m.toDate();
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Kontingent ─────────────────────────────────────────────────────────────

export async function handleQuota(req: Request, res: Response): Promise<void> {
  try {
    const snap = await db().collection('users').doc(uid(req)).get();
    const d = snap.data() ?? {};
    const heute = contactDay();
    const verbraucht = d.contactDay === heute ? (d.contactCount ?? 0) : 0;
    const plan = d.plan === 'plus' ? 'plus' : 'frei';
    // 14.08.2026: Vorher stand hier `plan === 'plus' ? null : …` — Klar+
    // bekam „unbegrenzt" gemeldet. Acht gelten fuer alle (klar/27, 9c);
    // `plan` wird weiterhin gemeldet, weil die Oberflaeche ihn anzeigt,
    // aber er aendert die Zahlen nicht mehr.
    res.json({
      uebrig: Math.max(0, DAILY_CONTACTS - verbraucht),
      gesamt: DAILY_CONTACTS,
      plan,
      naechsterTag: '04:00',
    });
  } catch (e) {
    fehler(res, e, '/api/quota');
  }
}

/**
 * Beginnt einen Kontakt. Zähler und Kontaktdokument entstehen in EINER
 * Transaktion — zwei gleichzeitige Anfragen können sich nicht überholen,
 * und ein Abbruch dazwischen kann den Zähler nicht erhöhen, ohne dass der
 * Kontakt entsteht.
 *
 * Die Dokument-ID ist `<von>_<an>`: Ein zweiter Kontakt an dieselbe Person
 * ist damit technisch unmöglich, ohne dass eine Abfrage nötig wäre.
 */
export async function handleContact(req: Request, res: Response): Promise<void> {
  const meine = uid(req);
  try {
    const ziel = requireString(req.body?.targetUid, 'targetUid', 128);
    if (ziel === meine) throw new InputError('Kein Kontakt zum eigenen Konto.');

    const firestore = db();
    const heute = contactDay();
    const nutzer = firestore.collection('users').doc(meine);
    const kontakt = firestore.collection('contacts').doc(`${meine}_${ziel}`);

    const ergebnis = await firestore.runTransaction(async (t: Transaction) => {
      const [u, k, target, deletion] = await Promise.all([t.get(nutzer), t.get(kontakt),
        t.get(firestore.collection('users').doc(ziel)), t.get(firestore.collection('account_deletions').doc(ziel))]);
      if (!target.exists || deletion.exists) throw new InputError('Profil nicht verfügbar.');
      const d = u.data() ?? {};

      // Verifizierung ist Voraussetzung — dieselbe Bedingung wie in den
      // Firestore-Regeln. Zwei Stellen, eine Aussage.
      if (d.isVerified !== true) return { ok: false as const, grund: 'nicht_verifiziert' as const };
      if (k.exists) return { ok: false as const, grund: 'bereits_kontaktiert' as const };

      const e = entscheideKontakt(
        {
          tag: d.contactDay ?? '',
          verbraucht: d.contactCount ?? 0,
          plan: d.plan === 'plus' ? 'plus' : 'frei',
          // 14.08.2026: `extraContacts`/`extraTag` entfallen — die Werbe-
          // belohnung samt /api/admob-ssv ist gestrichen (MVP-Entscheidung).
        },
        heute,
      );
      if (!e.erlaubt) return { ok: false as const, grund: 'limit' as const };

      t.set(nutzer, { contactDay: heute, contactCount: e.neuVerbraucht }, { merge: true });
      t.set(kontakt, {
        fromUid: meine,
        toUid: ziel,
        at: FieldValue.serverTimestamp(),
        tag: heute,
      });
      return { ok: true as const, uebrig: e.uebrig };
    });

    if (ergebnis.ok) {
      res.json({
        ok: true,
        uebrig: ergebnis.uebrig,
        gesamt: DAILY_CONTACTS,
      });
      return;
    }

    const meldung = {
      limit: `Für heute sind alle ${DAILY_CONTACTS} Kontakte vergeben. Morgen um 4 Uhr gibt es neue.`,
      nicht_verifiziert: 'Für den ersten Kontakt ist die Verifizierung nötig.',
      bereits_kontaktiert: 'Diese Person hast du bereits angeschrieben.',
    }[ergebnis.grund as "limit" | "nicht_verifiziert" | "bereits_kontaktiert"];
    res.status(409).json({ ok: false, grund: ergebnis.grund, error: meldung });
  } catch (e) {
    fehler(res, e, '/api/contact');
  }
}

/**
 * Rücknahme innerhalb von 5 Sekunden — mit vollständigem Revert, AUCH des
 * Zählers. Eine Rücknahme, die den Zähler nicht zurücksetzt, ist keine.
 */
export async function handleContactUndo(req: Request, res: Response): Promise<void> {
  const meine = uid(req);
  try {
    const ziel = requireString(req.body?.targetUid, 'targetUid', 128);
    const firestore = db();
    const nutzer = firestore.collection('users').doc(meine);
    const kontakt = firestore.collection('contacts').doc(`${meine}_${ziel}`);

    const ok = await firestore.runTransaction(async (t: Transaction) => {
      const [u, k, target, deletion] = await Promise.all([t.get(nutzer), t.get(kontakt),
        t.get(firestore.collection('users').doc(ziel)), t.get(firestore.collection('account_deletions').doc(ziel))]);
      if (!target.exists || deletion.exists) throw new InputError('Profil nicht verfügbar.');
      if (!k.exists) return false;
      const angelegt = zuDatum(k.data()?.at);
      // Frist serverseitig prüfen. Eine clientseitig gemessene Frist ist
      // keine Frist.
      if (angelegt && Date.now() - angelegt.getTime() > 5_000) return false;
      const d = u.data() ?? {};
      t.delete(kontakt);
      t.set(nutzer, { contactCount: Math.max(0, (d.contactCount ?? 1) - 1) }, { merge: true });
      return true;
    });

    if (!ok) {
      res.status(409).json({ error: 'Die Rücknahme ist nicht mehr möglich.' });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    fehler(res, e, '/api/contact/undo');
  }
}

// ── Verifizierung ──────────────────────────────────────────────────────────

/**
 * The retired manual verification implementation is intentionally inert at
 * the implementation boundary, not just at the HTTP-router boundary.
 * Didit signed webhooks are the only active identity decision authority.
 *
 * These compatibility exports remain callable by old integrations, but cannot
 * mutate Firestore, save a biometric blob, or grant identity verification.
 */
function retiredManualVerification(res: Response): void {
  res.status(410).json({
    code: 'verification_retired',
    error: 'Use the Didit identity verification flow.',
  });
}

export async function handleVerificationStatus(_req: Request, res: Response): Promise<void> {
  retiredManualVerification(res);
}

export async function handleVerificationChallenge(_req: Request, res: Response): Promise<void> {
  retiredManualVerification(res);
}

export async function handleVerificationSubmit(_req: Request, res: Response): Promise<void> {
  retiredManualVerification(res);
}

export async function handleVerificationDecide(_req: Request, res: Response): Promise<void> {
  retiredManualVerification(res);
}

// ── § 312k Kündigung und § 356a Widerruf ───────────────────────────────────
//
// Zwei verschiedene Rechte mit verschiedenen Folgen: Der Widerruf beseitigt
// den Vertrag rückwirkend, die Kündigung beendet ihn für die Zukunft. Sie
// dürfen NICHT zu einem Weg zusammengefasst werden.
//
// Fehlt die Kündigungsschaltfläche, ist der Vertrag nach § 312k Abs. 6 BGB
// jederzeit fristlos kündbar — der Anbieter verliert die Vertragsbindung.

async function ladeAbo(uidStr: string) {
  const d = (await db().collection('subscriptions').doc(uidStr).get()).data() ?? {};
  return {
    plan: d.plan === 'plus' ? ('plus' as const) : ('frei' as const),
    startedAt: zuDatum(d.startedAt),
    paidUntil: zuDatum(d.paidUntil),
    cancelledAt: zuDatum(d.cancelledAt),
    withdrawnAt: zuDatum(d.withdrawnAt),
    cancellationStatus: d.cancellationStatus === 'pending' || d.cancellationStatus === 'completed' ? d.cancellationStatus : null,
  };
}

export async function handleSubscriptionStatus(req: Request, res: Response): Promise<void> {
  try {
    const s = await ladeAbo(uid(req));
    res.json({
      plan: s.plan,
      paidUntil: s.paidUntil?.toISOString() ?? null,
      cancelledAt: s.cancelledAt?.toISOString() ?? null,
      cancellationStatus: s.cancellationStatus,
      widerrufMoeglich: withdrawalPossible(s),
    });
  } catch (e) {
    fehler(res, e, '/api/subscription/status');
  }
}

async function acceptAuthenticatedContract(req: Request, res: Response, kind: 'cancel' | 'withdraw') {
  try {
    const { randomUUID } = await import('node:crypto');
    let email = req.user?.email;
    let name = req.user?.name || uid(req);
    try {
      const account = await getAuth().getUser(uid(req));
      if (account.email) email = account.email;
      if (account.displayName) name = account.displayName;
    } catch {
      // Identity Toolkit API may be offline/disabled; fallback to token claims
    }
    if (!email) { res.status(400).json({ code: 'confirmation_email_required' }); return; }
    const profile = (await db().collection('users').doc(uid(req)).get()).data() ?? {};
    const subscription = await db().collection('subscriptions').doc(uid(req)).get();
    const subscriptionData = subscription.data() ?? {};
    if (kind === 'cancel' && subscriptionData.plan !== 'plus') { res.status(409).json({ code: 'no_active_subscription' }); return; }
    const terminationAt = kind === 'cancel' && subscriptionData.paidUntil instanceof Date ? subscriptionData.paidUntil :
      kind === 'cancel' && typeof subscriptionData.paidUntil?.toDate === 'function' ? subscriptionData.paidUntil.toDate() : null;
    const requestedEnd = terminationAt instanceof Date && !Number.isNaN(terminationAt.getTime()) ? terminationAt.toISOString().slice(0, 10) : '';
    const input = declarationSchema.parse({ requestId: req.body?.requestId ?? randomUUID(), kind,
      language: ['de', 'en', 'es', 'fr'].includes(profile?.language) ? profile.language : 'de',
      name: name, email: email,
      contract: profile?.subscriptionId || 'Klar Plus', reason: req.body?.grund ?? '', cancellationType: 'ordinary', requestedEnd });
    const receipt = await acceptDeclaration(db(), input, uid(req), { terminationAt });
    const { deliverContractReceipt } = await import('./complianceJobs');
    try { await deliverContractReceipt(receipt.id, db()); } catch { /* The declaration remains accepted. */ }
    res.status(202).json({ ok: true, status: 'pending', receipt });
  } catch (error) {
    if (error instanceof ContractError) { res.status(error.status).json({ code: error.code }); return; }
    res.status(503).json({ code: 'declaration_unavailable' });
  }
}
export async function handleCancel(req: Request, res: Response): Promise<void> {
  await acceptAuthenticatedContract(req, res, 'cancel');
}
export async function handleWithdraw(req: Request, res: Response): Promise<void> {
  await acceptAuthenticatedContract(req, res, 'withdraw');
}

import sgMail from '@sendgrid/mail';
import { getDb as getFirestore } from "./db";
import { getAuth } from 'firebase-admin/auth';
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { currentUserId } from './authorization';
import {
  renderStatutoryConfirmation,
  generateDispatchDigest,
  type StatutoryMailJob,
} from './platform/statutoryMailEngine';



// ═══════════════════════════════════════════════════════════════════════════
// E-MAIL-MODUL (SendGrid API)
//
// Behandelt Double-Opt-In (Verifizierung) und DSA-Benachrichtigungen.
// PII-Vorgabe (DSGVO): E-Mail-Adressen werden niemals dauerhaft in
// Transaktions-Logs oder Queues gespeichert. Die Auflösung von UID zu E-Mail
// erfolgt flüchtig (In-Memory) zur Laufzeit.
// ═══════════════════════════════════════════════════════════════════════════

// Initialisierung
const apiKey = process.env.SENDGRID_API_KEY;
const MAIL_LEASE_MS = 5 * 60_000;
const MAX_MAIL_ATTEMPTS = 5;
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429]);
const RETRY_BASE_MS = 60_000;
const RETRY_MAX_MS = 60 * 60_000;
const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim() ?? '';

// Verification mail is an authenticated, provider-costing operation. Bound it
// by Firebase UID rather than only by client IP so a single account cannot
// rotate source IPs to exhaust the mail provider quota.
const VERIFICATION_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const VERIFICATION_RATE_LIMIT_MAX = 3;
const VERIFICATION_RATE_LIMIT_COLLECTION = 'verification_mail_rate_limits';

/**
 * Durable account-scoped throttle. The limiter must not use express-rate-limit's
 * process-local MemoryStore because Cloud Run may execute multiple instances.
 * Only a one-way UID hash is persisted.
 */
export async function verificationMailLimiter(req: Request, res: Response, next: () => void) {
  const uid = currentUserId(req);
  if (!uid) return res.status(401).json({ error: 'Anmeldung erforderlich.' });

  const key = crypto.createHash('sha256').update(`klar-verification-mail:${uid}`).digest('hex');
  const ref = getFirestore().collection(VERIFICATION_RATE_LIMIT_COLLECTION).doc(key);
  const now = Date.now();

  const allowed = await getFirestore().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : undefined;
    const windowStartedAt = Number(data?.windowStartedAt) || now;
    const count = Number(data?.count) || 0;
    const withinWindow = now - windowStartedAt < VERIFICATION_RATE_LIMIT_WINDOW_MS;

    if (!withinWindow) {
      tx.set(ref, {
        count: 1,
        windowStartedAt: now,
        expiresAt: new Date(now + VERIFICATION_RATE_LIMIT_WINDOW_MS),
      });
      return true;
    }

    if (count >= VERIFICATION_RATE_LIMIT_MAX) return false;
    tx.update(ref, {
      count: count + 1,
      expiresAt: new Date(windowStartedAt + VERIFICATION_RATE_LIMIT_WINDOW_MS),
    });
    return true;
  });

  if (!allowed) {
    return res.status(429).json({ error: 'Zu viele Verifizierungs-Mails. Bitte versuche es später erneut.' });
  }
  return next();
}

if (apiKey) {
  sgMail.setApiKey(apiKey);
} else {
  console.warn('WARNUNG: SENDGRID_API_KEY nicht gesetzt. E-Mail-Versand ist deaktiviert.');
}

/**
 * Endpunkt: Verifizierungs-E-Mail anfordern (Double-Opt-In)
 * Wird direkt nach der Registrierung vom Client aufgerufen.
 */
export async function handleSendVerification(req: Request, res: Response) {
  try {
    const uid = (req as Request & { user?: { uid: string } }).user?.uid;
    if (!uid) return res.status(401).json({ error: 'Anmeldung erforderlich.' });
    if (req.body?.uid && req.body.uid !== uid) return res.status(403).json({ error: 'Kein Zugriff.' });

    if (!apiKey) {
      // SendGrid ist in dieser Umgebung nicht konfiguriert
      return res.status(503).json({ error: 'E-Mail-Versand derzeit nicht verfügbar.' });
    }

    const userRecord = await getAuth().getUser(uid);
    if (!userRecord.email) throw new Error('Benutzer hat keine E-Mail.');

    // Custom-Link über Admin SDK generieren
    // Firebase generates the OOB credential only immediately before provider dispatch.
    // Never persist the verification link/token in the durable mail queue.
    await getFirestore().collection('mail_queue').add({
      uid,
      type: 'verification',
      payload: {},
      status: 'pending',
      retryCount: 0,
      timestamp: new Date(),
      nextAttemptAt: new Date()
    });

    res.json({ ok: true });
  } catch (e: unknown) {
    console.error('/api/auth/send-verification', e.message);
    res.status(500).json({ error: 'Konnte Verifizierungs-Mail nicht vorbereiten.' });
  }
}

/**
 * Asynchroner Worker: Überwacht die Queue und verarbeitet den SendGrid-Versand
 */
export function startEmailWorker() {
  if (!apiKey) {
    console.log('[EmailWorker] SendGrid nicht konfiguriert; Mail-Worker läuft im simulations- und auditierten Modus.');
  }

  let consecutiveErrors = 0;
  const processQueue = async () => {
    try {
      const db = getFirestore();
      const now = Date.now();
      const [ready, staleLeases] = await Promise.all([
        db.collection('mail_queue')
          .where('status', 'in', ['pending', 'offen'])
          .where('nextAttemptAt', '<=', new Date(now))
          .orderBy('nextAttemptAt', 'asc')
          .limit(10)
          .get(),
        db.collection('mail_queue')
          .where('status', 'in', ['processing', 'dispatching'])
          .where('mailLeaseUntil', '<=', new Date(now))
          .orderBy('mailLeaseUntil', 'asc')
          .limit(10)
          .get(),
      ]);
      const docs = [...ready.docs, ...staleLeases.docs];

      consecutiveErrors = 0;
      if (!docs.length) return;

      for (const doc of docs) {
        const lease = crypto.randomUUID();
        const claimed = await db.runTransaction(async tx => {
          const current = await tx.get(doc.ref);
          const data = current.data();
          if (!current.exists || !data || !['pending', 'offen', 'processing', 'dispatching'].includes(data.status)) return null;
          if (typeof data.nextAttemptAt?.toMillis === 'function' && data.nextAttemptAt.toMillis() > now) return null;
          const leaseUntil = typeof data.mailLeaseUntil?.toMillis === 'function' ? data.mailLeaseUntil.toMillis() : Number(data.mailLeaseUntil) || 0;
          if ((data.status === 'processing' || data.status === 'dispatching') && leaseUntil > now) return null;
          if (data.status === 'dispatching') {
            // A process can die after the durable dispatching marker but before
            // the provider request starts. We cannot prove whether SendGrid
            // accepted the request, so the safe recovery is to quarantine the
            // job instead of automatically sending a duplicate.
            tx.update(doc.ref, {
              status: 'dispatch_unknown',
              errorLog: 'dispatch_lease_expired_unknown',
              processedAt: new Date(),
              mailLeaseUntil: 0,
              mailLease: null,
              nextAttemptAt: new Date('9999-01-01'),
            });
            return null;
          }
          const attempts = Number.isSafeInteger(data.retryCount) ? data.retryCount : 0;
          if (attempts >= MAX_MAIL_ATTEMPTS) return null;
          tx.update(doc.ref, {
            mailLease: lease,
            mailLeaseUntil: new Date(now + MAIL_LEASE_MS),
            status: 'processing',
          });
          return data;
        });
        if (!claimed) continue;

        const job = claimed;
        let dispatchStarted = false;
        try {
          const markedDispatching = await db.runTransaction(async tx => {
            const current = await tx.get(doc.ref);
            if (current.data()?.mailLease !== lease || current.data()?.status !== 'processing') return false;
            tx.update(doc.ref, { status: 'dispatching', dispatchStartedAt: new Date() });
            return true;
          });
          if (!markedDispatching) continue;
          // PII-Auflösung in-memory
          const userRecord = await getAuth().getUser(job.uid);
          const targetEmail = userRecord.email;
          if (!targetEmail) throw new Error('E-Mail nicht gefunden');

          let msgHtml = '';
          let msgSubject = '';
          const templateType = job.template || job.type;

          if (templateType === 'kuendigung_bestaetigung' || templateType === 'widerruf_bestaetigung') {
            const statutoryJob: StatutoryMailJob = {
              id: doc.id, uid: job.uid, template: templateType, status: 'pending',
              createdAt: job.at ? (job.at.toDate ? job.at.toDate() : job.at) : new Date(),
              payload: job.payload || { paidUntil: job.paidUntil, plan: job.plan, refundStatus: job.grund === 'widerruf' ? 'offen' : undefined },
            };
            const rendered = renderStatutoryConfirmation(statutoryJob);
            msgSubject = rendered.subject; msgHtml = rendered.html;
          } else if (job.type === 'password_reset') {
            const callbackUrl = job.payload?.callbackUrl;
            if (typeof callbackUrl !== 'string') throw new Error('password_reset_callback_missing');
            const callback = new URL(callbackUrl);
            if (callback.protocol !== 'https:' || callback.username || callback.password || callback.pathname !== '/' || callback.search || callback.hash) throw new Error('password_reset_callback_invalid');
            const resetLink = await getAuth().generatePasswordResetLink(targetEmail, { url: callback.origin, handleCodeInApp: true });
            msgSubject = 'Passwort für Klar zurücksetzen';
            msgHtml = `<div style="font-family: sans-serif; color: #161815;"><h2 style="color: #000;">Passwort zurücksetzen</h2><p>Du hast das Zurücksetzen deines Klar-Passworts angefordert.</p><p style="margin: 30px 0;"><a href="${resetLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Passwort zurücksetzen</a></p><p style="font-size: 12px; color: #666;">Wenn du diese Anfrage nicht gestellt hast, kannst du diese Nachricht ignorieren.</p></div>`;
          } else if (job.type === 'verification') {
            // Generate the short-lived Firebase OOB credential only in-memory immediately
            // before dispatch. The durable queue stores only uid + template metadata.
            const link = await getAuth().generateEmailVerificationLink(targetEmail);
            msgSubject = 'Bitte bestätige deine E-Mail-Adresse für Klar';
            msgHtml = `<div style="font-family: sans-serif; color: #161815;"><h2 style="color: #000;">Willkommen bei Klar!</h2><p>Wir freuen uns, dass du dabei bist. Um dein Konto zu aktivieren, klicke bitte auf den folgenden Button:</p><p style="margin: 30px 0;"><a href="${link}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">E-Mail bestätigen</a></p><p style="font-size: 12px; color: #666;">Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>${link}</p></div>`;
          } else if (job.type === 'report_confirmation' || templateType === 'report_confirmation') {
            msgSubject = `Eingangsbestätigung: Meldung ${job.aktenzeichen || doc.id}`;
            msgHtml = `<div style="font-family: sans-serif; color: #161815;"><h2 style="color: #000;">Eingangsbestätigung</h2><p>Hallo,</p><p>Ihre Meldung mit dem Aktenzeichen <strong>${job.aktenzeichen || doc.id}</strong> ist bei uns eingegangen.</p><p>Wir prüfen den Vorfall nach unseren Richtlinien und melden uns in Kürze mit einer begründeten Entscheidung.</p><br><p>Ihr Trust & Safety Team von Klar</p></div>`;
          } else {
            throw new Error(`Unbekannter Job-Typ: ${job.type || job.template}`);
          }

          const dispatchDigest = generateDispatchDigest(doc.id, job.uid, templateType, now);
          if (!apiKey) throw new Error('email_provider_unavailable');
          dispatchStarted = true;
          await sgMail.send({
            to: targetEmail, from: fromEmail, subject: msgSubject, html: msgHtml,
            customArgs: { klar_mail_job_id: doc.id, klar_dispatch_digest: dispatchDigest },
          });

          await db.runTransaction(async tx => {
            const current = await tx.get(doc.ref);
            if (current.data()?.mailLease !== lease) return;
            tx.update(doc.ref, { status: 'success', processedAt: new Date(), dispatchDigest, mailLeaseUntil: 0, mailLease: null, nextAttemptAt: new Date('9999-01-01') });
          });
        } catch (jobErr: unknown) {
          const errorMessage = jobErr instanceof Error ? jobErr.message : String(jobErr);
          const attempts = (Number.isSafeInteger(job.retryCount) ? job.retryCount : 0) + 1;

          if (dispatchStarted) {
            // SendGrid has no end-to-end idempotency key for this operation.
            // After the request started, the provider may have accepted the mail
            // even when the client received an error or the Firestore commit failed.
            // Never automatically resend an ambiguous dispatch.
            await db.runTransaction(async tx => {
              const current = await tx.get(doc.ref);
              if (current.data()?.mailLease !== lease) return;
              tx.update(doc.ref, {
                status: 'dispatch_unknown',
                errorLog: errorMessage.slice(0, 500),
                retryCount: attempts,
                processedAt: new Date(),
                mailLeaseUntil: 0,
                mailLease: null,
                nextAttemptAt: new Date('9999-01-01'),
              });
            });
            continue;
          }

          const status = Number((jobErr as { response?: { statusCode?: number } })?.response?.statusCode);
          const retryable = !Number.isFinite(status) || RETRYABLE_HTTP_STATUSES.has(status) || status >= 500;
          const terminal = attempts >= MAX_MAIL_ATTEMPTS || !retryable;
          const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(attempts - 1, 6));
          await db.runTransaction(async tx => {
            const current = await tx.get(doc.ref);
            if (current.data()?.mailLease !== lease) return;
            tx.update(doc.ref, {
              status: terminal ? 'error' : 'pending',
              errorLog: errorMessage.slice(0, 500),
              retryCount: attempts,
              processedAt: new Date(),
              mailLeaseUntil: 0,
              mailLease: null,
              nextAttemptAt: new Date(Date.now() + (terminal ? 365 * 86400_000 : delay)),
            });
          });
        }
      }
    } catch (err: unknown) {
      consecutiveErrors++;
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('insufficient permissions')) {
        console.warn('Mail Worker: Server-Firestore Berechtigung fehlt (PERMISSION_DENIED). Worker pausiert.');
        clearInterval(interval);
        return;
      }
      if (consecutiveErrors >= 3) {
        console.warn('Mail Worker: Mehrere aufeinanderfolgende Fehler, Worker pausiert.', errMsg);
        clearInterval(interval);
        return;
      }
      console.error('Mail Worker Error:', err);
    }
  };
  let active: Promise<void> | undefined;
  const interval = setInterval(() => {
    if (active) return;
    active = processQueue().finally(() => { active = undefined; });
  }, 10000);
  return async () => { clearInterval(interval); await active; };
}

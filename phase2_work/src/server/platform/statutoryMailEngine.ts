import { createHash } from 'node:crypto';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * StatutoryMailEngine (AUD-09 / ADR-013)
 *
 * Gesetzliches Pflichtmodul zur Erfüllung von:
 * 1. § 312k Abs. 4 BGB: Unverzügliche Bestätigung des Inhalts, des
 *    Zugangszeitpunkts sowie des Zeitpunkts des Vertragsendes der Kündigung
 *    auf elektronischem Wege in Textform.
 * 2. § 356a BGB: Bestätigung des Widerrufs sowie Information über die
 *    Rückabwicklung binnen 14 Tagen nach § 357 Abs. 1 BGB.
 * 3. DSA Art. 16: Eingangsbestätigung von Meldungen rechtswidriger Inhalte.
 *
 * DSGVO-Mandat: PII (E-Mail-Adressen) verbleiben strikt flüchtig in-memory
 * und werden niemals in Datenbank-Logs oder Audit-Einträgen persistiert.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface StatutoryMailJob {
  id: string;
  uid: string;
  template: 'kuendigung_bestaetigung' | 'widerruf_bestaetigung' | 'report_confirmation' | string;
  status: 'offen' | 'pending' | 'erledigt' | 'success' | 'error';
  createdAt: string | number | Date;
  payload?: {
    paidUntil?: string | number | Date;
    plan?: string;
    refundStatus?: string;
    aktenzeichen?: string;
    category?: string;
    [key: string]: unknown;
  };
  retryCount?: number;
  error?: string;
  dispatchedAt?: number;
  dispatchDigest?: string;
}

export interface StatutoryMailRenderResult {
  subject: string;
  text: string;
  html: string;
}

export interface StatutoryMailProcessResult {
  jobId: string;
  success: boolean;
  dispatchDigest?: string;
  providerMessageId?: string;
  error?: string;
}

/**
 * Formatiert Zeitstempel in rechtssicheres deutsches Datums- und Uhrzeitformat.
 */
function formatGermanDateTime(input: string | number | Date | undefined): string {
  if (!input) return new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
  const date = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
  }
  return date.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }) + ' Uhr (MEZ/MESZ)';
}

/**
 * Rendert die gesetzliche Bestätigung in Text- und HTML-Form.
 */
export function renderStatutoryConfirmation(job: StatutoryMailJob): StatutoryMailRenderResult {
  const zugangFormatted = formatGermanDateTime(job.createdAt);

  if (job.template === 'kuendigung_bestaetigung') {
    const vertragsendeFormatted = formatGermanDateTime(job.payload?.paidUntil);
    const planName = job.payload?.plan === 'plus' ? 'Klar Plus' : (job.payload?.plan || 'Abonnement');

    const subject = `Kündigungsbestätigung gemäß § 312k Abs. 4 BGB für Ihr Abonnement bei Klar`;
    const text = `Guten Tag,

hiermit bestätigen wir Ihnen den Eingang Ihrer Kündigung gemäß § 312k Abs. 4 BGB.

Angaben zur Kündigung:
• Vertragsverhältnis: ${planName}
• Kontoreferenz: ${job.uid}
• Zugang der Kündigung: ${zugangFormatted}
• Vertragsende: ${vertragsendeFormatted}

Bis zum genannten Vertragsende können Sie alle vertraglichen Leistungen uneingeschränkt weiternutzen. Mit Ablauf des Vertragsendes endet Ihr kostenpflichtiger Zugang automatisch, ohne dass weitere Kosten entstehen.

Diese Bestätigung erfolgt elektronisch in Textform gemäß § 312k Abs. 4 BGB.

Mit freundlichen Grüßen
Ihr Klar Support-Team

Klar Dating Services GmbH
Impressum & AGB: https://klar-dating.de/rechtliches
Datenschutz: https://klar-dating.de/datenschutz`;

    const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1c1917; background-color: #fafaf9; margin: 0; padding: 24px;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 32px;">
    <h2 style="margin-top: 0; color: #0c0a09; font-size: 20px;">Kündigungsbestätigung (§ 312k Abs. 4 BGB)</h2>
    <p>Guten Tag,</p>
    <p>wir haben Ihre Kündigungserklärung erhalten und bestätigen hiermit die Beendigung Ihres Abonnements.</p>
    
    <div style="background: #f5f5f4; border-left: 4px solid #0c0a09; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 4px 0;"><strong>Vertragsverhältnis:</strong> ${planName}</p>
      <p style="margin: 4px 0;"><strong>Kontoreferenz:</strong> <code style="font-size: 13px;">${job.uid}</code></p>
      <p style="margin: 4px 0;"><strong>Zugang der Kündigung:</strong> ${zugangFormatted}</p>
      <p style="margin: 4px 0;"><strong>Vertragsende:</strong> ${vertragsendeFormatted}</p>
    </div>

    <p style="font-size: 14px; line-height: 1.5; color: #44403c;">
      Bis zum angegebenen Zeitpunkt steht Ihnen der gewohnte Leistungsumfang zur Verfügung. Eine automatische Verlängerung findet nicht statt.
    </p>

    <hr style="border: 0; border-top: 1px solid #e7e5e4; margin: 24px 0;">
    <p style="font-size: 12px; color: #78716c; margin-bottom: 0;">
      Diese Bestätigung erfüllt die gesetzlichen Anforderungen nach § 312k Abs. 4 BGB.<br>
      Klar Dating Services GmbH · Amtsgericht Charlottenburg
    </p>
  </div>
</body>
</html>`;

    return { subject, text, html };
  }

  if (job.template === 'widerruf_bestaetigung') {
    const subject = `Bestätigung Ihres Widerrufs gemäß § 356a BGB`;
    const text = `Guten Tag,

wir bestätigen den Eingang Ihres fristgerechten Widerrufs gemäß § 356a BGB für Ihr Abonnement.

Angaben zum Widerruf:
• Kontoreferenz: ${job.uid}
• Eingang der Widerrufserklärung: ${zugangFormatted}
• Rechtsfolge: Sofortiges Erlöschen des kostenpflichtigen Abonnements
• Erstattung: Gemäß § 357 Abs. 1 BGB werden geleistete Zahlungen unverzüglich und spätestens binnen 14 Tagen über dasselbe Zahlungsmittel erstattet.

Ihr Konto wurde auf den kostenfreien Standard-Zugang umgestellt.

Mit freundlichen Grüßen
Ihr Klar Support-Team`;

    const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1c1917; background-color: #fafaf9; margin: 0; padding: 24px;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 32px;">
    <h2 style="margin-top: 0; color: #0c0a09; font-size: 20px;">Bestätigung Ihres Widerrufs (§ 356a BGB)</h2>
    <p>Guten Tag,</p>
    <p>wir haben Ihre Widerrufserklärung fristgerecht erhalten und bestätigen den wirksamen Widerruf.</p>
    
    <div style="background: #f5f5f4; border-left: 4px solid #16a34a; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 4px 0;"><strong>Kontoreferenz:</strong> <code style="font-size: 13px;">${job.uid}</code></p>
      <p style="margin: 4px 0;"><strong>Eingang des Widerrufs:</strong> ${zugangFormatted}</p>
      <p style="margin: 4px 0;"><strong>Erstattungsfrist:</strong> Binnen 14 Tagen nach § 357 Abs. 1 BGB</p>
    </div>

    <p style="font-size: 14px; line-height: 1.5; color: #44403c;">
      Bereits geleistete Zahlungen werden Ihnen unverzüglich über das bei der Zahlung verwendete Zahlungsmittel erstattet.
    </p>

    <hr style="border: 0; border-top: 1px solid #e7e5e4; margin: 24px 0;">
    <p style="font-size: 12px; color: #78716c; margin-bottom: 0;">
      Klar Dating Services GmbH · Verbraucherservice
    </p>
  </div>
</body>
</html>`;

    return { subject, text, html };
  }

  // DSA Art. 16 Standard-Bestätigung
  const aktenzeichen = job.payload?.aktenzeichen || job.id;
  const subject = `Eingangsbestätigung: Meldung ${aktenzeichen} (DSA Art. 16)`;
  const text = `Guten Tag,

Ihre Meldung mit dem Aktenzeichen ${aktenzeichen} ist bei uns eingegangen (Eingang: ${zugangFormatted}).
Wir prüfen den Vorfall nach unseren Richtlinien und dem Digital Services Act (DSA Art. 16) und melden uns in Kürze mit einer begründeten Entscheidung.

Trust & Safety Team von Klar`;

  const html = `
<div style="font-family: sans-serif; color: #161815; padding: 24px;">
  <h2>Eingangsbestätigung (DSA Art. 16)</h2>
  <p>Ihre Meldung mit dem Aktenzeichen <strong>${aktenzeichen}</strong> ist am ${zugangFormatted} eingegangen.</p>
  <p>Wir prüfen den Vorfall unverzüglich.</p>
  <p>Ihr Trust & Safety Team von Klar</p>
</div>`;

  return { subject, text, html };
}

/**
 * Erzeugt einen kryptografischen Prüfwert (SHA-256) für die versandte Textform-Bestätigung.
 */
export function generateDispatchDigest(
  jobId: string,
  uid: string,
  template: string,
  dispatchedAt: number
): string {
  return createHash('sha256')
    .update(`STATUTORY_DISPATCH:${jobId}:${uid}:${template}:${dispatchedAt}`)
    .digest('hex');
}

/**
 * Verarbeitet einen einzelnen gesetzlichen E-Mail-Auftrag aus der Warteschlange.
 */
export async function processStatutoryMailQueueItem(
  job: StatutoryMailJob,
  resolveEmailFn: (uid: string) => Promise<string | null>,
  sendEmailFn: (msg: { to: string; subject: string; text: string; html: string }) => Promise<{ messageId?: string }>,
  updateStatusFn: (
    jobId: string,
    statusData: { status: string; dispatchedAt: number; dispatchDigest: string; providerMessageId?: string; error?: string }
  ) => Promise<void>,
  now: number = Date.now()
): Promise<StatutoryMailProcessResult> {
  try {
    // 1. PII flüchtig in-memory auflösen
    const targetEmail = await resolveEmailFn(job.uid);
    if (!targetEmail) {
      const errorMsg = 'E-Mail-Adresse nicht ermittelbar für UID: ' + job.uid;
      await updateStatusFn(job.id, {
        status: 'error',
        dispatchedAt: now,
        dispatchDigest: '',
        error: errorMsg,
      });
      return { jobId: job.id, success: false, error: errorMsg };
    }

    // 2. Bestätigungstext und HTML rendern
    const rendered = renderStatutoryConfirmation(job);

    // 3. Versand ausführen
    const sendResult = await sendEmailFn({
      to: targetEmail,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    // 4. Kryptografischen Dispatch-Digest berechnen
    const dispatchDigest = generateDispatchDigest(job.id, job.uid, job.template, now);

    // 5. Warteschlange transactional aktualisieren
    await updateStatusFn(job.id, {
      status: 'erledigt',
      dispatchedAt: now,
      dispatchDigest,
      providerMessageId: sendResult.messageId,
    });

    return {
      jobId: job.id,
      success: true,
      dispatchDigest,
      providerMessageId: sendResult.messageId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await updateStatusFn(job.id, {
      status: 'error',
      dispatchedAt: now,
      dispatchDigest: '',
      error: errorMsg,
    });
    return {
      jobId: job.id,
      success: false,
      error: errorMsg,
    };
  }
}

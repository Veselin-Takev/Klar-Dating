#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Jede Firestore-Sammlung braucht eine Entscheidung zur Kontoloeschung.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// Die Auskunft nach Art. 15 (`handleExport`) gab Daten aus, die die Loeschung
// nach Art. 17 (`purgeAccountData`) nicht anfasste. Die App wusste also,
// dass diese Daten dieser Person gehoeren — und behielt sie trotzdem.
//
// Am schaerfsten bei `chats/{id}/gate_answers`: Firestore loescht mit einem
// Dokument KEINE Unterkollektionen. Der Chat verschwand, der selbst
// verfasste Freitext blieb als Waise liegen.
//
// Der Code warnt an zwei Stellen selbst davor („Eine neue Sammlung, die
// nicht in dieser Liste steht, ueberlebt die Loeschung") — und tappte
// trotzdem hinein. Ein Kommentar ist keine Pruefung. Dieses Skript ist eine.
//
// ── WAS ES PRUEFT ─────────────────────────────────────────────────────────
// 1. Jede Sammlung, die im Servercode vorkommt, steht unten in ENTSCHEIDEN.
//    Eine neue Sammlung ohne Eintrag faellt sofort auf.
// 2. Jede Sammlung mit der Entscheidung `geloescht` wird in
//    `purgeAccountData` auch tatsaechlich genannt. Eine Tabelle, die
//    etwas behauptet, was der Code nicht tut, waere schlimmer als keine.
// 3. Sammlungen mit `offen` werden gezaehlt — sie halten den Stand fest,
//    bis eine Entscheidung getroffen ist.
//
// ── WAS ES NICHT LEISTET ──────────────────────────────────────────────────
// Es kann nicht pruefen, ob die Abfrage die RICHTIGEN Feldnamen benutzt.
// Genau daran scheiterte der entfernte zweite Loeschweg: Er suchte
// `connections` ueber `senderId`/`receiverId`, waehrend die Felder
// `fromUid`/`toUid` heissen — die Abfrage traf nichts und meldete Erfolg.
// Dafuer braucht es Tests gegen den Emulator.
//
// Aufruf:  node scripts/loeschkaskade.mjs [Obergrenze]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const obergrenze = Number(process.argv[2] ?? 0);

/**
 * Die Entscheidung je Sammlung.
 *
 *   geloescht — wird bei der Kontoloeschung entfernt
 *   bleibt    — bleibt bewusst, mit Grund
 *   offen     — Entscheidung steht aus; wird gezaehlt
 */
const ENTSCHEIDEN = {
  account_deletions: { art: 'bleibt', grund: 'Durable Sperre und Job; nach Abschluss 30 Tage, TTL muss aktiviert werden. Fehlgeschlagene Jobs werden mit Backoff wiederholt und nach 50 Versuchen auf manual_review gesetzt.' },
  account_deletion_rate_limits: { art: 'geloescht', grund: 'UID-abgeleiteter Abuse-Prevention-Zustand; wird bei Kontoloeschung zusammen mit dem Konto entfernt.' },
  contract_requests: { art: 'bleibt', grund: 'Vertragserklaerungen und notwendige Zustellinformationen; fachliche Aufbewahrungsfrist ist vor Freigabe zu bestaetigen.' },
  kyc_accounts: { art: 'geloescht', grund: 'Nach Provider-Loeschung; keine Bilder oder Rohentscheidungen.' },
  kyc_sessions: { art: 'geloescht', grund: 'Provider-Sitzungen, Nutzerkennung und minimaler Status.' },
  kyc_events: { art: 'geloescht', grund: 'Ereignis-Deduplizierung; TTL 30 Tage, bei Kontoloeschung sofort.' },
  kyc_reconciliation_events: { art: 'geloescht', grund: 'Reconciliation-Audit mit uid und sessionId; wird bei Kontoloeschung sofort entfernt.' },
  archived_messages: { art: 'geloescht', grund: 'Archivierte Chatnachrichten sind Teil der Kontoloeschung.' },
  activation_events: { art: 'geloescht', grund: 'Ueber uid.' },
  app_feedback: { art: 'geloescht', grund: 'Zugeordnete Rueckmeldungen ueber uid; anonyme Texte separat pruefen.' },
  referral_events: { art: 'geloescht', grund: 'Einladende und eingeladene Person.' },
  funnel_events: { art: 'geloescht', grund: 'Ueber serverseitige userId; maximal 30 Tage.' },
  matches: { art: 'geloescht', grund: 'Beide Teilnehmerfelder.' },
  deletion_metrics: { legacy: true, art: 'bleibt', grund: 'Aggregierte Zaehler ohne Kontoidentifikator.' },
  processed_stripe_events: { art: 'bleibt', grund: 'Idempotenz fuer Zahlungsereignisse; Frist vor Produktion fachlich freigeben.' },
  dsa_decisions: { art: 'bleibt', grund: 'Beschwerdeverfahren; Frist und Zugriff vor Produktion fachlich freigeben.' },
  dsa_appeals: { art: 'bleibt', grund: 'Beschwerdeverfahren; Frist und Zugriff vor Produktion fachlich freigeben.' },

  analytics_events: { art: 'geloescht', grund: 'Wird geloescht.' },
  public_profiles: { art: 'geloescht', grund: 'Wird geloescht.' },
  system: { art: 'bleibt', grund: 'Systemweite Konfiguration ohne Personenbezug.' },
  users: { art: 'geloescht', grund: 'Das Profil selbst.' },
  chats: { art: 'geloescht', grund: 'Ein Chat gehoert beiden; ein halber Chat nuetzt niemandem.' },
  messages: { art: 'geloescht', grund: 'Unterkollektion von chats.' },
  gate_answers: { art: 'geloescht', grund: 'Unterkollektion von chats; selbst verfasster Freitext, auskunftspflichtig.' },
  connections: { art: 'geloescht', grund: 'In beide Richtungen, ueber vier Feldnamen.' },
  contacts: { art: 'geloescht', grund: 'Kontaktanfragen in beide Richtungen (fromUid/toUid).' },
  quota_ledger: { art: 'geloescht', grund: 'Unterkollektion von users.' },
  ai_budget: { art: 'geloescht', grund: 'Unterkollektion von users; nach dem Profil geloescht, damit transaktionale Reservierungen nicht nachschreiben.' },
  einwilligungen: { art: 'geloescht', grund: 'Unterkollektion von users; Zeitstempel und Zwecke.' },
  ki_zwischenspeicher: { art: 'geloescht', grund: 'Unterkollektion von users; Aussagen ueber diese Person.' },
  age_attempts: { art: 'geloescht', grund: 'Enthaelt die uid im Klartext.' },
  blocks: { art: 'geloescht', grund: 'In beide Richtungen.' },
  reports: { art: 'geloescht', grund: 'Eigene Meldungen weg; Meldungen UEBER die Person bleiben pseudonymisiert (DSA Art. 17).' },

  deletion_log: { legacy: true, art: 'bleibt', grund: 'Nachweis der Loeschung nach Art. 5 Abs. 2 DSGVO. Enthaelt nur Stueckzahlen und Zeitpunkt, keine Kontoidentifikatoren.' },

  subscriptions: { art: 'bleibt', grund: 'Abo-Stammdaten. Aufbewahrungspflicht denkbar (§ 147 AO).' },
  subscription_events: { legacy: true, art: 'bleibt', grund: 'Kuendigung und Widerruf. Nachweiswert gegen spaetere Streitigkeiten.' },
  refund_queue: { legacy: true, art: 'bleibt', grund: 'Offene Erstattungen. Aufbewahrungspflicht.' },
  mail_queue: { art: 'geloescht', grund: 'Wird geloescht.' },
  verification_requests: { art: 'geloescht', grund: 'Wird geloescht.' },
  verification_events: { art: 'geloescht', grund: 'Wird geloescht.' },
  audit_logs: { art: 'sonderfall', grund: 'Append-only, pseudonymisiert; historische Klartext-Altlasten werden ausschließlich über den separaten Art.-17-Migrationspfad behandelt.' },
  activation_events: { art: 'geloescht', grund: 'Enthält actorUid; wird bei Kontolöschung gelöscht.' },
  referral_events: { art: 'geloescht', grund: 'Enthält inviterUid und inviteeUid; wird bei Kontolöschung gelöscht.' },
  app_feedback: { art: 'geloescht', grund: 'Nutzereingaben und Feedback; wird bei Kontolöschung gelöscht.' },
  admob_rewards: { art: 'geloescht', grund: 'Werbebelohnungen des Nutzers; wird bei Kontolöschung gelöscht.' },
  consent_audit_log: { art: 'bleibt', grund: 'Unveränderlicher Consent-Nachweis; bei Kontolöschung wird die direkte userId entfernt und durch ein nicht rückführbares HMAC-Pseudonym ersetzt.' },
  notifications: { art: 'geloescht', grund: 'Benachrichtigungen des Nutzers; wird bei Kontolöschung gelöscht.' },
  age_verification_attempts: { art: 'geloescht', grund: 'Enthält die userId im Klartext; wird bei Kontolöschung gelöscht.' },
};

function ohneKommentare(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (_m, vor) => vor);
}

function dateien(pfad, aus = []) {
  if (!existsSync(pfad)) return aus;
  if (statSync(pfad).isFile()) { aus.push(pfad); return aus; }
  for (const e of readdirSync(pfad)) {
    const p = join(pfad, e);
    if (statSync(p).isDirectory()) dateien(p, aus);
    else if (/\.ts$/.test(p) && !/\.(test|spec)\.ts$/.test(p)) aus.push(p);
  }
  return aus;
}

/** Alle Sammlungsnamen aus dem Servercode, Kommentare vorher entfernt. */
const gefunden = new Map();
for (const datei of [...dateien('server.ts'), ...dateien('src/server'), ...dateien('functions/src'), ...dateien('app/routes')]) {
  const text = ohneKommentare(readFileSync(datei, 'utf8'));
  for (const m of text.matchAll(/(?:collection\(\s*['"]([a-z_]+)['"]|doc\(\s*[`'"]([a-z_]+)\/)/g)) {
    const name = m[1] || m[2];
    if (!gefunden.has(name)) gefunden.set(name, new Set());
    gefunden.get(name).add(datei);
  }
}

/** Der Rumpf von `purgeAccountData` — fuer die Gegenprobe zur Tabelle. */
function kaskadenrumpf() {
  const quelle = ohneKommentare(readFileSync('src/server/trustAndSafety.ts', 'utf8'));
  const start = quelle.indexOf('export async function purgeAccountData');
  if (start === -1) return null;
  // Bis zur naechsten Deklaration auf Spaltenebene 0, sonst bis zum Ende.
  const rest = quelle.slice(start + 1);
  const naechste = rest.search(/\n(export |function |const |class )/);
  return naechste === -1 ? rest : rest.slice(0, naechste);
}

const rumpf = kaskadenrumpf();
const fehler = [];
const offen = [];

for (const [name, orte] of [...gefunden].sort()) {
  const e = ENTSCHEIDEN[name];
  if (!e) {
    fehler.push({ name, grund: 'steht in keiner Entscheidung', orte: [...orte] });
    continue;
  }
  if (e.art === 'offen') offen.push({ name, grund: e.grund });
  if (e.art === 'geloescht' && rumpf !== null && !rumpf.includes(`'${name}'`)) {
    fehler.push({
      name,
      grund: 'als „geloescht" eingetragen, kommt aber in purgeAccountData nicht vor',
      orte: [...orte],
    });
  }
}

for (const name of Object.keys(ENTSCHEIDEN)) {
  if (!gefunden.has(name) && !ENTSCHEIDEN[name].legacy) {
    fehler.push({ name, grund: 'steht in der Tabelle, kommt im Code aber nicht mehr vor', orte: [] });
  }
}

const gezaehlt = fehler.length + offen.length;

console.log('Statischer Katalogabgleich; kein Nachweis vollstaendiger Loeschung oder rechtlicher Zulaessigkeit.');
console.log(`\nSammlungen im Servercode: ${gefunden.size}.`);
console.log(`  geloescht: ${Object.values(ENTSCHEIDEN).filter((e) => e.art === 'geloescht').length}   ` +
            `bleibt: ${Object.values(ENTSCHEIDEN).filter((e) => e.art === 'bleibt').length}   ` +
            `offen: ${offen.length}`);
console.log(`\nOffen oder unentschieden: ${gezaehlt} — erlaubt sind ${obergrenze}.\n`);

if (fehler.length > 0) {
  console.log('  ── OHNE ENTSCHEIDUNG ──');
  for (const f of fehler) {
    console.log(`  ${f.name}: ${f.grund}`);
    if (f.orte.length) console.log(`      ${f.orte.slice(0, 2).join(', ')}`);
  }
  console.log('');
}
if (offen.length > 0) {
  console.log('  ── ENTSCHEIDUNG STEHT AUS ──');
  for (const o of offen) console.log(`  ${o.name}: ${o.grund}`);
  console.log('');
}

if (gezaehlt > obergrenze) {
  console.log([
    'Eine Sammlung, die bei der Kontoloeschung liegenbleibt, ist ein Verstoss',
    'gegen Art. 17 DSGVO — es sei denn, es gibt einen Grund, und der steht',
    'aufgeschrieben. Jede Sammlung gehoert deshalb in ENTSCHEIDEN in',
    'scripts/loeschkaskade.mjs, mit "geloescht", "bleibt" oder "offen".',
    '',
  ].join('\n'));
  process.exit(1);
}
console.log('');

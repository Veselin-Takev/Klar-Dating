# P1 #237 — Profilverifizierung: Didit-Status statt stillgelegter HTTP-410-Route

**Datum:** 2026-11-01 · **Status:** Draft, exakte neue CI noch zu prüfen · **Produktion:** BLOCKED/NO-GO

## Verifizierter Quellbefund

Die aktive `src/components/BiometricsVerificationModal.tsx` rief bei „Aktualisieren“ bisher `authFetch('/api/verification/status')` auf und prüfte ein älteres `result.isVerified === true`. Der Server registriert unter `/api/verification` jedoch `verificationRouter`, der sämtliche `/status`-Aufrufe absichtlich mit **HTTP 410** abweist. Die signierte, an das Konto gebundene Didit-KYC-Pipeline stellt stattdessen `GET /api/kyc/status` über `createKycRouter` bereit. Dessen serverseitiges Ergebnis besitzt ein `status`-Feld; `approved` ist der einzig zulässige positive Zustand. Dies ist ein reproduzierbarer Quellcode-Widerspruch, **kein Sicherheits- oder tatsächlicher Produktivverifikationsnachweis**.

## Minimaler Fix

- Der aktive Profil-Dialog ruft den **bestehenden authentifizierten** `/api/kyc/status`-Endpunkt als `GET`, `cache: 'no-store'` über `authFetch` auf. Es werden **keine** neuen Verifikations-, Upload- oder Session-Entscheidungsrouten eingeführt.
- `src/lib/kycStatusRefresh.ts` klassifiziert ausschließlich den exakt serverseitig gelieferten String `approved` als erfolgreich. `pending`, `review`, `not_started` ergeben den bestehenden lokalisierten Hinweis `kyc.photoPending`; `unavailable`, unbekannte, fehlerhafte oder alte `isVerified`-Payloads führen zu `kyc.statusUnavailable`, **nicht** zur Freischaltung.
- Nicht erfolgreiche HTTP-Antworten (darunter 401, 410, 429, 503), Netzwerkfehler und JSON-Parsing-Fehler sind ausdrücklich **fail-closed**. `onSuccess` ruft weiterhin ausschließlich die schon vorhandene `refreshProfile()`-Verknüpfung auf, keine eigene Autoritätsänderung.
- Bestehende Modal-Zugänglichkeit, Fokusbehandlung und i18n-Texte bleiben unverändert.

## Verbindliche Regressionstests

- `tests/kycStatusRefresh.spec.tsx` führt echte jsdom-Komponententests mit kontrollierten `authFetch`-Antworten aus, prüft die exakte Didit-Route, den einzigen positiven Zustand `approved`, pending/review/not_started, `isVerified`-Legacy-Flags, unbekannte/leere Payloads, 401/410/429/503, Netzwerk- und JSON-Fehler sowie geschlossenes Dialogverhalten.
- `scripts/check-kyc-status-refresh.test.mjs` schützt im `check:enterprise`-Pfad gegen Regression auf die retired Route, prüft den vorhandenen Server-Mount und die explizite 410-Grenze. `check:kyc-status-refresh` ist einmal verpflichtend an `check:enterprise` angeschlossen.
- Ein **vollständiger SUCCESS** des GitHub-Actions-Laufs auf dem **exakten neuen Feature-SHA** ist erforderlich: Static/Typecheck, Functions, Test/Build/Smoke/Browser. Vor Testabschluss wird **kein PASS** behauptet.

## Nicht im Scope / Release-Grenzen

Dieser P1-Fix verändert keine Provider-Signaturprüfung, keine KYC-Accountstatus-Quelle, keine Firebase/Storage/Firestore/IAM-Regeln, keine biometrische Aufbewahrung oder GCS-Objekte. Er beseitigt keine Risiken aus P0 #202 (Decision-gebundener Foto-Purge, Legal-Holds, 404/412, >300 Work Queue) oder P0 #254 (echte Tenant-/Art.-17-/Admin-SDK-Isolation und genehmigte Medien-Sichtbarkeit). Die unabhängigen Product-/AppSec-/DPO-/Legal-/SRE-/ReleaseOwner-Signaturen fehlen weiterhin.

**Keine direkte Änderung an `main`, kein Merge, kein Deployment oder Kundendatenzugriff. `productionApproved=false`; Production BLOCKED/NO-GO.**

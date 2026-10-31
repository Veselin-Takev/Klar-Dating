# P1 #237 – Profil-Verifizierungsstatus: nur der aktive Didit-KYC-Pfad

**Stand:** 31.10.2026 · **Status:** Draft / noch kein Production GO · **Branch:** `fix/237-didit-profile-refresh-20261031` (eigenständiger Branch auf `main`)

## Quellcodebefund

`src/screens/Profile.tsx` bindet `BiometricsVerificationModal` für das manuelle Aktualisieren des Verifizierungsstatus ein. Dieser Dialog rief bisher `GET /api/verification/status` auf und erwartete ein boolesches `isVerified === true`. Der aktive `src/server/verification-routes.ts`-Router weist diesen Altendpunkt jedoch absichtlich für sämtliche Methoden mit HTTP **410** zurück. Der legitime, authentifizierte und rate-limitierte aktuelle Statusendpunkt ist `GET /api/kyc/status` in `src/server/verification/diditKyc.ts`; seine Daten kommen aus der serverseitigen `kyc_accounts/{uid}`-Statusquelle. Der alte Dialog konnte deshalb seinen gewünschten positiven Status nicht mehr auslesen. Dies ist ein **UI-/Verfügbarkeitsfehler**, kein Nachweis eines unautorisierten Identitätswechsels.

## Eng abgegrenzte Änderung

- `src/components/BiometricsVerificationModal.tsx` ruft beim manuellen Refresh `authFetch('/api/kyc/status')` auf.
- Ausschließlich der wortgetreue Provider-/Serverstatus `approved` löst `onSuccess()` aus. `pending`, `review`, `not_started` zeigen die bestehende übersetzte Wartemeldung; unbekannte Werte, `unavailable`, Null/ungültige JSON-Formate, HTTP-Fehler und Netzwerkausfall zeigen den bestehenden übersetzten Fehlerstatus.
- Ein unsigniertes/legacy `isVerified:true` im Antwortbody führt **nicht** zum erfolgreichen Abschluss.
- Bestehendes Accessible-Modal-Verhalten, Links und I18n-Keys bleiben erhalten. Die alte Route wird **nicht** wieder aktiviert.

## Regression und Freigabe-Nachweise

- `tests/biometricsVerificationModal.spec.tsx`: genehmigter Zustand, alle zulässigen Zwischenzustände, `isVerified`-Impersonation, unbekannter/fehlender/unverfügbarer Providerstatus, HTTP 401/410/503 und Netzwerkausfall. Der Pfad `/api/kyc/status` wird explizit geprüft.
- `scripts/check-kyc-profile-refresh-boundary.mjs`: fail-closed Source-Gate gegen Rückkehr zur `/api/verification/status`-Route und gegen `isVerified`-Boolean als vermeintliche Autorität. Die neue Source-Grenze ist an das bestehende Enterprise-Pflichtskript `check:kyc-reconciliation` angebunden.
- Die Prüfung ist **nur** eine lokale Quell-/UI-Grenze. Live-Didit-Konfiguration, tatsächliche KYC-Konten und deployed Provider-Webhooks wurden nicht eingesehen, geschweige denn verändert. Vor technisch bestätigtem PASS müssen Typecheck, Vitest/CI, Build und Browser-Acceptance auf dem **exakten neuen Commit** erfolgreich sein.

## Grenzen / unabhängige Freigabe

Diese P1-UI-Korrektur sagt nichts über die P0-Verifikationsfoto-Löschfrist, ursprüngliche GCS-Objektgenerationen, Firestore/GCS-All-Writer-Fencing, Admin-SDK-IAM oder Art.-17-Reconciliation aus. Diese Punkte bleiben in den separaten Retention-Draft-PRs #233 bis #236 **BLOCKED / NO-GO**. Keine direkte `main`-Änderung, kein Merge/Deployment ohne Review, keine produktiven Datenabfragen und **keine formale Produktionsfreigabe**.

# P0 #70 — Retention-Matrix-Drift verhindern (2026-10-18)

**Draft / NO-GO.** Gestapelt auf PR #78 (staging-only TTL Provisionierung).

## Verifizierter Befund
`docs/DATA_RETENTION.md` dokumentiert 13 Firestore-TTL-Collection-Groups mit `expiresAt`, während das alte `main`-Provisionierungsskript nur vier Gruppen aktiviert. PR #75/#78 führen einen Dry-Run-first-Gate mit 13 Gruppen, unabhängiger GCP-Staging-Labelprüfung, Legal-/Inventory-Gates und expliziter Projekt-/Datenbankbindung ein. Das beweist **keine** Aktivierung von Policies in der Cloud.

## Neue Korrektur
`node scripts/check-retention-matrix.mjs` prüft deterministisch die 13 genehmigungsbedürftigen Gruppen in Reihenfolge, die dazugehörigen Einträge in `docs/DATA_RETENTION.md` sowie vorhandene Fail-Closed-Vorabbedingungen (Dry Run, Staging-Identität, GCP-Projekt, Firestore-Datenbank, ausdrückliche rechtliche und Inventar-Freigabe). Eine ausgelassene oder hinzugefügte Gruppe beziehungsweise wegfallende Absicherung erzeugt einen Fehler und verhindert, dass ein lokaler Matrix-Drift übersehen wird.

## Akzeptanz und Grenzen
Diese statische Prüfung muss zusammen mit `scripts/test-retention-gate.sh` und `scripts/test-retention-project-identity.sh` bei jeder Änderung an Retention-Skript oder Datenklassifizierung durchgeführt werden. Nicht bestätigt sind tatsächliche Firestore-TTL-Status (ACTIVE), Feldtyp `expiresAt` für jede Collection, Legal Holds, reale Staging-Provisionierung und verifizierte DSGVO-Art.-17-Ende-zu-Ende-Löschung. Vor echter Staging-Aktivierung dokumentierte Policy-Freigabe und Bestands-/Expiry-Inventar vorlegen; niemals Produktionsprojekt überschreiben. Das unabhängige Reviewer-Gate bleibt offen.

Referenzen: https://firebase.google.com/docs/firestore/ttl und https://firebase.google.com/docs/firestore/security/test-rules-emulator . Kein produktiver Deploy, Merge oder zusätzlicher GitHub-Actions-Lauf. **NO-GO.**


### Fortschreibung 2026-10-19 (gesondert vom historischen 13er-Befund)

Eine erneute Schreibpfadprüfung ergab sieben weitere `expiresAt`-Collection-Groups. Der Staging-Plan enthält nun **20** Gruppen und benötigt ein neues, gesondertes 20er-Genehmigungsticket (`KLAR_RETENTION_MATRIX_REVISION_APPROVED=expiresAt-20-2026-10-19`), zusätzlich zu allen bestehenden Legal-/Inventory-/Projekt-Gates. Historische 13er-Testresultate beziehen sich ausschließlich auf die damalige Matrix. Keine Policy-Aktivierung erfolgt. **NO-GO**.

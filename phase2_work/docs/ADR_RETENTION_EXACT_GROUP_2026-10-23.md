# ADR: Exakte Collection-Group-Bezeichner im Retention-Matrix-Gate
Datum: 2026-10-23
Status: lokal gezielt getestet; Production Readiness **NO-GO**
Bezug: Issue #70

## Ausgangssituation
Das Skript `scripts/check-retention-matrix.mjs` prüfte die dokumentierten Collection Groups durch `docs.includes('--collection-group=' + group)`. Damit konnte `--collection-group=messages_fake` irrtümlich `messages` bestätigen.

## Entscheidung
Für jeden genehmigten Gruppennamen wird das Vorhandensein der vollständigen Bezeichnung geprüft: der Name darf nicht mit weiteren alphanumerischen Zeichen, Unterstrichen oder Bindestrichen fortgesetzt werden. Die bestehende Matrix, alle Genehmigungssperren und das Dry-Run-Verhalten bleiben erhalten. Diese Kontrolle ist ausschließlich ein statischer Dokumentations- und Source-Gate-Test; sie beweist **keine aktive TTL-Policy**.

## Tests und Einschränkungen
Auf einer isolierten lokalen Quellkopie unter Node.js **22.16.0** (nicht der verlangten 22.23.3) wurden die vier fehlerhaften Suffix-Varianten `_fake`, `_old`, `2`, `-backup` gegen die Originalprüfung reproduziert (Regression erwartet Ablehnung, Original akzeptiert); mit dem Fix: 5/5 PASS einschließlich unveränderter Dokumentation. Der normale Matrix-Check und sechs statische Security-/Compliance-Prüfungen liefen mit Exit 0. Keine vollständigen Emulator-, Build-, SAST-/SCA-, E2E- oder Production-Gates und keine unabhängigen Freigaben.

## Sicherheitsgrenze
Fehlende reale Staging-`ACTIVE`-Nachweise für alle 20 Collection Groups, Rechtsfreigaben und weitere offene P0/P1-Issues verhindern GO. Kein automatisches Closing von Issue #70 und keine Änderung produktiver Firestore-TTL-Policies.

## Rollback
Das isolierte Skript-Change kann revertiert werden; der Regressionstest und diese ADR können mit revertiert werden. Keine Datenbank-, API-, Index- oder Schema-Migration. Der produktive N-1-Rollback des Gesamtsystems ist weiterhin nicht verifiziert.

## Freigabeanforderung
Erst nach identischer Release-SHA, gepinnter Node/Bun-Toolchain, allen Mandatory Gates PASS, aktiven TTL-Nachweisen und unabhängiger Security-/Legal-/Operations-Abnahme freigeben.

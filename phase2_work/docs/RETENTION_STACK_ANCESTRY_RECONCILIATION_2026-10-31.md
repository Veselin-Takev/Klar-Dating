# P0 #202 – GitHub-Commit-Historien und quellenidentische Integrationskandidaten

**Auditdatum:** 31.10.2026 · **Quelle:** Live-GitHub-PR-Metadaten, SHA-basierte `compare`-Anfragen und Blob-Fetches. Keine unbestätigte Merge-/Staging-/Produktionsfreigabe.

## Vergleich gegen den erfolgreichen PR-#250-Head

Ziel-Head: [PR #250](https://github.com/Veselin-Takev/Klar-Dating/pull/250) `6656e71f36e17457c98f4d5fdb0c4b6595bba3e5`, [vollständige CI #41206961176](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41206961176) PASS. Folgende GitHub-`compare/<PR-HEAD>...<ZIEL-HEAD>`-Ancestry-Relationen wurden abgefragt:

| PR | Vergleich zu #250 | Technische Konsequenz |
|---|---|---|
| #229 | ahead, 0 behind | Commit bereits Vorfahr des Ziel-Heads |
| #231 | diverged, 25 behind | Nicht als Vorfahr integriert; getrennte Legacy-Retention-Schutzänderungen auf Inhaltsgleichheit prüfen |
| #233 | diverged, 2 behind | Nicht als Vorfahr integriert; Generation-Provenienz-Teiländerung diffen, bevor Vollständigkeit behauptet wird |
| #234 | ahead, 0 behind | Commit bereits Vorfahr des Ziel-Heads |
| #235 | diverged, 8 behind | Eigener Legacy-Writer-/Client-Schutz-Teststrang, nicht automatisch mitübernommen |
| #236 | diverged, 19 behind | Direkte alte KYC-Handler-Stilllegung war in #250 nachweislich **nicht** enthalten |
| #239 | ahead, 0 behind | Commit bereits Vorfahr |
| #240 | ahead, 0 behind | Commit bereits Vorfahr |

Die Branch-PR-Metadaten zeigen außerdem die exakten Eltern-Referenzen #239 → #240 → #241 → #242 → #243 → #250 (jeder auf seinem Vorgänger-Head); #246 → #247 ebenfalls. Ein **grüner Branch-CI-Lauf beweist keine inhaltliche Vollständigkeit paralleler Sicherheitsänderungen**. Der GitHub-Compare-Status `diverged` beweist umgekehrt *nicht* automatisch, dass ein Patch fehlt; Cherry-Pick/Äquivalenz benötigt separate Inhaltsprüfung.

## Konkreter ausstehender Legacy-Handler-Fix und Integrationsprüfung

Der tatsächlich gelesene `phase2_work/src/server/klarCore.ts`-Blob auf #250 (`6b7a80f4ea30cae855684e812d8042b8e6e396d4`) ist identisch mit `main` und enthielt noch die alten manuellen `handleVerificationChallenge`, `handleVerificationSubmit` (einschließlich Bild-Upload) und `handleVerificationDecide`-Implementierungen. Die aktuelle Router-Kette liefert zwar bereits HTTP 410 und die Storage-Client-Regeln verweigern Legacy-Biometrie-Uploads; die direkt exportierten Funktionen waren aber nicht stillgelegt.

[Draft PR #252](https://github.com/Veselin-Takev/Klar-Dating/pull/252), Commit `30043904a9d7b1039f63007baebb34a60f90bdb2`, basiert exakt auf #250. Seine `klarCore.ts` hat **denselben unveränderten Blob SHA** `60d1bdfba05ba791008e8c7d3ebb8b047a5b66d2` wie die bereits erstellte Korrektur in #236. Hinzu kommen Quelle-/Mutation-/Direkthandler-/Express-HTTP-Tests aus #235/#236 sowie die verbindliche Ausführung als Teil des Compliance-Gates. Das ist eine verifizierte **Datei-Äquivalenz**, kein Nachweis für die Übernahme aller anderen Änderungen aus den auseinanderlaufenden PRs. Die neue [CI #41210125788](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41210125788) wurde gestartet; **Resultat war bei Dokumentation noch offen**.

## Verbindliche Integrationsreihenfolge

1. `#250 → #252` nur als gestapelten, isolierten Kandidaten betrachten; vor Merge auf aktuellen `main` neu abgleichen, vor allem #231/#233 und mögliche neue P0-Writers. #235/#236 unverändert lassen, bis unabhängige Prüfer deren komplette Diffs gegen #252 inhaltlich abgeglichen haben.
2. Nach SHA-gültiger vollständiger CI, Sicherheits-/Datenschutz-/SRE-Review: geordnete parent-first Integration; nach jedem Merge Basis und CI des Nachfolgers neu ermitteln. Nie den erfolgreichen Parent-Run als Nachweis des nächsten Head verwenden.
3. GitHub-Ruleset #25756841 erzwingt weiterhin keine unabhängigen Reviews; [#73](https://github.com/Veselin-Takev/Klar-Dating/issues/73)/[Draft #251](https://github.com/Veselin-Takev/Klar-Dating/pull/251) und [Bypass-Token-Audit](GITHUB_RULESET_BYPASS_VISIBILITY_2026-10-31.md) bleiben zwingend.
4. Zusätzlich bleiben verifizierte live Cloud-Functions-/Scheduler-/GCS-IAM-/Firestore-Writer-Inventur, Original-Uploadgeneration, Hold-/Race-/404-/412-E2E, historische DSGVO-Altbestandsreconciliation und unabhängige Fachsignaturen offen.

**Status: BLOCKED / NO-GO.** Keine Produktionsfreigabe, kein direktes `main`-Commit, kein Merge, kein Deployment und keine produktive Löschung.

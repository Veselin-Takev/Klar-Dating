# Security-Auditstatus – 26.10.2026

**Produktionsentscheidung: NO-GO. Keine offizielle Security-/Produktionsfreigabe.**

## Aktueller technischer Stand nach PR #136

Die nachstehenden alten Audit-/lokalen Checkpoints sind historische Snapshots.
Maßgeblich für den aktuellen technischen Nachweis sind die folgenden ausgeführten
CI-Läufe; eine unabhängige Befundabnahme oder Produktionsfreigabe ersetzen sie nicht.

| Änderung | Erfolgreiche vollständige CI | Getesteter Head | Main-Merge |
| --- | --- | --- | --- |
| [#131 Request-/Reset-Grenzen](https://github.com/Veselin-Takev/Klar-Dating/pull/131) | [40346165390](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40346165390) | `822ea20d6994796b620a5fb7dcaef3eb74c8a817` | `fc92b41fcebc1bfefb29a5261eeace74468dc6d1` |
| [#132 Trace-Minimierung](https://github.com/Veselin-Takev/Klar-Dating/pull/132) | [40351278302](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40351278302) | `fb9810b7156f2838841cfa6cabf91345d47492cd` | `272fb7b6c1830949054ff048447c3e069c8d4688` |
| [#133 Stream-Limits](https://github.com/Veselin-Takev/Klar-Dating/pull/133) | [40354560343](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40354560343) | `5df84128aa46ffca842bb7e6126706664d94b377` | `91b66c9985a358ec4d64ce59f8bf3f73490ce355` |
| [#134 Docker-Pins](https://github.com/Veselin-Takev/Klar-Dating/pull/134) | [40379168480](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40379168480) | `cfd9ed4920a64cc37069e2a6c3208373e90da101` | `ba9adcb4c76014f0eb207828fa33d495f5f2491c` |
| [#135 Prompt-Testaufruf](https://github.com/Veselin-Takev/Klar-Dating/pull/135) | [40383735092](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40383735092) | `8f8c299b52324ab32c920ccdf29622267c28e68b` | `cb135c886bd21619c0a55107ba7a1e9fcb4fadcf` |
| [#136 HTTP-Eigentümerzugriff](https://github.com/Veselin-Takev/Klar-Dating/pull/136) | [40387030005](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40387030005) | `dd59e548e0dbf037279b716d9c2eec0b3044700a` | `95e62dd5f8627391b35e65fbd917c01a32846848` |

Der CI-Job von #136 bestätigt ausdrücklich `tests/chatHttpOwnership.spec.ts (8 tests)`;
die Standardsuite meldet **189 Dateien / 1.333 Tests bestanden**. Die acht neuen Fälle
wurden ausgeführt, nicht übersprungen. Die elf Prompt-Fälle laufen separat im statischen
Enterprise-Gate. Die Main-Trees wurden nach jedem Merge gegen den geprüften Stand verglichen.

Erneute versionsgenaue OSV-Abfrage am 26.10.2026, 19:38 UTC: **1.438 eindeutige Versionen,
21 betroffene Versionen, 39 eindeutige Advisories** aus Root-/App-/Functions-Lockfiles.
Keine Lockfiles wurden dabei neu aufgelöst. Dies umfasst Entwicklungs-/optionale
Abhängigkeiten und ist weder eine Ausnutzbarkeitsanalyse noch eine vollständige
Container-/OS-SCA. Detaillierte Abfrageergebnisse bleiben im lokalen Evidenzpaket.

| Befund | Technischer Stand | Noch offene Nachweisgrenze |
| --- | --- | --- |
| SEC-01 | Offen; benannte Datenbank verhindert direkte Storage-cross-service Lösung | Medienauslieferung, Token/Widerruf, reale Regeln und Betriebsvalidierung |
| SEC-02 | Teilweise korrigiert/minimiert; SCA weiterhin auffällig | Restliche Dependency-Triage, Updates und Laufzeit-/Build-Abgrenzung |
| SEC-03 | Initialisierung/Quota-Persistenz technisch korrigiert, CI-validiert | Unabhängige Security-Abnahme und tatsächliche Umgebung |
| SEC-04 | Zwei Trace-Grenzen minimiert, reale SDK-Exporttests bestanden | Andere Logpfade, tatsächliche Senken, Zugriffe und Retention |
| SEC-05 | Vier aktive Verbraucher mit Stream-Limits korrigiert, CI-validiert | Tatsächliche Betriebs-/Last- und externe Integrationsnachweise |
| SEC-06 | Prompt-Suite explizit aktiv; echte HTTP-Chatfälle ausgeführt | Weitere Routen-/Regelmatrix und historische Scanner-Lücken |
| SEC-07 | Beide Docker-Pins konsistent, Policy-/Regressionstests in CI | Tatsächlicher Container-Build, Image-/OS-Scan und Laufzeitnachweis |

Keine Zeile bedeutet eine unabhängige Abnahme des gesamten Befunds. Ein separates
Staging-Projekt, reale Live-Staging-/Rollback-Nachweise und Fachfreigaben fehlen weiter.
**Produktion bleibt NO-GO.**

## Ursprünglicher Auditstand vor den Korrekturen

Repository-Basis: f8654ee21d866191aff23b67f155971c6fac693b.
Der zugehörige [main-CI-Lauf 40300630969](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40300630969) ist erfolgreich.
Das technische Audit umfasst manuelle Architektur-/Codeprüfung, aktuelle Lockfile-SCA,
Secret-Pattern-Scan, gezielte lokale Tests und synthetische Reproduktionen.
Es ist keine unabhängige Drittprüfung und keine vollständige ASVS-Zertifizierung.

Der Eigentümer hat bestätigt: **Noch kein separates Staging-Projekt.**
Priorität ist zuerst das Security-Audit und sein Bericht; die Staging-/Hosting-Arbeit folgt anschließend.

## Ergebnisse und Grenzen dieses ursprünglichen Snapshots

- Sieben offene priorisierte Befunde: zwei hoch, vier mittel, einer niedrig.
  Diese Befunde sind noch nicht als behoben abgenommen.
- Aktuelle OSV-Abfrage: 1.436 eindeutige npm-Paketversionen aus Root-/App-/Functions-Lockfiles,
  22 betroffene Versionen und 39 eindeutige Advisories.
  Datenbank-Severities: 2 CRITICAL, 13 HIGH, 16 MODERATE, 8 LOW.
  Meldungen enthalten Entwicklungs-/optionale Pakete und sind keine nachgewiesenen App-Exploits.
- Secret-Pattern-Scan: 1.271 getrackte Textdateien, keine Treffer; sechs Binärdateien übersprungen.
  Git-Historie und externe Secret-Stores sind damit nicht vollständig geprüft.
- Gezielter lokaler Testlauf: 149 Tests, 148 bestanden, einer fehlgeschlagen.
  Der zusätzliche Testumfang ist vom bestehenden CI-Umfang zu unterscheiden.
- Lokale Enterprise-Prüfgruppen: 51 PASS, acht FAIL, eine INCOMPLETE.
  Windows-/Werkzeug-/Eingabebedingungen sind im detaillierten Bericht einzeln eingeordnet;
  diese Zahlen sind kein Nachweis von acht neuen Anwendungsschwachstellen.
- Live-DAST, tatsächlich ausgerollte Cloud-Regeln, IAM/Netzgrenzen, Container-/OS-SCA,
  Alarmzustellung, Restore und Live-Rollback bleiben ungeprüft.

Der vollständige Bericht mit Befunddetails, Reproduktionen und Evidenzanlagen wurde dem Eigentümer
als lokales Auditpaket bereitgestellt. Dieser öffentliche Status enthält die Freigabeentscheidung
und den Prüfungsumfang; die noch offenen detaillierten Sicherheitsbefunde werden kontrolliert behandelt.

## Nächste Schritte

1. Hohe Risiken zuerst triagieren und über überprüfbare Fix-PRs bearbeiten.
2. Jeden Befund mit verantwortlicher Person, Commit, positiven/negativen Tests,
   Ergebnis und tatsächlichem Reviewer schließen; verbleibende Risiken ausdrücklich entscheiden.
3. SCA und relevante Tests am exakten korrigierten Commit erneut ausführen.
4. Anschließend ein isoliertes EU-Staging mit synthetischen Daten und getrennten Firebase-Ressourcen
   festlegen und dort die fehlenden Betriebs-/Integrations-/Migrationsnachweise erbringen.
5. Offizielle Produktion erst nach dem separaten geschützten Releaseprozess und tatsächlichen
   erforderlichen Fachfreigaben. Technischer Owner bleibt @Veselin-Takev;
   unabhängige Fachprüfer sind noch zu benennen.

Bestehende Branch-/Freigabeschutzregeln wurden durch dieses Audit nicht verändert.
Grüne CI allein erteilt keine Produktionsfreigabe. Historische Auditberichte beschreiben ihren jeweiligen
damaligen Umfang und dürfen diesen aktuellen Nachweisstand nicht ersetzen.

## Prüfrahmen

[OWASP ASVS 5.0.0](https://asvs.owasp.org/),
[OWASP API Security Top 10 2023](https://owasp.github.io/blog/2023/07/03/owasp-api-top10-2023),
[NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final),
[OSV API](https://google.github.io/osv.dev/post-v1-querybatch/).

## Technischer Folgestand

Eine nachfolgende Teilkorrektur für Anfrageparser, Paketstände und Kontowiederherstellung ist in [Security-Folgestand](SECURITY_REQUEST_RECOVERY_REMEDIATION_2026-10-26.md) dokumentiert. Der obige Auditstand ist ein datierter Snapshot. Teilfixes oder technische CI-Nachweise ersetzen keine unabhängige Security-/Produktionsfreigabe; verbleibende Befunde bleiben ausdrücklich offen.

## 2026-10-26: Trace exception minimization

The Firestore/Gemini tracing wrappers now export fixed exception categories instead
of arbitrary thrown values. Thirteen real-SDK/batched-export boundary tests pass locally;
full exact-head CI is pending. SEC-04 remains partially open for other logging paths
and real sink controls. See [trace checkpoint](SECURITY_TRACE_MINIMIZATION_2026-10-26.md).
Production remains **NO-GO**; PR #131 passed full CI before integration, independently
of the remaining production acceptance evidence.

## 2026-10-26: Bounded upstream response streams

SEC-05 technical remediation now caps decoded stream bytes before buffering/parsing
in translation, image and both Didit consumers. Twenty-one local regression tests
pass, including actual gzip fetch decoding and early stream cancellation. Full
exact-head CI is pending. See [stream checkpoint](SECURITY_BOUNDED_RESPONSES_2026-10-26.md).
PR #132 is integrated after full CI40351278302 success; remaining audit and independent
release evidence stay open. Production remains **NO-GO**.

## 2026-10-26: Docker toolchain consistency and Storage compatibility review

SEC-07 pin drift is corrected: active and root Docker build stages now use the
approved Bun 1.4.2 image/digest. Both Dockerfiles are checked by the enterprise
policy gate; 12 local regression tests pass. Full exact-head CI is pending; actual
container build/scan evidence remains separate. See [checkpoint](SECURITY_DOCKER_TOOLCHAIN_2026-10-26.md).
SEC-01 remains open: direct cross-service Storage checks cannot read the configured
named Firestore database. An incompatible prototype was withheld; live rules/IAM
were not changed. PR #133 passed full CI and is integrated. Production remains **NO-GO**.

## 2026-10-26: Deterministic prompt evidence

The previously excluded prompt suite now has an explicit deterministic CI invocation
and corrected redaction/escaping expectations: 11 local tests pass. Runtime protection
is unchanged. The invalid-token API test is honestly labeled and requires 401;
it does not establish authenticated A/B IDOR protection. Full exact-head CI is pending.
See [evidence checkpoint](SECURITY_PROMPT_EVIDENCE_2026-10-26.md). SEC-06 remains
partially open. PR #134 passed full CI and is integrated. Production remains **NO-GO**.

## 2026-10-26: Real-token HTTP chat ownership evidence

Eight emulator integration cases now target the actual chat read/read-receipt HTTP
mounts using registered accounts and verified real emulator tokens. They cover
participant positives, an adult outsider, blocks in both directions, deletion/age
boundaries and rejected writes without mutation. Execution is pending full exact-head
CI; no local emulator success is claimed. See [checkpoint](SECURITY_CHAT_HTTP_OWNERSHIP_2026-10-26.md).
PR #135 passed full CI and is integrated. SEC-06 remains partial for other routes/rules.
Production remains **NO-GO**.

## Fehlerlog-Minimierung – 26.10.2026

Zehn Fehlerpfade auf feste Ereigniscodes umgestellt. Lokal 35 Tests bestanden; vollständige CI dieses Stands ausstehend. SEC-04 und Produktions-NO-GO bleiben offen. Details: [Checkpoint](SECURITY_ERROR_LOG_MINIMIZATION_2026-10-26.md).

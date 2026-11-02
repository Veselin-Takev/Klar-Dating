# P0 #202 — Autoritative Hold-Feldtypen am GCS-Löschübergang fail-closed

**Datum:** 2026-11-02 · **Status:** isolierter Draft/keine Produktivfreigabe · **Ausgangsbasis:** [PR #304](https://github.com/Veselin-Takev/Klar-Dating/pull/304), SHA `cb32f49d9c4ffb66af7559ac7b78cfc2b70524cf`.  
**Release:** `productionApproved=false`; BLOCKED / NO-GO.

## Verifizierter Quellbefund

Der bisherige [read-only Inventur-Draft #304](https://github.com/Veselin-Takev/Klar-Dating/pull/304) ergänzt einen separaten Zähler für vorhandene, aber nicht boolesche Legal-Hold-Felder. Die tatsächlich aufgerufene autoritative Löschvorprüfung `src/server/platform/verificationPurgeBoundary.ts`, die sowohl beim anfänglichen Batch-Preflight als auch **direkt vor dem GCS-Delete** und beim späteren Audit-Update verwendet wird, erkannte dagegen bis jetzt Holds nur mittels `legalHold === true || retentionHold === true || hold === true`. Ein ausdrücklich vorhandenes `legalHold: "true"`, `hold: null`, `retentionHold: 0` oder ein Objekt wurde nicht als *unzuverlässige Hold-Information* abgewiesen. Die fehlende strikte Typprüfung ist ein **Quellcode-Befund**, kein Nachweis einer tatsächlich erfolgten GCS-Löschung oder falschen produktiven Hold-Entscheidung.

## Abgegrenzter Sicherheitsfix

- `hasUnambiguousVerificationHoldFlags(record)` verlangt, dass jedes **vorhandene** Feld `legalHold`, `retentionHold` oder `hold` strikt boolesch ist. Strings wie `"false"`, Zahl/NULL/Array/Map werden **vor jedem destruktiven Vorgang** mit `verification_purge_candidate_unavailable` fail-closed abgewiesen.
- Das bestehende Deny-Verhalten für explizit gesetzte `true`-Holds, widersprüchliche Entscheidungen, fehlende Moderation, Fremdeigentümer, ungültige Fristen und bereits gelöschte Fotos bleibt bestehen.
- Die bestehende, mehrfach genutzte `assertCurrentVerificationPurgeCandidate`-Vorprüfung ruft den neuen Validator am Anfang auf; somit ist kein zusätzlicher Löschpfad eröffnet, keine neue GCS-Berechtigung erteilt und keine alternde Foto-Löschung aktiviert.
- Reine negative Vitest-Fälle prüfen alle drei Felder, die Datentypen `string`, `null`, `number`, `object`, `array` und gemischte Flags. Positive Fälle bestätigen, dass ausdrücklich `false` weiterhin akzeptiert und ein echtes `true` weiterhin gesperrt wird.
- Der verpflichtende `check:compliance-storage-purge`-Quell-Guard verlangt jetzt den Aufruf der strengen Hold-Validierung in der autoritativen Löschgrenze. Keine Tests, Gate-Checks oder bestehende Freigabesperren wurden deaktiviert.

## Restrisiko und Freigabebedingung

**Fehlende** Legal-Hold-Felder gelten weiterhin als *nicht widerlegt*, nicht als rechtsverbindlicher `false`-Bescheid. Die aktuelle Kompatibilität mit vorhandenen Legacy-Datensätzen darf vor DPO/Legal-Abnahme **nicht** als wirksames materielles Löschentscheidungsmodell missverstanden werden. Für ein produktives GO ist ein von DPO/Legal/Security signiertes autoritatives Schema inklusive expliziter Bestätigung des Nichtvorliegens aller aktuellen Holds, erneuter Prüfung unmittelbar vor dem Delete, Watch/Revision-Fencing und legalsicherer Migration nötig. Gerade die mögliche Lücke zwischen GCS-Delete und Firestore-Quittung bleibt kritisch.

Dieser Draft benötigt einen **eigenen vollständigen exact-HEAD-CI-PASS**: Source-/Mutation-Gates, Typecheck, alle nativen Storage-, Tenant-Firestore- und Retention-Firestore-Emulatorfälle, Negativprüfung ohne Emulator, Vitest, Functions/Frontend-Build, Production-Smoke und 26 Browser. Eltern-PASS gilt nicht für diesen SHA. Echte genehmigte 404/412-/Timeout-/Crash-Quittungen, dauerhafte >300 Löschaufträge, IAM/Scheduler sowie P0 #254 Mandanten- und Art.-17-Isolation, signierte Medienzugriffs-Policy und alle unabhängigen Security/DPO/Legal/SRE/ReleaseOwner-Entscheidungen stehen aus.

**Kein Merge nach `main`, kein Deployment und keine Cloud-/Kundendatenmutation. Production BLOCKED/NO-GO.**

# P0 #202 – Reviewpflichtige Merge-Vorbereitung: altersbasierter Foto-Purge
Stand: 2026-11-02; Status: **BLOCKED / NO-GO**, `productionApproved=false`.

## Gefahrenbild und aktuelle Baseline

Die aktuell geprüfte GitHub-`main`-SHA `96c3857c53f5ced31fe1394895185f42c75bc716` enthält weiterhin `phase2_work/functions/src/deleteExpiredPhotos.ts`: `deleteExpiredPhotosCron` ruft `deleteExpiredPhotoPage(getMaintenanceBucket(), now, pageToken)` auf. `functions/src/retention.ts` löscht im Prefix `verification/` nach `metadata.timeCreated` und 30 Tagen; das ist kein Nachweis einer autoritativen Moderationsentscheidung oder einer durchsetzbaren Löschberechtigung. Das ist ein **quelltextbasierter P0-Release-Blocker**. Ob und wie dieser Job in der Live-Cloud aktiv ist, ist durch diese Prüfung **nicht** nachgewiesen.

## Vergleich der vier konkurrierenden Root-Drafts

| PR | Geprüfter Head | Beobachteter Umfang und Sicherheitsfolge | Triage-Entscheidung |
|---|---|---|---|
| [#269](https://github.com/Veselin-Takev/Klar-Dating/pull/269) | `d6c1c99978a0f6e402068d57d1da0ce75795d55f` | 10 Dateien. Entfernt den Storage-Bucket-Zugriff aus dem Legacy-Scheduler, behält `funnel_events`-Bereinigung und lässt `deleteExpiredPhotoPage` fail-closed abbrechen. Aktuell 13 Source-Guard-Mutationsfälle (ursprünglich 9, plus vier zusätzliche direkte Storage-/Alias-Negativfälle) und 3 relevante Vitest-Negativfälle; aktuelle CI noch nicht als PASS belegt. | **Erster, enger Review-Kandidat** für das quelltextbezogene Legacy-Abschalten; kein Merge-GO. |
| [#160](https://github.com/Veselin-Takev/Klar-Dating/pull/160) | `38f7e7016a784152cc1e518919a0d88eab488aaf` | 13 Dateien. Gleiche Legacy-Abschaltung, dazu bytegenaue HMAC-/Raw-Body-Änderungen. | Nicht parallel integrieren: separate HMAC-Prüfung und Abgleich mit #269 erforderlich. |
| [#231](https://github.com/Veselin-Takev/Klar-Dating/pull/231) | `c0cf0620a6b206adbe6c401117f81d6dedcc8da0` | 15 Dateien. Gleiche Legacy-Abschaltung, zusätzlich generation-gebundene aktive Löschfunktion und Audit-/Entscheidungsabgleiche. | Weiterer P0-Arbeitsschritt nach separatem CAS-/Hold-/Receipt-Review, nicht als sichere vollständige Löschkette attestiert. |
| [#203](https://github.com/Veselin-Takev/Klar-Dating/pull/203) | `09baf8910c812d664457a908f9f2d991b87aa664` | 20 Dateien. Entfernt Legacy-API und baut Scanner, Lease, Intent, GCS-Generation, 404-/Abwesenheitsquittung und Firestore-Metadaten erheblich um. | Als eigenständiger Integrations-/Migration-Kandidat behandeln. Vollständige Zustandsmaschinen-/Datenfluss- und Race-Tests ausstehend; keine unkontrollierte Überlagerung mit #269. |

Dateikollisionen zwischen #160/#203/#231/#269: 6 bis 8 gemeinsame Dateien je Paar; in **allen vier** dieselben `functions/src/deleteExpiredPhotos.ts` und `functions/src/retention.ts`. Die Testanzahl bezieht sich nur auf die sichtbaren `check-legacy-photo-purge.test.mjs`-Mutationseinträge (13) und `photoRetention.spec.ts` (3) im aktualisierten #269-Head, nicht auf den Gesamt-Testbestand.

## CI- und Review-Evidenz für #269 (getrennte Beweisstufen)

- **E1 Quellcode:** GitHub-Dateipatches der zwei Legacy-Funktionen und die drei `#269`-Testdateien wurden eingesehen. Guard ist überwiegend syntaktisch; dies ist kein Nachweis über Live-Funktionen.
- **E2 CI:** Commit `54ef22b87d40c90711e575d7e133b9311417f2f1` hat [GitHub Actions `Klar Enterprise CI`, Run 41283792515](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41283792515) mit Job `validate`: `completed/success`. Die Job-Schritte `Enterprise static gates`, `Typecheck`, `Functions build`, `Tests`, `Build`, `Production smoke`, `Browser acceptance` melden jeweils `success`; nur der bedingte Failure-Diagnostics-Upload wurde übersprungen. **Kein E3-Cloud-/Live-Nachweis daraus ableiten.**
- **E2 nun abgeschlossen:** [GitHub Actions Run 41523279539](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41523279539) für Head `d6c1c99978a0f6e402068d57d1da0ce75795d55f` ist `completed/success`; `validate`-Job erfolgreich, nur optionale Browser-Failure-Diagnostics `skipped`. **Kein Ersatz für unabhängige Reviews, Rebase-/Merge-SHA-Tests oder Live-Scheduler-Beleg.**
- **E2 aktueller PR-Head:** Nach zusätzlichen Source-Guard-/Mutationsprüfungen ist der neue Head `d6c1c99978a0f6e402068d57d1da0ce75795d55f` (2026-11-02). Der vorherige erfolgreiche CI-Run 41283792515 ist **historisch und kein Beweis für diesen Head**. Bei letzter Kontrolle war GitHub Actions für die neue SHA noch `pending`; Review und aktuelle Integrationstests ausstehend.
- **E2 Review:** PR #269 ist aktuell **Draft**, `mergeable_state=behind`, **0 Reviews**. Der geprüfte PR-Base-SHA ist `2808dc1cbb485f70b403681c108cea5a3361d950`, während `main` inzwischen `96c3857c53f5ced31fe1394895185f42c75bc716` ist. Die erfolgreiche CI gilt **nicht** für den noch nicht erzeugten, gegen aktuelles `main` integrierten Commit.
- **E4/E5:** Keine geprüfte aktive Cloud-Scheduler-Konfiguration, kein I/O-freier Real-Trigger-Nachweis, keine unabhängig signierten Freigaben.

## Nächster ausführbarer Integrationsplan (Fail-closed)

1. **Unabhängige Security-Freigabe einrichten:** Aktuelles GitHub Ruleset #25756841 verlangt bisher 0 Approvals und keine CODEOWNERS-Reviews. Vor Integration: mindestens ein unabhängig qualifiziertes Review und auf Betriebsebene überprüfte Regel-Durchsetzung; Review nach jeder Rebase erneuern.
2. **#269 auf neues, dediziertes Integrationsbranch gegen aktuelle `main` übertragen** (ohne `main` zu ändern). Keine gleichzeitige Cherry-Pick-Übernahme von #160/#231/#203; notwendige Testabdeckung einzeln übernehmen, soweit sie nach Diff-/Architekturreview kompatibel ist.
3. **Pflichtprüfungen auf neuem exakten SHA:** `check:legacy-photo-purge`, Functions-Build, Typecheck, betroffene Vitest-/Emulator-Gates, komplette Enterprise-CI, Browser-Sicherheits-/Regressionstests. Testfall: altes, noch nicht freigegebenes Foto darf nie anhand `timeCreated` gelöscht werden; Legacy-Helper darf weder lesen noch löschen; Funnel-TTL muss erhalten bleiben.
4. **Aktives Scheduler-Change-Gate:** SRE mit kontrolliertem Cloud-Funktions-/Scheduler-/IAM-Read-only-Inventar, abgesprochenem Rollback und Staging-/Live-Nachweis, dass kein anderer altersbasierter Löschjob weiterarbeitet. Keine ungenehmigte Live-Cloud-Änderung.
5. **Getrennter Folgeschritt:** Entscheidungsgesteuerter Scanner / generation-gebundene GCS-Löschung, persistenter Intent und belastbare Audit-Receipts prüfen; bei `404` keine löschende Wirkung erfinden, bei `412` Konflikt und Retry/Quarantäne ausweisen. Legal Holds und unveränderte Moderationsentscheidung vor Löschung und vor Receipt-Close validieren. #203/#231 und abhängige #202-PRs hierfür bewusst in separater, dokumentierter Integrationswelle evaluieren.
6. **Nur falls Anforderungen erfüllt:** Autorisierte Reviews, Merge nach aktuellem CI-Ergebnis und anschließende `main`-Regression. Überholte PRs erst mit explizitem Supersession-Nachweis schließen. Das übergreifende Production-NO-GO bleibt selbst nach einem erfolgreich gemergten Kill-Switch bestehen.

## Entscheidung

`#269 = erster enger Review-Kandidat` ist eine **Triage-/Empfehlungsentscheidung** ohne Merge-Berechtigung. Bis zur Integration und operativen Verifikation bleibt **P0 #202 offen**. Eigentümer für unabhängige Security-/DPO-/SRE-Prüfung, Freigabe und produktiven Nachweis sind organisatorisch festzulegen; hier wurde kein Reviewer ernannt.

## Synchronisationsnachweis: #269 gegen aktuellen `main` (2026-11-02)

**Geprüfter Ausgangspunkt:** alter PR-Head `d6c1c99978a0f6e402068d57d1da0ce75795d55f` versus `main` `96c3857c53f5ced31fe1394895185f42c75bc716`; gemeinsamer Ursprung `2808dc1cbb485f70b403681c108cea5a3361d950`. Ein GitHub-Compare bestätigte **3 zusätzliche Main-Commits mit genau vier geänderten Dateien**: `CODEOWNERS`, `phase2_work/docs/CODEOWNERS_ACTIVE_RETENTION_BOUNDARIES_2026-10-28.md`, `phase2_work/scripts/check-codeowners.mjs` und `phase2_work/scripts/test-codeowners.mjs`. Keine dieser Dateien wird von PR #269 geändert. Es gab daher keine Dateikollision; die vier Blob-SHAs der aktuellen `main`-Dateien wurden in den Feature-Branch-Tree übernommen.

**Ausgeführte, zweifach geparentete Branch-Integration:** Merge-Commit `895aaa3da2056d7799f887596b89c09207699925`, Eltern `d6c1c99978a0f6e402068d57d1da0ce75795d55f` und `96c3857c53f5ced31fe1394895185f42c75bc716`, ausschließlich auf `fix/p0-202-disable-legacy-photo-purge-20261101`. Die GitHub-Branch-Ref wurde mit Exact-SHA-Lease fortgeschrieben; kein Force-Push, keine Änderung an `main`.

**Read-after-write:** GitHub-Compare `main...895aaa3` meldet `ahead=16`, `behind=0`; weiterhin **genau 10** fachlich geänderte PR-Dateien. PR #269 ist weiterhin Draft, Merge-Status `blocked`, 0 Reviews. `Klar Enterprise CI` [Run 41527555204](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41527555204) ist auf genau dieser SHA **completed/success** (ein Job `validate`, alle erforderlichen Schritte erfolgreich; nur optionaler Browser-Failure-Diagnostics-Upload `skipped`). Dies ist E2/Source-CI auf dem synchronisierten Draft, **kein** Live- oder Release-GO. Der frühere Erfolg [CI 41523279539](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41523279539) gilt nur für den Vorgänger-Head `d6c1c999...`.

**Noch ausstehend:** unabhängige Security-Reviews, formal erzwungener CODEOWNERS-/Review-Schutz (Ruleset #25756841 zuletzt 0 Pflichtapprovals), finale CI, Emulator-/Staging-/SRE-Nachweise, funktionsfähiger generation-bound Purge und vollständiger Release-Entscheid. **Production weiterhin NO-GO.**

# P0 #70 — TTL-Nachweiszählung auf 20 geplante Collection-Groups abgestimmt

**Auditdatum:** 2026-11-02  
**Basis:** `main` Commit `2808dc1cbb485f70b403681c108cea5a3361d950`, isolierter Feature-Branch.  
**Release:** `productionApproved=false`, **BLOCKED / NO-GO**.

## Quellbasierter Befund

Das aktive `scripts/configure-retention.sh` definiert **20** Collection-Groups mit dem TTL-Feld `expiresAt`. `scripts/check-retention-matrix.mjs` und `scripts/check-retention-active-evidence.mjs` verlangen diese **20** Gruppen als technische Quellenmatrix und vollständigen offline ACTIVE-Nachweis. Die maßgebliche `docs/DATA_RETENTION.md` enthielt dagegen im Bereich **Aktivierung und Nachweis** noch vier operative Aussagen über **13** Gruppen. Spätere Abschnitte derselben Richtlinie dokumentierten die Ausweitung von 13 auf 20 bereits korrekt.

Ein Reviewer konnte deshalb unzutreffend annehmen, die Read-only-Evidenzprüfung brauche nur 13 ACTIVE-Gruppen. Es ist eine belegte **Dokumentations-/Abnahmekriterium-Diskrepanz**, **kein** Beleg für einen veralteten Produktionszustand oder eine tatsächliche Firestore-TTL-Aktivierung.

## Enger Fix und Regressionen

- Vier operative Nachweisaussagen in `docs/DATA_RETENTION.md` auf 20 umgestellt. Der Text sagt ausdrücklich, dass die sieben zusätzlich geplanten Policies **nicht** durch eine alte 13-Gruppen-Genehmigung freigegeben werden.
- Eindeutige P0-Notiz: `configure-retention.sh` ist standardmäßig nur Dry-Run; echte 20er-Aktivierung verlangt außerhalb der CI separate DPO-/Legal-/Inventar-/Staging-Freigabe und projekt-/datenbankgebundene ACTIVE-Evidenz.
- `scripts/check-retention-matrix.mjs` prüft jetzt auch die vier operativen 20er-Aussagen und den rechtsklaren Freigabevorbehalt.
- `scripts/test-retention-matrix.mjs` ergänzt fünf Negativmutationen: vier Rückfälle auf 13 und Wegfall des Freigabevorbehalts.
- Keine Änderung am gcloud-Provisionierungsskript, den eigentlichen Firestore TTL Policies, Firestore/Storage Rules, Kundendaten oder IAM; **keine Cloud-Zugriffe oder Produktivmutation**.

## Erster exact-head-CI-Lauf und reproduzierter Regressionstest-Fehler

Die initiale HEAD-SHA `8d1c31331436c7ec7799919f8ffc997783337f08` erreichte im [Enterprise-CI #41471134436](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41471134436) das Retention-Gate. Der 20er-Quellmatrix-Check bestand, aber der neu hinzugefügte Negativfall `missing explicit new-matrix legal approval caveat` scheiterte: Der Guard `/keine.*DPO-\/Legal-Freigabe der erweiterten Matrix/` matchte trotz Entfernung des entscheidenden `**keine**` noch ein anderes `keine` auf derselben Zeile. Deshalb wurde die Mutation irrtümlich akzeptiert und die CI korrekt mit Fehler abgebrochen.

**Korrektur:** Die Assertion verlangt nun exakt den unmittelbar vor `DPO-/Legal-Freigabe` stehenden Ausdruck `**keine**` (`d1eb4299d0f138865b748283a618dc7abf2932e3`). Der Negativfall muss damit scheitern, ohne die tatsächlich fehlende Fachfreigabe sprachlich zu verwischen. Eine **erneute vollständige CI für den finalen Branch-HEAD** ist erforderlich. Der alte fehlerhafte CI-Lauf ist ausdrücklich kein PASS.

## Verifikation, Grenzen und Governance

Eine **neue vollständige exact-HEAD-CI** ist für diesen Branch erforderlich. Auch nach CI-PASS gilt: Der Offline-Validator prüft nur Quell-/Dokumentationskonsistenz und gespeicherte Evidenz, keine reale TTL-Konfiguration. Ein `ACTIVE`-Nachweis benötigt einen autorisierten und zeitgebundenen read-only Cloud-Abruf für exakt das genehmigte Projekt und die Datenbank. Die Matrix selbst benötigt unabhängige Bestands-/Legal-Hold- und Datenschutz-/Rechtsfreigabe. TTL ist asynchron und ersetzt weder sofortige DSGVO-Art.-17-Löschungen noch Audit-/Vertrags-Aufbewahrung.

P0 #70 sowie #202 (GCS-Löschquittungen) und #254 (Tenant-Isolation) bleiben offen. Es fehlen DPO/Legal/Security/SRE/ReleaseOwner-Freigaben. Kein Merge auf `main`, kein Deploy und keine Produktionsdatenänderung.

## Fortgesetzte Prüfung am 02.11.2026 – Runbook-Abnahme und CI

Der korrigierte exakte Parent-Stand `166bd46f23d329a5ada61bc7a0b17535b795c257` hat [Enterprise-CI #41471440604](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41471440604) **SUCCESS** erreicht (vor dieser neuen Änderung).

Eine anschließende Source-Prüfung ergab zwei weitere operative, veraltete Aussagen in `docs/PRODUCTION_RUNBOOK.md`: Der separate read-only `gcloud`-LIVE-Nachweis und `scripts/verify-retention-staging-live.sh` waren dort noch auf **13 ACTIVE TTL-Gruppen** beschrieben, obwohl das unveränderte tatsächliche Tool und der Source-Matrix-Validator **20** verlangen. Die beiden aktuellen Runbook-Aussagen wurden auf 20 korrigiert; die ausdrückliche unabhängige Genehmigung der erweiterten Matrix bleibt Voraussetzung.

Der verbindliche Matrix-Gate prüft jetzt sowohl `docs/DATA_RETENTION.md` als auch die beiden operativen Runbook-Aussagen und den Hinweis, dass eine technische Prüfung kein DPO-/Legal-GO ist. Die Offline-Mutationstests kopieren die Runbook-Datei in den Test-Sandbox-Ordner und prüfen drei zusätzliche Negativfälle: 13er-LIVE-Zählung, 13er-Exporter-Zählung und fehlender Rechtsfreigabevorbehalt.

**Neue Source-/Test-/Dokumentations-Commits nach Parent-CI:** CI #41471440604 beweist ausschließlich den früheren Stand, nicht diese Erweiterung. Erforderlich ist erneut ein vollständiger exact-head PASS. Keine aktiven TTL Policies, IAM-Konfiguration oder produktiven Daten wurden verändert. **P0 #70 weiterhin offen; NO-GO.**

**Freigabeentscheidung: BLOCKED / NO-GO.**

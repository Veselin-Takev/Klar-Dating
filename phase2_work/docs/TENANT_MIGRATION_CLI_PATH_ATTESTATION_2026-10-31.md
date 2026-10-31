# P0 #254 – Dry-Run CLI: kanonische Quellenpfade und echte End-to-End-Negativtests

**Prüfdatum:** 31.10.2026 · **Status:** isolierter Draft, **BLOCKED / NO-GO**. **Geprüfter Parent:** [PR #259](https://github.com/Veselin-Takev/Klar-Dating/pull/259) mit exakt `14d27ad13bc9d80391edcfd8e92a467631046cb4` und erfolgreich abgeschlossenem [Enterprise-CI-Run #41235242388](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41235242388).

## Nachgewiesener Grenzfall

`scripts/tenant-migration-preflight.ts` öffnete bereits mittels `O_NOFOLLOW` ausschließlich die finale Dateikomponente. Das verhindert **keine** Symlinks in übergeordneten Verzeichnissen: `/sicher/alias/inventory.json` kann über `alias -> /andere/quelle` zu einem anderen tatsächlichen Verzeichnis zeigen. Zwar fangen Ed25519, Snapshot-Pins und Quell-SHA-256 jede unautorisierte Änderung der **Dateiinhalte** ab, aber die Behauptung „ohne Symlink-Traversal“ war für die gesamte Pfadkette bisher nicht belegt. Außerdem waren die reinen Bibliothekstests kein Nachweis der tatsächlichen `node --import=tsx scripts/tenant-migration-preflight.ts --dry-run`-Ausführung.

## Implementierter Fix und Scope

- Vor jeder Dateiöffnung wird der absolut vorgegebene Pfad mit `realpathSync.native(path)` verglichen; Änderungen durch Symlink-Ancestors, Dot-Segmente oder sonstige Alias-Normalisierung werden fail-closed abgelehnt. `O_NOFOLLOW` schützt weiterhin die finale Komponente. Die bestehenden Dateigrößenlimits, `fstat`-Prüfungen und das sichere Schließen der FD bleiben unverändert.
- `tests/tenantMigrationCli.spec.ts` erzeugt **nur lokale synthetische** Ed25519-Schlüssel, valide Inventar- und Mappingdateien, einen gepinnten öffentlichen Schlüsselring und drei erwartete SHA-256-Pins in einem temporären restriktiven Testverzeichnis. Das Testverfahren ruft den echten CLI über Node/tsx auf und prüft einen gültigen, weiterhin ausdrücklich blockierten Report ohne personenbezogene Ausgabe oder Dateiveränderung.
- Derselbe End-to-End-Testpfad verweigert fehlende/falsche Pins, direkte Symlinks, **übergeordnete** Symlinks, nicht kanonische Dot-Segment-Pfade und `--execute` statt `--dry-run`. Auch Fehlermeldungen dürfen keine Test-UID enthalten.
- Die CLI-Integrationstests wurden dem vorhandenen Pflichtskript `check:multitenant-foundation` hinzugefügt, das über `check:enterprise` in der GitHub-CI läuft. Alle neuen Testfälle benötigen einen neuen SHA-gebundenen CI-PASS.

## Sicherheitsgrenzen / verbleibende P0-Blocker

**Dies ist keine Race-free-Dateiöffnung:** `realpathSync.native` und `openSync` sind getrennte Operationen. Ein konkurrierender Angreifer mit Schreibrecht in den Verzeichnis-Pfaden könnte währenddessen Elemente austauschen (TOCTOU). Für eine belastbare produktive Dateikettenkontrolle wäre ein unveränderlich bereitgestelltes, ausschließlich von Berechtigten verwaltetes Verzeichnis/Container-Mount oder eine geeignete kernelgestützte `openat2`-Policy mit `RESOLVE_NO_SYMLINKS` und unverwechselbarer Dateiherkunft nötig. Beides ist hier **nicht** umgesetzt und muss durch unabhängige Host-/SRE-Evidenz abgesichert werden.

Die Tests beweisen weder die **tatsächliche** Herkunft aus Firestore noch die wirksame Widerrufbarkeit des Trust-Anchors, Signer-Rollenberechtigung, Snapshot-Freshness, Art.-17-Compliance, IAM-/Rules-Konfiguration oder Chat-/Payment-/KYC-BOLA/IDOR. `--dry-run` bleibt der einzige CLI-Modus und der erfolgreiche Output bleibt `BLOCKED_MANUAL_APPROVAL_REQUIRED`; es gibt **keinen** Live-Executor oder Secret-Upload.

Zusätzlich sind die ausdrücklich angeforderten externen npm-audit-/Semgrep-/Gitleaks-/ESLint-Gates im aktiven Enterprise-CI nicht vollständig durch exakte SHA-gebundene Logs nachgewiesen (Issue #8). **Keine globale Freigabe, kein Merge, kein Deployment. Production BLOCKED / NO-GO.**

## CLI-Negativtests für die nicht signierte Signatur-Hülle (31.10.2026)

Der genaue Read-only-CLI-Testpfad akzeptierte bisher eine mehrdeutige `signatures.json`-Datei, wenn `JSON.parse` den letzten von zwei gleich benannten Signatur- oder Versionsschlüsseln als gültig interpretierte. Der neue Parser zwingt für die Signaturdatei ebenfalls reproduzierbares, strikt dekodiertes JSON und die unveränderte Zod-Signaturhülle. Fehlformate werden fail-closed verweigert. [Vollständige Bewertung](SIGNED_SIGNATURE_ENVELOPE_CANONICALIZATION_2026-10-31.md). Diese zusätzliche Prüfung macht die bereits dokumentierte Pfadöffnung **nicht** racefrei.


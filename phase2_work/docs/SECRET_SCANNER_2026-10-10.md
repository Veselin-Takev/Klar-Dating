# SEC-SCAN-01 – Secret-Scanner gehärtet

Stand: 10.10.2026. Basis: `5334bc6aca0d8d8ca3deb7a5f04a54c11fef3a9d`.
Korrekturbranch: `fix/audit-runtime-policy-2026-10-10`.
**Kandidat, keine Produktionsfreigabe.**

## Zuordnung und Befund

Dieser Befund entspricht **SEC-01 im Enterprise-Audit vom 09.10.2026**
(`ENTERPRISE_END_TO_END_AUDIT_2026-10-09.md`). Die späteren Korrekturdokumente
verwenden SEC-01 für die Release-CI-Bindung. Deshalb verwendet dieses Dokument
die eindeutige Kennung **SEC-SCAN-01**; keine der beiden Maßnahmen ersetzt die andere.

Der bisherige Scanner erkannte lediglich Google-API-Key-Muster und einen
Private-Key-Marker, übersprang Dateien anhand von Namensbestandteilen und
ignorierte Lesefehler. Ein unvollständiger Scan konnte damit erfolgreich erscheinen.

## Änderungen

- Erkennung charakteristischer Muster für Google API Keys, mehrere PEM-Private-Key-
  Varianten, Stripe Secret/Restricted/Webhook Keys, SendGrid, GitHub, AWS Access IDs,
  Google OAuth Client Secrets, Slack und npm.
- Keine pauschale Ausnahme für Tests, Scannerdateien oder Dateien mit
  `firebase-applet-config.json` im Namen.
- Die bestehende Ausnahme für den öffentlichen Firebase-Web-Key ist eingeschränkt
  auf den exakten relativen Dateipfad, das einzelne `apiKey`-Feld, die vorhandene
  Projekt-ID und den SHA-256-Fingerabdruck des bereits vorhandenen Werts.
  Weitere Credential-Muster in derselben Datei werden weiterhin erkannt.
  Ein neuer Key erhält keine automatische Ausnahme.
- Fehler beim Lesen/Traversieren, ungültige öffentliche Konfiguration,
  leere Scans, Symlinks, Spezialdateien oder Dateien über 32 MiB führen zu Exit 2
  (`INCOMPLETE`). Treffer führen zu Exit 1; nur ein vollständig ausgeführter
  Scan innerhalb des definierten Umfangs ohne Treffer führt zu Exit 0.
- Ausgaben enthalten ausschließlich relativen Pfad, Regel und Zeile.
  Keine Trefferwerte oder beliebigen I/O-Fehlermeldungen werden serialisiert.
- `check:secrets` führt die neuen Regressionstests vor dem Scan aus; der Befehl
  ist bereits Bestandteil von `check:enterprise`.

## Umfang und verbleibende Grenzen

Der Scanner untersucht den aktuellen Arbeitsbaum unter dem Arbeitsverzeichnis.
CI startet ihn in `phase2_work/`. Er scannt keine Git-Historie und keine
abweichenden Quelldateien außerhalb dieses Verzeichnisses.
Ausgenommen bleiben Verzeichnisse mit den exakten Namen `.git`, `node_modules`,
`google-cloud-sdk`, `dist` und `build`. Gleichnamige Dateien werden nicht ausgenommen.
Abhängigkeiten und generierte Artefakte benötigen separate Supply-Chain-/Artefaktprüfungen.

Die Mustererkennung ist keine umfassende Secret-Erkennung: unbekannte, zusammengesetzte,
kodierte oder ausschließlich hochentropische Credentials können unentdeckt bleiben.
Kein bestätigter Produktions-Credential-Fund und keine Rotation werden behauptet.
Dedizierter Secret-Scanner, Historienprüfung, Push Protection und breite SAST-Abdeckung
bleiben offen. Bestehende Test-Fixtures im vollständigen Repository müssen bei Treffern
einzeln geprüft werden; keine pauschale Testverzeichnis-Ausnahme hinzufügen.

Firebase dokumentiert öffentliche Web-Konfiguration als grundsätzlich veröffentlichbar
bei passenden API-/Client-Einschränkungen. Deren tatsächliche Einrichtung im Zielprojekt
wurde hier **nicht** verifiziert. Die eingeschränkte Ausnahme bewahrt die bisherige
Web-Konfiguration; sie ist keine Betriebsfreigabe.
Quelle, geprüft am 10.10.2026: https://firebase.google.com/support/guides/security-checklist

## Validierung

- 15 neue Node-Regressionstests unter Node 24.19.0 bestanden.
- `npm run check:secrets`: PASS; lokaler Scan des verfügbaren Teilauszugs mit
  54 Dateien einschließlich dieser Dokumentation, keine Musterfunde.
- Kein vollständiger Checkout- oder Historien-Scan; kein vollständiger
  Enterprise-/App-/Emulatorlauf unter Node 22.23.3.
- Keine Abhängigkeit und kein Lockfile geändert; kein PR, Main-Push, Tag,
  Workflow-Dispatch oder Deployment ausgelöst.

## Vor Freigabe

1. Auf dem exakten Kandidaten vollständigen Checkout mit freigegebener Toolchain
   prüfen; `npm run check:secrets` und sämtliche Enterprise-Gates ausführen.
2. Treffer ohne Veröffentlichung des Werts triagieren. Bestätigte Server-Secrets
   beim jeweiligen Provider widerrufen/rotieren und Verwendungsstellen korrigieren.
3. Firebase API-/Client-Einschränkungen, getrennte Server-Credentials und Zugriffe
   auf kostenpflichtige Nicht-Firebase-APIs im autorisierten Projekt nachweisen.
4. Dedizierten Vollrepository-/Historien-Scan und Push Protection separat einführen.
   Rechte/Lizenzierung sowie CI-Minuten vor konkreter Aktivierung klären.
5. Unabhängige Produktionsfreigaben bleiben erforderlich.

TCO: keine neue SaaS-Abhängigkeit; zusätzlicher lokaler Scan-/Testaufwand.
Eine monetäre oder prozentuale Einsparung ist nicht gemessen.


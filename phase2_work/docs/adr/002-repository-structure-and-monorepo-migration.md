# ADR-002: Root-Workspace und schrittweise Repository-Konsolidierung

- Status: **Proposed** — dokumentierte Zielrichtung, keine Migrationsfreigabe
- Datum: 2026-10-13
- Betroffene Version: Vorbereitung v149; technische Migration frühestens nach stabilisiertem v149-Go-live
- Verantwortlich: Architektur, Platform Engineering, Security, QA, Release Management
- Release-Gate: [Issue #8](https://github.com/Veselin-Takev/Klar-Dating/issues/8)

## Ausgangslage

Das Repository hat an der Root-Ebene unter anderem `package.json`, `bun.lock`, `Dockerfile`, `firebase.json`, `server.ts`, `tsconfig*.json`, `vite.config.ts` und `playwright.config.ts`. Unter `phase2_work/` liegen gleichnamige Dateien und die aktuell in GitHub CI genutzte Anwendung. Die zentrale `.github/workflows/ci.yml` verwendet ausdrücklich `working-directory: phase2_work` und installiert `phase2_work/bun.lock` sowie `phase2_work/functions/package-lock.json`. Der Root-`Dockerfile` baut dagegen innerhalb seines eigenen Docker-Kontexts auf Basis von Root-`package.json`/`bun.lock`; `firebase.json` referenziert den relativen Funktionspfad `functions`.

Die bloße Existenz doppelter Dateien beweist weder identische Inhalte noch dieselbe Deployment-Autorität. Insbesondere dürfen Root- und `phase2_work`-Builds **nicht** ohne Herkunfts-/Release-Identitätsprüfung als austauschbar betrachtet werden.

## Entscheidung

**Keine große Umstrukturierung in v149.** Zunächst werden Konfigurationshoheit und Pfade dokumentiert. Eine zukünftige konsolidierte Root-Workspace-Architektur wird nur in unabhängig überprüften, rückrollbaren PRs umgesetzt. Ziel sind klar begrenzte `apps/`, `functions/`, `packages/`, `tests/`, `docs/` und `scripts/`, nicht maximal viele Pakete. Das finale Layout bleibt bis zur Abhängigkeitsanalyse **[ANNAHME]**.

Während v149: keine Verschiebung von Quellcode, keine neue Paketauflösung, keine Verschiebung von Firestore- oder Storage-Rules, keine Änderung von GitHub-Workflow-Working-Directories oder Docker-Build-Kontexten. Sicherheits- und Produktionsblocker haben Priorität.

## Bestehende Autoritätsgrenzen (zu bestätigen)

| Bereich | Beobachteter Pfad | Gegenwärtiger Befund |
| --- | --- | --- |
| GitHub CI | `.github/workflows/ci.yml` | `working-directory: phase2_work` |
| Aktiver CI-Abhängigkeitsbaum | `phase2_work/package.json`, `phase2_work/bun.lock` | `bun ci`, `bun run typecheck`, Tests, Build, Playwright |
| Functions CI | `phase2_work/functions/package-lock.json` | `npm ci --prefix functions` relativ zu `phase2_work` |
| Root-Docker-Kontext | `Dockerfile` | `COPY package.json bun.lock ./`; Deployment-Zuordnung separat verifizieren |
| Firebase Root-Konfiguration | `firebase.json` | `functions[].source: functions`; maßgebliche Deployment-Config je Umgebung zu bestätigen |
| Dokumentation | Root und `phase2_work/` | Mehrfache gleichnamige Dokumente, Version und Freigabestatus vor Zusammenführung vergleichen |

## Geplante schrittweise Migration

1. **Inventar + Provenance**: vollständiges Datei-, Skript-, Import-, CI-, Docker- und Firebase-Pfadverzeichnis; pro Artefakt eine autoritative Quelle bestimmen; Hash- und Inhaltsvergleiche der Doppeldateien dokumentieren.
2. **Baseline einfrieren**: exakt benannten `main`-SHA, Node 22.23.3, Bun 1.4.2, Lockfiles, CI-Befehle, Build-Hashes, Firestore-Rules-, Storage-Rules- und Release-Manifeste erfassen.
3. **Pfadtests vor Änderungen**: maschinenlesbare Tests für CI-Working-Directories, Firebase `functions.source`, Docker-Kontext, TS-Project-References, Vite-Imports, Emulatorpfade und Deploy-Artefaktherkunft.
4. **Workspace-Root festlegen**: nur ein Dependency- und Paketmanager-Konzept pro Build-Graph; eindeutiges Root-`package.json` mit expliziten Workspace-Skripten; Backend/Frontend erst nach geprüftem Trennungsbedarf in `apps/` verschieben. Shared Packages nur für tatsächlich stabile APIs.
5. **Kleine Migrations-PRs**: zunächst Dokumentation und Skripte; danach jeweils ein abgrenzbarer Code-/Konfigurationsbereich. Jeder PR enthält Rückrollplan, Import-/Alias-Korrekturen, Regeln-/IAM-Grenzen und Testnachweise.
6. **Beweiskette**: vor und nach jedem Schritt `npm run typecheck`, `npm run test:pure`, `npm run test:rules`, `npx playwright test`, `npm run build`; zusätzlich Security-, Compliance-, Functions- und Release-Gates auf identischem Commit. GitHub Actions-Minutenbudget respektieren.
7. **Abschließende Aufräumarbeiten**: redundante Dateien nur nach dokumentiertem Verbraucher-Nachweis entfernen. Rückwärtskompatibilität, Entwicklerdokumentation und GO-/NO-GO-Freigabe gemeinsam aktualisieren.

## Risikokontrollen

- Keine stillen Wechsel von Produktiv-Entry-Points, Servicekonten, Firebase-Projekten, Deploy-Regions oder Regeln.
- Keine Scheinreduzierung von Fehlern durch `@ts-ignore`, `any`, Lockfile-Divergenz oder gelockerte CI.
- Keine ungetestete Parallel-Deployment-Strategie und kein Copy-and-paste zweier produktiv gepflegter Anwendungen.
- Rollback: Verschiebungs-PR zurücksetzen, ohne bestehende Produktionsdaten oder Migrationen zu berühren.
- **GO** für Strukturmigration erst nach v149-Stabilisierung und eindeutiger Autoritätsentscheidung; bis dahin operative Produktionsfreigabe **NO-GO** laut Issue #8.

## Verworfen

- Vollständiger Big-Bang-Rename während v149 — unnötig hohes Regressions-/Deployment-Risiko.
- Sofortige Root-Datei-Löschung anhand gleicher Dateinamen — keine gesicherte Verbraucherzuordnung.
- Vielzahl kleinteiliger Packages ohne klare Ownership oder Wiederverwendung — zusätzlicher TCO- und Tooling-Aufwand.

## Nächste Entscheidung

Der Architekturrat muss nach vollständiger Pfad- und Ownership-Prüfung bestätigen, ob das Ziel ein schlankes Bun-Workspace-Monorepo oder eine einzelne Root-Anwendung mit separat verwalteten Functions ist. Beide sind zulässig; entscheidend sind nachweisbare Build-Reproduzierbarkeit und geringere Betriebsrisiken.

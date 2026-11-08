# Klar — PR #360 System-Remediation, v0.1.1-rc1

**Code implementiert; Revalidierung läuft. Produktion NO-GO. PR #360 bleibt Draft.**

Implementiert: authentisierte Medienauslieferung ohne statische Bearer-URLs; dauerhafte DSA-Fences und unabhängiger Auth-/Medien-Widerruf; transaktionale Hold-Prüfung; wiederaufnehmbare Bild-Purges mit expliziter Provenienz; zentrale Logging-Allowlist; gemeinsame Firestore-Rate-Limits.

Die neue Implementierung ersetzt keine Betriebsattestierung. Produktive Alt-Capabilities wurden nicht migriert; effektive IAM-/Edge-/Logging-/Retention-Policies und der All-Writer-/Hold-Vertrag sind nicht unabhängig verifiziert. Verifikationsbilder ohne freigegebene kontobezogene Nachweise bleiben gesperrt. `productionApproved=false`; kein Merge, Deployment, IAM-Apply oder finales Sign-Off.

[Implementierung und Betriebs-Gates](phase2_work/docs/security/SYSTEM_REMEDIATION_2026-11-08.md). Die 79 Audit-Tests sind in der vollständigen Suite enthalten und werden nicht doppelt gezählt. Verbindliche Laufzahlen folgen nach Abschluss der Revalidierung.

Historischer letzter vollständiger CI-Nachweis vor dieser Implementierung: `0e2c7e89fad3008f6d165c2b45ac1e936506043a`, 1.660 PASS. Diese Zahl attestiert die neue Implementierung noch nicht. Die frühere Wave-3-Quellcode-Baseline und ihre Grenzen bleiben im [Zertifizierungsbericht](phase2_work/docs/security/MIGRATION_WAVE3_CERTIFICATION.md) dokumentiert.

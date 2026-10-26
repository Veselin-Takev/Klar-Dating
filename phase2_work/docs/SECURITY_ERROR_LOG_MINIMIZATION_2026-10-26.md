# Fehlerlog-Minimierung – technischer Checkpoint 26.10.2026

Produktionsstatus: **NO-GO**. SEC-04 bleibt teilweise offen.

Zehn Fehlerpfade in `server.ts` und `translationService.ts` verwenden feste,
allowlist-validierte Ereigniscodes statt Fehlerobjekten, Nachrichten oder Stacks.
Der Logger akzeptiert keine Metadaten. Unbekannte Laufzeitwerte werden ohne
Inspektion als `unclassified_failure` erfasst. Severity und Ereignis bleiben für
die betriebliche Diagnose erhalten; HTTP-Status und Übersetzungs-Fallback bleiben gleich.

Lokale Verifikation: Node 24.22.1 / Vitest 5.0.5: **35 Tests in zwei Dateien bestanden**.
Davon 14 neue Logger-/Übersetzungs-/Quellstruktur-Fälle und 21 Stream-Limit-Regressionen.
Die Tests prüfen synthetische sensible Marker, Stack/Cause, zusätzliche JS-Argumente,
Prototypnamen und Objekte mit auslösenden Gettern. Die Quellstrukturprüfung begrenzt
sich auf die beiden geänderten Verbraucher und lässt die bestehende lokale
Emulator-CSP-Diagnose ausdrücklich aus. Keine globale Datenflussanalyse.

Vollständige Node-22-/Bun-/Emulator-/Browser-CI für diesen neuen Stand steht aus.
Andere Logger, reale Log-Senken, Zugriffsrechte, Löschfristen und unabhängige
Datenschutz-/Security-Abnahme sind nicht durch diesen Patch validiert.
Keine Produktionsfreigabe und kein Live-Staging-/Rollback-Nachweis.

Rollback: Den zugehörigen Änderungscommit regulär revertieren und dieselben
Pflichttests ausführen. Das stellt die vorherige Fehlerlog-Ausgabe wieder her;
ein solcher Rollback erfordert deshalb erneut die Bewertung der Log-Minimierung.
Keine Datenbank-, Schema- oder Infrastrukturänderung.

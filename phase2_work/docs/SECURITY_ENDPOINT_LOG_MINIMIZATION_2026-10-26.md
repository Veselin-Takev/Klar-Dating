# Endpunkt-Fehlerlog-Minimierung – 26.10.2026

**Produktion NO-GO. SEC-04 bleibt teilweise offen.**

Feedback-, Gerätetoken- und Audit-Log-Router schreiben bei Persistenz-/Abfragefehlern
nur noch feste Ereigniscodes über den bestehenden Laufzeit-Allowlist-Logger.
Keine Fehlerobjekte, Nachrichten, Stacks oder Requestdaten gelangen über diese drei
Aufrufe in die Konsole. Severity, HTTP-Status und bestehende Antwortkörper bleiben erhalten.

Die vorhandenen HTTP-Endpunkttests prüfen nun zusätzlich den vollständigen Inhalt
des jeweiligen Log-Aufrufs bei absichtlich ausgelösten Speicherfehlern. **36 Tests
in vier Dateien bestanden lokal** unter Node24.22.1/Vitest5.0.5, einschließlich
Logger-Regressionen, erfolgreichen HTTP-Anfragen und negativen Auth-/Payloadfällen.
Die Datenbank ist in diesen HTTP-Tests injiziert; es handelt sich nicht um einen
Live-Staging-, Firestore-Last- oder Produktionsnachweis. Vollständige CI ausstehend.

Andere Logger und tatsächliche Logsenken/Zugriffe/Löschfristen bleiben ungeprüft.
Keine globale Datenschutzfreigabe aus diesen drei Korrekturen ableiten.
Rollback: zugehörige Code-/Teständerungen gemeinsam regulär revertieren und
Pflichtprüfungen ausführen; dies würde rohe Fehlerausgaben wieder zulassen und
verlangt deshalb eine erneute Sicherheitsbewertung.

## Bestätigter vorheriger Stand

PR141 bestand die vollständige CI40401540775 auf
`1becdf979492482a87ba1d7dd8518d1771d87a16`:190Vitest-Dateien/1.347Tests bestanden.
Die separat im Functions-Build ausgeführten Node-Kompatibilitätstests bleiben
explizit erhalten; nur die versehentliche erneute Vitest-Erfassung wurde ausgeschlossen.
Der erste fehlgeschlagene Lauf ist dadurch nicht nachträglich erfolgreich.
Main-Merge:`aa430e5d99e26834093db37b124de999b61a68d7`; exakter Tree-Vergleich bestanden.

PR140 bleibt Draft: reguläre CI40397909542 erfolgreich, separater OSV-Scan40397909553
Exit1 wegen21betroffenen Versionen/39Advisories unter1.438Versionen. Keine Ignoreliste,
keine globale Clean-Behauptung. Die Functions-Teilkorrektur beseitigt nicht die
betroffenen Versionen in den weiterhin unveränderten Root-/App-Locks.

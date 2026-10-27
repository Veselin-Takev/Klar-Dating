# P0-Kontrollen: technischer Stand und offene Nachweise — 2026-10-27

Prüfbasis: main `05e2cdc1525b7d6fc417b67502b473348217545e` plus die hier dokumentierte Prüfskriptkorrektur. **Keine vollständige P0-Schließung und keine Produktionsfreigabe.** Diese Bestandsaufnahme ist keine rechtliche Compliance-Abnahme. Ein separates Staging-Projekt existiert noch nicht; es wurden keine Cloud-Ressourcen eingerichtet oder Live-Staging-/Produktionsschreibvorgänge ausgeführt.

## Kontrollmatrix

| Kontrolle | Vorhandene Umsetzung | Noch erforderlicher Nachweis / Abgrenzung |
| --- | --- | --- |
| TTL-Retention | `check-retention-matrix.mjs` prüft 20 Collection-Gruppen und die Zuordnung zu Konfiguration/Dokumentation. Expiry-Writer-Prüfungen und geschützte Evidenzvalidatoren sind vorhanden. | Reale projekt- und datenbankgebundene ACTIVE-Evidenz sowie Ablauf-/Löschmessungen fehlen. Firestore TTL ist keine sofortige, rekursive oder atomare Löschgarantie. Ein historischer Foto-Retention-Prüfpfad muss mit der aktuellen Implementierung abgeglichen werden. |
| Fail-Closed Auth & Consent | `server.ts` prüft Bearer-Format, widerrufene Firebase-Tokens, Sitzungsstatus und Löschbarriere. Alters-/Zweckprüfungen verweigern bei fehlenden Voraussetzungen oder Datenbankfehlern. Öffentliche Endpunkte haben gesonderte Grenzen. | Vollständige Routen-/Dienste-/Storage-Abdeckung und Betriebsnachweise sind nicht abgeschlossen. Öffentliche Healthchecks und signierte Webhooks benötigen andere Kontrollen als nutzerbezogene Consent-Middleware. |
| Token-Privacy | HTTP-Diagnostik und mehrere Fehlerpfade verwenden begrenzte Metadaten bzw. feste Fehlercodes; weitere Log-Minimierungen sind integriert. | Keine pauschale Zusicherung für sämtliche Logs, Traces und Senken. Verbleibende Pfade, Collector-Konfiguration, Zugriffe und tatsächliche Retention müssen geprüft werden. `pino` ist keine direkte Abhängigkeit dieser Architektur. |
| Art. 17 Deletion | Persistente Löschjobs, Sperrbarriere, Phasen/Leases, Wiederholung, Storage-Löschung und Abschlussquittung mit gemeinsamem Firestore-Abschluss sind vorhanden. Die Referral-Kaskade quarantänisiert vor Kindlöschung und entfernt Eltern erst danach. | Keine globale atomare Transaktion über Auth, Firestore, Storage und externe Anbieter. Fehler-/Neustart-/Hold-/Restore-Szenarien und reale Ende-zu-Ende-Nachweise bleiben erforderlich. `ioredis` und `bullmq` sind keine direkten Abhängigkeiten. |
| HMAC-SHA256 Webhooks | Mehrere anbieterbezogene Verifikationspfade, zeitgebundene Signaturen und konstante Digest-Vergleiche; Stripe nutzt die SDK-Verifikation. Teilweise persistente Ereignis-Deduplizierung. | Keine universelle identische Raw-Body-Regel: Anbieterprotokolle unterscheiden sich. Ein 300-Sekunden-Fenster verhindert allein keine Wiederholung innerhalb dieses Fensters. Persistente Deduplizierung und Fehlerfälle müssen pro Eingang nachgewiesen werden. |
| CSP | Aktive Helmet-Konfiguration in `server.ts`, Produktionsentscheidung unabhängig von Emulator-Flags, eingeschränkte Quellen sowie Objekt-/Frame-/Form-Grenzen. | Tatsächlich ausgelieferte Header einschließlich Proxy/Hosting und Browser-Kompatibilität sind noch nachzuweisen. Aktive Richtlinie enthält gezielte Ausnahmen; sie ist nicht überall die vereinfachte Policy `script-src 'self'`. Ein ungenutzter Helper belegt keine Laufzeitwirkung. |

## Prüfkorrektur: Art.-17-Quellprüfung

Zwei bestehende Kontrollbedingungen verglichen mehrzeilige Quelltexte mit LF. Windows-Checkouts mit CRLF meldeten deshalb fehlende Slice-Guards, obwohl diese vorhanden waren. Der Prüfer normalisiert jetzt ausschließlich CRLF zu LF beim Lesen. Kontrollbedingungen, Reihenfolge und Verweigerungslogik bleiben erhalten; der produktive Löschpfad wurde nicht geändert.

Die bestehende Mutationstestreihe prüft alle Fixture-Dateien mit LF und CRLF: **2 gültige Baselines und 24 verweigerte Mutationen**. Darunter fehlende Quarantäne, fehlende Slice-Guards, nicht abgewartete Kindlöschung und vorgezogene Elternlöschung. Zusätzlich lokal bestanden: **7 Storage-Löschtests, 7 Quarantäne-Tests und 20 Emulator-Preflight-Tests**. Ausführung unter Node **24.22.1**; vollständige gepinnte CI bleibt vor Integration erforderlich. Preflight-Tests sind kein ausgeführter Emulator- oder Live-Staging-Test.

## Retention-Prüfungen richtig einordnen

`check-retention-matrix.mjs` bestand lokal für 20 Gruppen. `test-retention-active-evidence.mjs` bestand mit synthetischen akzeptierten und abgewiesenen Evidenzen. Das beweist die Validatoren, nicht einen tatsächlich aktivierten Cloud-Zustand.

Der ältere `check-retention-config.mjs` ist nicht Teil des aktuellen `check:retention-p0`-Aufrufs. Er erwartet eine überholte Shell-Schleifenform und einen historischen Foto-Löschpfad. Sein Fehler wird weder durch eine neue Baseline ignoriert noch als behobene Laufzeitlücke ausgegeben. Vor Bereinigung ist die Foto-Retention-Anforderung gegen aktuellen Writer, Scheduler und dokumentierte Frist zu prüfen. Diese Prüfung bleibt offen.

## Nächste Freigabeschritte

1. Vollständige Pflicht-CI zum exakten Änderungs-Commit und reguläre Review-/Integrationsentscheidung.
2. Offene Retention-Policy-Abweichung und weitere protokoll-/routenspezifische Security-Nachweise bearbeiten; keine globale Entwarnung aus einzelnen grünen Tests.
3. Nach Festlegung einer isolierten Staging-Umgebung reale Retention-, Lösch-, Last- und Rollback-Nachweise erheben.
4. Unabhängige Security-/Datenschutz-/Finance-Abnahmen und geschützte Produktionsentscheidung zum exakten Release-Commit einholen. Bis dahin **NO-GO**.

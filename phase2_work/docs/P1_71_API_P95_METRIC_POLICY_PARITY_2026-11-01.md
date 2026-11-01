# P1 #71 — API-P95: beobachtbare Metrik und SLO-Policy eindeutig verknüpfen

**Datum:** 2026-11-01 · **Status:** isolierter DRAFT, exakte neue CI ausstehend · **Produktionsfreigabe:** BLOCKED / NO-GO

## Verifizierter Quellbefund

Der Server berechnet die P95-Breach-Schwelle bereits aus der kanonischen `ops/slo.json`: `API_P95_SLO_MS` wird zur Laufzeit geladen, validiert und mittels `p95 > API_P95_SLO_MS` verglichen. Die Schwelle ist **300 ms**; der aktuelle Regressionstest prüft 299/300/301 ms und verhindert den alten 1.500-ms-Hardcode. **Aber:** `ops/slo.json` bezeichnete den SLI weiterhin mit `p95(klar_http_latency_ms)` – diese Metrik wird im Server gar nicht veröffentlicht. Tatsächlich liefert `observabilityPrometheus()` `klar_http_request_duration_ms{quantile="0.95"}` als Gauge. Damit waren SLI-Dokumentation und beobachtbare Metrik nicht konsistent.

Das ist eine **nachgewiesene Repository-Metrikreferenz-Lücke**, kein Nachweis eines ausgefallenen realen Alerts, einer tatsächlichen Produktionslatenz oder eines verbindlich freigegebenen 30-Tage-Monitoring-Fensters.

## Atomare Korrektur

- Der bestehende SLO-Eintrag `api-latency-p95-ms` verweist jetzt auf **`klar_http_request_duration_ms{quantile="0.95"}`**, exakt wie der Prometheus-Exporter.
- Die Schwelle **300 ms** und das bestehende Verhalten `p95 > target` bleiben unverändert.
- Der schon verpflichtende `scripts/test-slo-policy.mjs` prüft zusätzlich, dass die konfigurierte Zeitreihe exakt der im Quellcode emittierten Metrik samt Quantil-Label und Gauge-Typ entspricht. Entfernte/umbenannte Metriken und Rückfall auf `klar_http_latency_ms` werden fail-closed erkannt. Bestehende 299/300/301-ms-Grenztests bleiben erhalten.
- Keine Änderung an Cloud-Ressourcen, Prometheus-Abfrage/Alarming im Live-System, Tempo-Backend, Firebase-/GCS-Regeln, IAM, Kundendaten, SLO-Grenzwert oder Rollout.

## Noch offene SRE-Abnahme / wichtige Messgrenzen

Der Server erzeugt ein **In-Process-Gauge über aggregierte jüngere Requests** (derzeit ungefähr 15 Minuten), **kein** dauerhaftes Request-Histogramm. `ops/slo.json` enthält zugleich ein `windowDays: 30` für die Zielbewertung. Eine Gauge einer einzelnen Laufzeitinstanz darf nicht ohne Aggregationskonzept als mandanten-, instanzen- oder regionenübergreifendes 30-Tage-P95 behandelt werden.

- [ ] SRE/Product definieren einen genehmigten SLI: Route-/Status-Ausschlüsse, gewichtete Instanz- und Regionsaggregation, 30-Tage-Fenster, Histogrambuckets und wissenschaftlich korrektes Quantil.
- [ ] Dashboards und Prometheus-/Alertmanager-Regeln werden im echten Staging nachgewiesen; korrekte API-Berechtigungen, Metrik-Persistenz, Low-Traffic-/Cold-Start-Verhalten sowie Burn-Rate und Pager werden geprüft.
- [ ] Neuer Entwicklungs-Commit besteht die vollständige exakte CI einschließlich `check:observability`, SLO-Paritätstests, Typecheck, Emulatoren, Builds, Production Smoke und Browser.
- [ ] Issue #71 erst nach signiertem SRE-Nachweis und genehmigter Zielmessung schließen. Der Quellfix allein ist keine produktive SLO-Zertifizierung.

**P0 #202 und #254 sowie die sechs Live-GO-Nachweise bleiben OPEN und BLOCKED. `productionApproved=false`. Keine Änderung an `main`, kein Merge, kein Deployment und kein Zugriff auf produktive Daten.**

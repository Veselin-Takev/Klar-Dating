# Vercel-Einrichtung: Evidenz und Release-Grenzen (2026-11-02)

> Status: **BLOCKED / NO-GO** für eine offizielle Produktionsfreigabe. Diese Notiz belegt ausschließlich die beobachtete Vercel-Konfiguration und keine abgeschlossene End-to-End-Abnahme.

## Beobachteter Ist-Zustand

| Kontrollpunkt | Evidenz am 2026-11-02 | Bewertung |
| --- | --- | --- |
| Vercel-Konto/Scope | Zugriff auf Team `ves3` nach separater Teamautorisierung bestätigt | E4: Vercel-API-Leserechte |
| Projekt | `klar-dating`, ID `prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`, Framework `vite` | Projekt bereits vorhanden; kein zweites Projekt angelegt |
| Git-Quelle | Buildprotokoll klont `Veselin-Takev/Klar-Dating`, `main`, SHA `96c3857c53f5ced31fe1394895185f42c75bc716` | Git-Import nachgewiesen; `main` wurde separat via GitHub Branch-API auf dieselbe SHA geprüft |
| Deployment | `dpl_ATWswvF6oCqGw3eRcQfSFAXqmMX3`, `READY`, `target=production`, Region `iad1`; Projekt-API meldet zugleich `live=false` | **Bereits vor diesem Dokumentations-PR vorhanden**. `READY` ist nur ein erfolgreicher Build, weder eine geprüfte API noch eine offizielle GO-Entscheidung. Externen Erreichbarkeitsstatus nicht behaupten |
| Domain | `klar-dating.vercel.app` als Vercel-Projektdomain gelistet | Kein Nachweis eines geprüften öffentlichen Betriebs |
| Schutz | Vercel-API: SSO-Schutz aktiviert, Modus `all_except_custom_domains`; Git-Fork-Schutz wurde über die Projekt-API auf `true` gesetzt | Weitere Schutz-/Zugriffs- und Fork-PR-Tests fehlen; die Ausnahme für Custom Domains vor späterer Erweiterung erneut prüfen |
| Secrets/Config | Vercel-Projektumgebungsvariablen: `0` Einträge, `hiddenProductionEnvCount=0` (nur Namen/Anzahl abgefragt, keine Secret-Werte) | Backend- und externe Integrationsfähigkeit **nicht** nachgewiesen |
| Node-Version | Vercel-Projekt meldet `26.x`; Build warnt wegen `package.json` `engines.node >=22.23.3` vor automatischen Major-Upgrades | Vor Freigabe mit Cloud-Run-/Node-22-Laufzeitstrategie abgleichen und in `package.json` auf freigegebene Major-Version begrenzen |
| Build | Vite-Assets und `dist/server.cjs` wurden erstellt; Vercel-Build endet erfolgreich | **Kein** Nachweis, dass der Express-Server als Vercel Function/Service geroutet und betriebsfähig ist |

Evidenzquellen: [Vercel-Deployment-Inspektor](https://vercel.com/ves3/klar-dating/ATWswvF6oCqGw3eRcQfSFAXqmMX3), [GitHub-Commit](https://github.com/Veselin-Takev/Klar-Dating/commit/96c3857c53f5ced31fe1394895185f42c75bc716), `phase2_work/README.md`, `phase2_work/package.json`, `phase2_work/server.ts`, `phase2_work/.env.example`.

## Architektur- und Sicherheitsgrenzen

Das Repository beschreibt **Vite/React-Frontend + Express-API mit Firebase Admin** sowie eine **Node-22-Cloud-Run-Container-Laufzeit**. Ein erfolgreicher Vercel-Vite-Build beweist nicht die Funktion des Express-Backends, der Authentisierung, Webhooks, KYC, Storage-Löschketten oder Scheduler. Im geprüften `main` wurde kein `phase2_work/vercel.json` gefunden. Ohne nachweislich konfigurierte API-Routen und isolierte Test-Integrationen ist die Anwendung nicht als funktionsfähiges Ende-zu-Ende-Preview abzunehmen.

Das Deployment meldet `iad1`. Vor Einsatz echter personenbezogener Daten sind Verarbeitung, Übermittlungen, Unterauftragsverarbeiter, Datenresidenz und Vertragslage durch DPO/Legal zu prüfen. Kein Live-Firebase-, Stripe-, KYC- oder KI-Secret in eine unfreigegebene Preview übernehmen.

## Nächste prüfbare Freigabeschritte

1. **Platform/SRE:** Frontend-only-Vercel-Preview vs. explizite API-Integration (Cloud Run mit überprüfter Routing-/Auth-/CSP-Strategie oder Vercel Functions/Services) entscheiden und dokumentieren. Die bestehende Cloud-Run-Produktionspipeline nicht stillschweigend ersetzen.
2. **Platform/Security:** Node-Major in Repo und Vercel konsistent pinnen; Fork-/Preview-/Domain-Zugriff und Schutzmaßnahmen mit Negativtests belegen; Vercel-Deployment-Checks und GitHub-Review-Gates an exakte Commit-SHA koppeln.
3. **Security/DPO:** Nur isolierte Staging-Daten und minimale, getrennte Preview-Konfiguration über geschützte Secret-Verwaltung bereitstellen; Datenfluss/Region und Dienstleister rechtlich prüfen.
4. **QA/SRE:** Geschützten Preview-Build, API-/Auth-/Webhook-Negativtests, Browser-Smoke, Observability und Rollback-Übung auf exakter SHA belegen. `READY` allein genügt nicht.
5. **Release Owner + unabhängige Security/DPO/Legal/SRE:** Formale Freigabe auf dem integrierten Release-SHA mit nachgewiesenen P0/P1-Exit-Kriterien. Bis dahin `productionApproved=false`, **NO-GO**.

**Änderungsgrenze dieser Dokumentation:** Keine neue Vercel-Deployment-Erstellung, keine Promotion, keine Domain-, IAM-, Cloud-Run-, Firebase- oder Secret-Mutation. Der bereits existierende Vercel-Production-Build wurde nur ausgelesen. Einzig die projektseitige Git-Fork-Schutz-Einstellung wurde im Rahmen der Einrichtung auf `true` gesetzt. Diese Dokumentation wird als Draft-PR zur unabhängigen Prüfung vorgeschlagen; sie ersetzt nicht das laufende Audit-/Evidenzregister.

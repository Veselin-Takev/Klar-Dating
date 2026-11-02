# P0 #202 — Read-only retention census: mixed Google project identity fail-closed

**Datum:** 2026-11-02 · **Status:** isolierter Draft, exakte CI ausstehend  
**Basis:** [Draft #300](https://github.com/Veselin-Takev/Klar-Dating/pull/300) `8037801d8abd51ed6bcc152ad230106f8cefba73`, full [CI #41413739405](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41413739405) SUCCESS.

## Nachgewiesener Sicherheitsbefund

Das bestehende **read-only**, ausschließlich für lokale Firebase-Emulatoren gedachte Script `scripts/audit-verification-retention-backlog.mjs` wählte seine Firestore-Projekt-ID bislang mittels `process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT`. Bei gleichzeitig gesetztem `GCLOUD_PROJECT=demo-klar` und `GOOGLE_CLOUD_PROJECT=real-customer-prod` wurde der widersprüchliche produktive Hinweis unbeachtet gelassen. Die ebenfalls bestehende Loopback-Emulatorpflicht verhindert weiterhin realen Cloud-Zugriff im vorgesehenen Pfad; es liegt **kein Beleg eines tatsächlichen Produktionszugriffs oder Löschvorgangs** vor. Die Maskierung ist jedoch eine verifizierte Inkonsistenz im fail-closed Identitätsvertrag.

## Implementierte Abwehr

- Beide möglichen Projekt-Umgebungsvariablen werden **einzeln und vor sämtlichen Firebase-Imports** validiert.
- Wenn eine oder beide Variablen gesetzt sind, müssen alle gesetzten Werte exakt `demo-klar` sein; ein fehlender Wert ist nur bei gültigem anderen Wert erlaubt. Widersprüchliche oder alternative `demo-*`-IDs werden abgewiesen.
- Die bestehenden harten Bedingungen `--emulator-only`, Loopback-`FIRESTORE_EMULATOR_HOST` und keinerlei unerkannte CLI-Argumente bleiben aktiv. Der Firestore-Lesepfad ändert sich **nicht**; das Skript hat weiterhin keinerlei Firestore-Writes oder GCS-Zugriff.
- Das obligatorische `check:retention-census-safety`-Node-Testpaket prüft zusätzlich vier Negativfälle (jeweils beide Konfliktrichtungen, voneinander abweichende Demo-IDs und unzulässige Einzel-Demo-ID). Jeder Fall muss mit Exit-Code 2 und ohne Datenausgabe bereits vor dem SDK-Zugriff verweigert werden.

## Prüf- und Freigabegrenze

Die neue, exakte HEAD-SHA erfordert eigenen vollständigen Enterprise-CI-PASS: statischer Sicherheits- und Retention-Guard, `check:retention-census-safety`, 5 native Storage + 6 Tenant Firestore + 16 Retention Firestore Emulatorfälle, echte Abwesenheits-Negativprüfung für Emulatoren, ReleaseOwner- und sechs P0-Proof-Gates, Typecheck, Vitest, Builds, Smoke und 26 Browserfälle. Der Eltern-PASS gilt ausschließlich für dessen Commit.

**Nicht erledigt:** Echte produktive Löschung P0 #202 benötigt weiterhin autorisierte Entscheidungen und Legal Holds, generation-gebundene GCS-404/412-/Crash-Quittungen, dauerhafte >300-Queue, echte Scheduler-/IAM-Verifikation und unabhängige DPO/AppSec/SRE-Abnahme. P0 #254 benötigt Tenant-/Admin-SDK-/Storage-/Firestore-BOLA, Art.-17-Migration, freigegebene Profilmedien-Policy und unabhängige Security/Legal/ReleaseOwner-Freigaben.

`productionApproved=false`. **Production BLOCKED / NO-GO.** Keine Änderungen an `main`, kein Merge, Deployment, Cloud- oder Kunden-Datenzugriff.

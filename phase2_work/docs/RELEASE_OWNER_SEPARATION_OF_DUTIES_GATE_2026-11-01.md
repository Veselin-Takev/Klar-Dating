# Enterprise Release Governance — ReleaseOwner-Attestierung und Vier-Augen-Prinzip

**Datum:** 2026-11-01 · **Scope:** unabhängige, ausschließlich strukturelle Release-Freigabeprüfung.  
**Status:** ungemergter isolierter Draft / **Production BLOCKED–NO-GO**  
**Basis:** `main` SHA `2808dc1cbb485f70b403681c108cea5a3361d950`.  
**Verknüpft:** [Go-Live #8](https://github.com/Veselin-Takev/Klar-Dating/issues/8), [P0 #202](https://github.com/Veselin-Takev/Klar-Dating/issues/202), [P0 #254](https://github.com/Veselin-Takev/Klar-Dating/issues/254).

## 1. Nachgewiesene Release-Gate-Lücke

`scripts/release-go-evidence.mjs::collectReleaseApprovalFailures` forderte bisher strukturierte Commit-gebundene Signaturen ausschließlich für **Security, DPO, Legal und SRE**. Das gesonderte Freigabemandat des **Release Owner** (letztverantwortliche Veröffentlichung), wie es die Enterprise-Governance- und Go-Live-Anforderungen vorgeben, war nicht als mandatory Signoff erfasst. Ein formal korrektes **synthetisches** GO-Objekt ohne ReleaseOwner war daher im reinen Rollen-Teil des Strukturvalidators zulässig.

Die Strukturprüfung ist *keine* Authentisierung der Unterzeichner, keine Prüfung der referenzierten URLs auf echte Signaturen und keine Freigabe des aktuellen Projekts. Der geschützte GitHub-Release-Workflow und echte signierte Host-/Cloud-Nachweise bleiben separat verpflichtend. Keine tatsächliche Freigabe oder produktive Umgehung wird behauptet.

## 2. Minimaler Sicherheitsfix

- `mandatorySignoffRoles` ist die verbindliche, unveränderliche Rollenliste: `Security`, `DPO`, `Legal`, `SRE`, `ReleaseOwner`.
- Alle fünf müssen `approved:true`, die **exakte** `GITHUB_SHA`, einen nichtleeren Approver und den strukturell zulässigen Evidenz-Link vorweisen; fehlende, stale, falsch formatierte oder nicht bestätigte Attestierungen werden fail-closed abgewiesen.
- Der als `ReleaseOwner` auftretende Approver muss **von allen vier anderen Approvern verschieden** sein (Groß-/Kleinschreibung und Rand-Leerzeichen zählen nicht). Das verhindert jedenfalls offensichtliche Selbstfreigabe durch dieselbe Identitätszeichenfolge. Ob verschiedene Accountnamen dieselbe Person bezeichnen, ist unabhängig organisatorisch zu prüfen.
- Positive synthetische Strukturfixture aktualisiert; negative `node:test`-Fälle: fehlender Release Owner, falscher Commit, fehlender Nachweislink, fehlende Approval und Identitätswiederverwendung über **jede** der vier anderen Rollen.
- Es werden **keine** produktiven GCS/Firebase Rules, Workflows, IAM, Kundendaten, Secrets, Codeowners oder Deployments geändert. Das bisherige GO-Gate bleibt verbindlich unter `check:release-go-evidence` und `check:enterprise` eingebunden.

## 3. Abnahme und Nichtfreigabe

Vor einem technischen PASS muss die neue **exakte Branch-SHA** in vollständiger Enterprise-CI mit `node --test scripts/test-release-go-evidence.mjs`, Static-/Typecheck-/Functions-/Vitest-/Build-/Smoke-/Browser-Gates nachweislich grün sein; das ist keine Produktionsfreigabe. **Kein** PASS aus einer Eltern- oder anderen PR übernehmen.

Weitere **unverzichtbare** reale Release-Nachweise: eine unterschriebene Product/DPO/Legal-Sichtbarkeits-ADR für Gäste/Erwachsene/Tenants, tatsächlich ausgerollte Firestore-/Storage-/IAM-/Admin-SDK-Mandantentrennung, Legacy→Tenant Art.-17-Migration mit Rollback, P0 #202 GCS generation-fenced Löschung mit Legal Holds, 404/412-/Crash-Receipts, dauerhafte >300-Verarbeitung und genehmigte Scheduler-/Cloud-Artefakte; reale Security-, Datenschutz-, Legal-, SRE- und Release-Owner-Freigaben mit einer gegen den konkreten Release-Artefakt-Hash verifizierten Identität.

**Der Fix ist ausschließlich eine weitere defensive Kontrollschicht.** `productionApproved=false`; `main` unverändert, P0 #202/#254 OPEN, **Production BLOCKED/NO-GO**. Keine automatischen Merges oder Cloud-Operationen.

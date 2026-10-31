# P0 #254 – Approver-Signatur an exakt signierte Inventarbytes gebunden

**Prüfdatum:** 31.10.2026 · **Änderungsart:** atomarer, gestapelter Draft-Sicherheitsfix · **Parent:** [PR #256](https://github.com/Veselin-Takev/Klar-Dating/pull/256), `0d13cd2d198f1b90d2c7b7eb50bbc49c01a79647` · **Parent-Enterprise-CI:** [41231738458](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41231738458), `completed/success`.

## Bedrohungsmodell und konkret geprüfte Schwachstelle

Das bis einschließlich Parent #256 implementierte Signaturprotokoll prüft zwei Ed25519-Signaturen **getrennt**: Exporter für Inventar und Approver für Mapping. Die Mapping-Signatur ist bisher nur über `mapping:v1\0 || rawMappingBytes` gebildet. Ein Akteur mit Zugriff auf den **Exporter-Privatschlüssel**, aber ohne Zugriff auf den Approver-Privatschlüssel, kann dieselben syntaktischen Datensätze anders serialisieren und das Inventar neu signieren; die Approver-Signatur über das unveränderte Mapping bleibt gültig. Solange UID, Snapshot und selbst deklarierte Source-Hashes gleich bleiben, wird das Inventar nicht an **die von der Approver-Seite tatsächlich geprüfte Originaldatei** gebunden. Besonders relevant bei zusätzlichen Lösch-/Hold-Metadaten, selbst wenn die aktuelle reine Mappingprüfung solche Zustände unabhängig blockiert.

## V2-Protokoll und Sicherheitsinvarianten

Der Approver signiert mit seiner eigenen Ed25519-Identität nun zwingend das genaue Byte-Transkript:

```text
UTF8("klar:tenant-migration:mapping:v2\\0")
|| SHA256(exact_inventory_file_bytes)  // 32 Bytes, binär
|| exact_mapping_file_bytes
```

Der Inventar-Exporter signiert weiterhin `UTF8("klar:tenant-migration:inventory:v1\\0") || exact_inventory_file_bytes`. Die beiden Public Keys stammen aus dem unabhängig gepinnten Keyring, bleiben verschieden und werden vor der Auswertung geprüft. Dies trennt die Rollen und verhindert die unbemerkte Inventarsubstitution mit wiederverwendeter Approver-Signatur. Die explizite Versionsänderung auf `mapping:v2` verweigert alte V1-Signaturen (nicht rückwärtskompatibel). Neue, fachlich autorisierte V2-Signaturen müssen von den tatsächlichen Approvern separat erstellt werden; **keine** Schlüsselerzeugung oder produktive Signatur im Repository.

## Negative und positive Verifikation

- Äquivalentes Inventar (nur andere JSON-Whitespace-Bytes), vom Exporter neu signiert, muss mit der ursprünglichen Mapping-Signatur **scheitern**.
- Vom Exporter neu signierter Export mit geändertem Legal-Hold-/Erasure-Zustand und alter Mapping-Signatur muss **scheitern**.
- Eine alte gültig von Approver signierte V1-Nachricht muss im V2-Validator **scheitern**.
- Bei **beiden** korrekt neu erstellten V2-Signaturen für ein inventarabhängiges Mapping müssen strukturell gültige Datensätze weiter mit `BLOCKED_MANUAL_APPROVAL_REQUIRED` zurückkehren; bei Legal Hold muss trotz beider Signaturen die fachliche Reconciliation weiter verweigern.
- Die bisherigen Prüfungen für fehlende Trust-Anchor-Pins, gleiche Rollenkeys, vertauschte Signaturen und manipulierte Dateien bleiben unverändert.

## Nicht durch diese Änderung freigegeben

Die Signatur beweist den Besitz zweier Schlüssel und die Zustimmung zur **Bytefolge** eines Mapping-/Inventarpaars – nicht den rechtlichen Eigentümer der Firestore-Daten, die Richtigkeit eingebetteter Datensatz-SHA-Werte, signierte Source-Origin-Provenienz, DPO-/SRE-/Finance-/Release-Freigaben oder Art.-17-Compliance. Die CLI bleibt strikt lokal und **`--dry-run`** ohne Firebase-Write oder Migrations-Executor. Ein erfolgreicher Check liefert niemals ein GO. Keine Änderungen an Firestore Security Rules, IAM, Live-Daten, `main`, Deployments oder bestehenden Drafts.

**Gate:** Exact-head Enterprise-CI des neuen PRs und unabhängige AppSec-/DPO-/SRE-Prüfung erforderlich. P0 #254 und das Production Readiness Gate bleiben **BLOCKED / NO-GO**.

## Signierte JSON-Manifeste: doppelte Schlüssel und Parser-Differenzen verboten (31.10.2026)

Nach [vollständigem CI-PASS #41232693749](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41232693749) des V2-Protokolls in [Draft #257](https://github.com/Veselin-Takev/Klar-Dating/pull/257) wurde die anschließende Parse-Grenze unabhängig geprüft. Der native JSON-Parser behält bei doppelten Keys den letzten Wert, obwohl die **signierten Originalbytes** mehrere unterschiedliche `tenantId`- oder `deletionState`-Werte enthalten können. Die neue isolierte Korrektur verlangt nach erfolgreicher Ed25519-Prüfung und vor der Zod-Reconciliation strikte UTF-8-Dekodierung und exakte Byte-Übereinstimmung mit `JSON.stringify(JSON.parse(original))`. Dasselbe deterministische Profil gilt für den SHA-gepinnten Keyring. Es ist **kein RFC-8785/JCS-Profil**; neu serialisierte Originaldateien brauchen beide gültigen Signaturen. [Bedrohungsmodell und Tests](SIGNED_MANIFEST_JSON_AMBIGUITY_2026-10-31.md).

Vollständig alte, dennoch gültig doppelt signierte Manifeste bleiben ohne separat geprüfte Snapshot-Freshness und fachliche Eigentumsfreigabe weiterhin ein Replay-Risiko. Kein Live-Cutover, kein Executor und kein Freigabestatus. Neuer exact-head-CI-PASS und unabhängige Prüfung erforderlich. **BLOCKED / NO-GO**.


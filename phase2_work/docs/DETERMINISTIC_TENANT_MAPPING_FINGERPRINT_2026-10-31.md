# P0 #254 – Deterministischer Mapping-Fingerprint und kein Default-Tenant

**Stand:** 31.10.2026 · **Status:** isolierter Draft / **BLOCKED / NO-GO**. **Elternstand:** [PR #262](https://github.com/Veselin-Takev/Klar-Dating/pull/262), Commit `a961f493f25efd6be568d9ec456799e685487423`, [CI #41238605066](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41238605066) `completed/success`.

## Nachgewiesener Befund

Der schreibfreie Legacy-Profil-Preflight `src/server/multitenant/tenantMigrationPreflight.ts` bildet seinen SHA-256-Fingerprint aus einem nach Quellpfad sortierten Mapping. Bisher wurde dafür `sourcePath.localeCompare(other.sourcePath, 'en')` verwendet. Obwohl die Quelle auf ASCII-Pfade beschränkt ist, kann eine sprachabhängige ICU-Kollation etwa Groß-/Kleinschreibung und Unterstrich anders gewichten als eine rohe, reproduzierbare Pfadordnung. Ein unabhängig gepinnter `reconciliationSha256`-Wert muss jedoch **auf allen Review-Hosts für dieselben Manifestdaten gleich** berechnet werden.

Der vorhandene Test `rejects absent or ambiguous mappings, including default-tenant guessing` weckte zusätzlich einen falschen Sicherheitsanspruch: Er schlug bei einem doppelt zugeordneten Quellpfad fehl, bewies aber **nicht**, dass eine ansonsten gültige eindeutige Zuordnung zum reservierten Tenant `default` abgelehnt würde. Der bisherige Tenant-ID-Regex erlaubte `default`.

## Korrektur und exakte Invarianten

- Für erlaubte ASCII-Quellpfade sortiert der Validator mit festen, sprach-/hostunabhängigen JS-Zeichencode-Vergleichen (`a.sourcePath < b.sourcePath ? -1 : a.sourcePath > b.sourcePath ? 1 : 0`). Diese Ordnung ist für die zulässigen ASCII-Zeichen definiert und benötigt kein ICU/Locale. Das Report-Format, die fachlichen Mapping-Felder und der SHA-256-Algorithmus bleiben unverändert.
- Der nur für die **Migration** verwendete Tenant-ID-Validator weist `default` ausdrücklich zurück (`migration_default_tenant_forbidden`). Die globale Tenant-Identitätsvalidierung wird nicht verändert; dies ist eine Fail-Closed-Anforderung des vereinbarten Legacy-Mapping-Verfahrens, kein neuer Tenant-Namensstandard für alle Produkte.
- Ein neuer Test verwendet die verschiedenen erlaubten ASCII-UIDs `A`, `_` und `a` bewusst in unsortierter Reihenfolge und berechnet den erwarteten Hash unabhängig aus der festen Reihenfolge `users/A`, `users/_`, `users/a`. Das Umdrehen von Inventar-/Mapping-Einträgen darf den Digest nicht verändern.
- Der korrigierte Default-Test weist `default` **ohne** fehlende oder doppelte Source-Records zurück. Bereits vorhandene Tests für Hash-/UID-/Snapshot-Konflikte, Löschvorgänge, Legal Holds, Signatur-, Freshness- und CLI-Gates bleiben unverändert verpflichtend.

## Migration und Evidence-Folgen

Durch die deterministische Sortierung können Fingerprints für bestimmte ältere Test- oder Review-Manifeste abweichen. Alte extern gepinnte Digests dürfen deshalb **nicht stillschweigend übernommen** werden. Ein berechtigter unabhängiger Reviewer muss die Quellzuordnung erneut nachvollziehen und einen neuen Pin im geschützten Kontrollkanal ausstellen; niemand darf ihn aus dem PR oder ungeprüften Manifest ableiten.

Das Mapping ist weiterhin ausschließlich `users/{uid}`-Profil-bezogen. Es gibt keine produktive Datenbewegung, keinen Executor, keine Migration von Chats/KYC/Payments, keine vollständigen Art.-17-/BOLA-/Firestore-Rules-Nachweise. Der Ausgabestatus bleibt **immer** `BLOCKED_MANUAL_APPROVAL_REQUIRED`, selbst wenn der Hash mit dem freigegebenen Pin übereinstimmt. Exakte CI des neuen Commits sowie unabhängige Security-/DPO-/SRE-/Release-Freigaben bleiben zwingend.

**Production: BLOCKED / NO-GO.**

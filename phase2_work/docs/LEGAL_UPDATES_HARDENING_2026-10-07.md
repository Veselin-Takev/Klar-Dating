# Rechtliche Updates – Enterprise Hardening v149

Datum: 2026-10-07

## Implementierung

- `legal_updates` ist eine backend-gesteuerte Firestore-Collection.
- Rechtliche Meldungen benötigen `id`, `version`, ISO-Publikationsdatum, i18n-Schlüssel, Kategorie und eine HTTPS-Quell-URL.
- Die API sortiert nach Veröffentlichungsdatum und Version und gibt nur validierte Datensätze aus.
- Nutzerbestätigungen liegen ausschließlich unter `users/{uid}/legal_acknowledgements/{updateId}`.
- Bestätigungen werden in einer Firestore-Transaktion gegen die zum Zeitpunkt der Bestätigung vorhandene Legal-Update-Version validiert und idempotent geschrieben.
- Firestore-Clients dürfen `legal_updates` weder lesen noch schreiben; Acknowledgements dürfen Clients nur lesen, niemals direkt schreiben.
- Das Frontend verwendet keine lokale Speicherung für rechtliche Bestätigungen.
- Das Modal verwendet native ARIA-Tab-Semantik (`tablist`, `tab`, `tabpanel`), roving `tabIndex`, Home/End/Arrow-Navigation, Fokusfalle und Escape-Schließen.
- DE/EN/ES/FR enthalten vollständige Legal-Updates-Kataloge.
- Quellen werden als HTTPS-Links mit `noopener noreferrer` geöffnet.
- Ein Update kann erst nach erfolgreicher serverseitiger Bestätigung aus „Neu“ in die Historie wechseln.

## Seed

Der initiale, backend-kontrollierte Datensatz wird mit `npm run seed:legal-updates` über Firebase Admin angelegt. Der Seed enthält keine Browser-Mocks und wird nicht aus dem Client ausgeführt.

## Verifikation

### PASS

- `node scripts/check-legal-updates.mjs`
- `node scripts/check-i18n.mjs`
- `node scripts/check-public-firestore-rules.mjs`
- `node scripts/check-secrets.mjs`
- `node scripts/check-consent-center.mjs`
- `node scripts/check-date-planner-boundary.mjs`
- `node scripts/check-date-prep-checklist-boundary.mjs`
- `node scripts/csp-direktiven.mjs server.ts`
- `node scripts/routen-inventar.mjs 45`
- `node scripts/check-namen.mjs src`
- `node scripts/check-beschriftung.mjs src 0`

### BLOCKED / nicht als PASS bestätigt

Die sechs geforderten Release-Gates wurden ausgeführt. Die Laufzeitumgebung enthält keine installierten Projektabhängigkeiten bzw. Firebase-/Playwright-Toolchain:

- `npm run check:enterprise`: erreicht die neuen Legal-Update-Gates und stoppt beim bestehenden `check:ki`, weil `typescript` fehlt.
- `npm run typecheck`: `@testing-library/jest-dom`, `vite/client` und `vitest/globals` fehlen.
- `npm run test:pure`: `vitest` fehlt.
- `npm run test:rules`: Firebase CLI fehlt.
- `npx --offline playwright test`: Playwright ist nicht im npm-Cache vorhanden.
- `npm run build`: `vite` fehlt.

Daher wird dieses Archiv nicht als produktionsfreigegebener Build bezeichnet. Ein vollständig ausgestatteter CI-Runner muss die sechs Gates erneut ausführen und grün bestätigen.

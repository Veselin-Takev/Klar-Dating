# Klar — UI/UX Merge & Release Checklist

## P0 — Baseline
- [ ] Freeze v146 Enterprise/security baseline.
- [ ] Confirm canonical Git commit/tag.
- [ ] Record source archives and SHA-256 values.
- [ ] Do not merge prototype business logic into server-authoritative domain services.

## P0 — Navigation
- [ ] Six canonical destinations: Entdecken, Gespräche, Coach, Rituale, Tipps, Profil.
- [ ] Same route semantics on mobile/desktop.
- [ ] Desktop horizontal nav is a presentation of the same IA, not a separate IA.
- [ ] `Das Klar-Prinzip` is secondary content, not a seventh product area.

## P0 — Manifest
- [ ] Full Manifest under `Tipps → Klar Prinzipien`.
- [ ] Condensed Manifest in onboarding.
- [ ] Public Manifest remains available where appropriate.
- [ ] No unsupported claims such as guaranteed outcomes or universal psychological effects.

## P0 — Data & privacy
- [ ] Replace unscoped `localStorage` account checklist authority.
- [ ] Add UID-scoped repository.
- [ ] Add IndexedDB offline outbox/cache.
- [ ] Transactionally reconcile writes.
- [ ] Clear user-local state on sign-out/account deletion where applicable.
- [ ] Verify Firestore rules for checklist documents.

## P0 — Demo/example safety
- [ ] Explicit `isExample`/equivalent provenance on all demo profiles.
- [ ] Example profiles excluded from production discovery and messaging.
- [ ] Static guard prevents unlabelled demo data from production paths.

## P1 — Responsive UX
- [ ] Mobile: one-column, bottom navigation.
- [ ] Tablet: same IA, measured breakpoint behavior.
- [ ] Desktop: wide shell with same routes and labels.
- [ ] No duplicate widgets solely to support a second IA.
- [ ] Validate 320/375/390/430/768/1024/1280/1440 px viewports.

## P1 — A11y
- [ ] WCAG 2.1 AA contrast evidence.
- [ ] Keyboard-only traversal.
- [ ] Focus-visible evidence.
- [ ] Screenreader landmarks and names.
- [ ] Bottom navigation touch target >= 44 CSS px.
- [ ] Tabs use WAI-ARIA semantics and roving tab behavior where appropriate.

## P1 — Failure/offline UX
- [ ] Offline banner.
- [ ] Last-sync timestamp.
- [ ] Reconnecting state.
- [ ] Sync success/failure state.
- [ ] Retry action.
- [ ] Quota unavailable state never fabricates a value.

## P0 — Test gates
- [ ] `node scripts/check-dependency-locks.mjs`
- [ ] `node scripts/check-ci-toolchain-pins.mjs`
- [ ] `node scripts/check-runtime-node-alignment.mjs`
- [ ] `node scripts/check-namen.mjs`
- [ ] `node scripts/check-beschriftung.mjs`
- [ ] `node scripts/check-i18n.mjs`
- [ ] `node scripts/check-secrets.mjs`
- [ ] `node scripts/check-auth-boundary.mjs`
- [ ] `node scripts/check-public-firestore-rules.mjs`
- [ ] `node scripts/check-user-storage-boundary.mjs`
- [ ] `node scripts/check-ai-pii-sanitizer.mjs`
- [ ] `node scripts/check-art17-deletion-audit.mjs`
- [ ] `npm run typecheck`
- [ ] `npm run test:pure`
- [ ] `npm run test:rules`
- [ ] `npm test`
- [ ] `npm run check:enterprise`
- [ ] `npx playwright test`
- [ ] `npm run build`
- [ ] `node scripts/check-bundle-budget.mjs`
- [ ] `node scripts/release-manifests.mjs check`
- [ ] container build/attestation checks
- [ ] production smoke test against controlled evidence environment

## P0 — Release
- [ ] Release identity generated from exact CI commit/tag.
- [ ] SBOM generated and linked to immutable image digest.
- [ ] OCI attestations verified.
- [ ] Production evidence window complete.
- [ ] Protected `KLAR_PRODUCTION_RELEASE_APPROVED=true` present.
- [ ] Candidate revision is at the required canary percentage.
- [ ] `scripts/promote-prod.sh` executed only after all gates pass.


## Implementation pass v149 — 2026-10-07

- `Tips.tsx`: `klar_checklist` aus `localStorage` entfernt. Date-prep state ist UID-gebunden, wird über `/api/checklists/date_prep` serverseitig validiert und unter `users/{uid}/checklists/date_prep` in Firestore autoritativ gespeichert. Offline-Änderungen liegen in der bestehenden UID-gescopten IndexedDB-Queue und werden beim Reconnect replayed.
- `Tips.tsx`: Primärnavigation auf vier Nutzer-Tabs konsolidiert: Klar Prinzipien, Checkliste, KI-Ideen, Date-Journal.
- `Layout.tsx`: dieselben sechs kanonischen Routen auf Desktop als obere Navigation und mobil als Bottom Navigation; kein Manifest-Route/Bereich.
- Klar-Manifest ist vollständig als `KlarManifest` unter `Tipps → Klar Prinzipien` integriert; Dashboard-Onboarding enthält eine kompakte Manifest-Fassung.
- Beispielprofile: `isExample`-Provenienzfeld ergänzt; serverseitige Empfehlung filtert Beispiele, Publishing verweigert Beispiele, Chat-Auslieferung verweigert Beispiele.
- Runtime auf Node 22.23.3 gepinnt (`.nvmrc`, `package.json`, GitHub Actions, GitLab CI). Es existiert im Stand kein Dockerfile; daher keine erfundene Docker-Konfiguration ergänzt.
- Neue Endpoint-Tests decken Checklisten-Defaults, Payload-Validierung und UID-Scoped Write ab.

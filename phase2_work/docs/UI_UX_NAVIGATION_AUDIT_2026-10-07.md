# Klar — UI/UX, Navigation & Domain Audit
## Mobile Enterprise vs. Desktop/Manifest Concept — 2026-10-07

## 1. Decision
The Enterprise mobile architecture is the production master. The desktop/manifest concept is the brand and information-architecture source for the Calm-Dating proposition, not a second navigation system.

**Target:** six mobile primary destinations remain stable: Entdecken, Gespräche, Coach, Rituale, Tipps, Profil. The full Klar Manifest is consolidated under **Tipps → Klar Prinzipien** and surfaced selectively in onboarding and the public brand/legal layer. Desktop uses a responsive wide shell with the same information architecture; it may expose secondary navigation horizontally but must not introduce different product concepts.

## 2. Verified current-state findings

### Stand A — `klar-–-echte-gespräche-statt-swipes`
- 28-file React/Vite concept.
- Desktop-first header with Tagesauswahl (8–12), Gespräche, Das Klar-Prinzip and verification action.
- `ManifestoSection` contains brand narrative, comparison against swipe apps, and five principles.
- Responsive CSS is present (`sm`, `md`) and the manifest is intentionally wide (`max-w-5xl`).
- Example profiles are hard-coded in `src/data/profiles.ts` and are therefore demo data, not a production profile source.
- Quota, conversations, verification and Ad/Plus behavior are local React state. This is a prototype, not authoritative business logic.

### Stand B/C — `Klar_05.10.2026` Enterprise mobile
- 778 files in the inspected archive.
- Bottom navigation has exactly six primary destinations: Entdecken, Gespräche, Coach, Rituale, Tipps, Profil.
- `Layout.tsx` provides system controls for quota, privacy shield, theme and language.
- Offline state is explicitly surfaced; last sync time is displayed.
- Legal updates are surfaced independently and legal documents are publicly routable under `/rechtstexte/:art`.
- `Tips.tsx` contains Klar Principles plus checklist, ideas, history/journal and additional tools.
- The date checklist in `Tips.tsx` persists to `localStorage` under `klar_checklist`.
- Offline chat messages use the separate UID-scoped IndexedDB offline queue. These two persistence models are not equivalent and must not be conflated.

## 3. UX synthesis

### Primary navigation
Do **not** merge the desktop four-item header into a seventh mobile tab. The six-tab mobile IA is the canonical product navigation. Desktop may render a horizontal representation of the same top-level destinations where viewport width permits.

Recommended desktop mapping:
- Entdecken → Tagesauswahl / Vorschläge
- Gespräche → Gespräche
- Coach → Coach
- Rituale → Rituale
- Tipps → Tipps / Klar Prinzipien
- Profil → Profil

`Das Klar-Prinzip` becomes a secondary brand/content destination, not a competing product root.

### Manifest placement
1. Public landing / unauthenticated web: full Manifest remains available as brand content.
2. Onboarding: condensed 4–5 principle narrative, max one screen per principle.
3. Authenticated mobile: `Tipps → Klar Prinzipien` contains the complete educational version.
4. Discovery: only short contextual principles are surfaced; never inject the full Manifest into the daily batch.

### Responsive behavior
- Mobile: single-column, bottom navigation, max-width shell.
- Tablet: same IA, wider content column; bottom navigation may remain until a measured breakpoint.
- Desktop: same IA, two/three-column content where useful, horizontal navigation and optional secondary rail.
- Route identity, labels and domain behavior must remain invariant across breakpoints.

## 4. Checklist persistence — binding rule

The current `Tips.tsx` implementation uses unscoped `localStorage` for `klar_checklist`. This is acceptable only for non-sensitive, device-local convenience state. It is **not** sufficient for an account-owned cross-device checklist.

Target classification:
- purely ephemeral UI state → React state
- device preference → localStorage, non-sensitive and non-account-authoritative
- account-owned checklist → Firestore document scoped by authenticated UID, with local IndexedDB outbox/cache for offline operation
- sensitive content → never rely on shared/unscoped localStorage as the authoritative store

Target flow:
`UI → local optimistic state → UID-scoped IndexedDB outbox → Firestore transaction/write → sync acknowledgement`.

No client-side checklist state may become an authoritative entitlement, quota, verification or compliance decision.

## 5. Offline and failure UX

Required states:
- online / synced
- offline / local changes queued
- reconnecting / synchronizing
- sync succeeded
- sync failed with retry affordance
- stale authoritative data
- authoritative endpoint unavailable

For quota specifically, the current `KontingentAnzeige` behavior is correct: show `Kontingent gerade nicht abrufbar` rather than inventing a value. This rule must remain universal for server-authoritative state.

## 6. Compliance & transparency

- Demo/example profiles must never be presented as real users.
- Any example profile in onboarding, tutorials or educational screens must carry an explicit example/demo label and must not enter production matching/chat flows.
- Public legal routes remain directly reachable without authentication.
- Profile/settings navigation must expose privacy, terms, cancellation and withdrawal flows without requiring a hidden modal path.
- §312k cancellation and §356a withdrawal wording/flows must remain legally reviewed; technical routing alone is not legal certification.

## 7. Target component model

```text
AppShell
├── SystemBar
│   ├── QuotaStatus
│   ├── PrivacyShield
│   ├── ThemeToggle
│   └── LanguageSwitcher
├── ResponsivePrimaryNav
│   ├── Discover
│   ├── Chats
│   ├── Coach
│   ├── Rituals
│   ├── Tips
│   └── Profile
├── RouteContent
└── Legal/Safety Layer
    ├── LegalUpdates
    ├── SafetyCenter
    └── PublicLegalRoutes
```

## 8. Merge order

1. Freeze v146 Enterprise domain/security baseline.
2. Import only approved A brand assets, copy and Manifest structure.
3. Normalize terminology to the Enterprise glossary: Vorschläge/Kontakte/Gespräche, not Swipe/Like/Match in user-facing product language.
4. Implement Manifest under Tips → Klar Prinzipien.
5. Add onboarding Manifest summary.
6. Implement responsive desktop shell using the same route/IA IDs as mobile.
7. Refactor checklist persistence into a UID-scoped repository with offline outbox.
8. Preserve server-authoritative quota and compliance decisions.
9. Add example-profile provenance markers and production-data guard.
10. Run static enterprise checks.
11. Run typecheck, pure tests, Firestore rules tests, full test suite and Playwright.
12. Run build/bundle/security/release-manifest/attestation checks.
13. Only after protected evidence exists, execute production promotion.

## 9. Acceptance criteria

- One canonical six-destination IA across mobile and desktop.
- Full Manifest reachable in mobile under Tips → Klar Prinzipien.
- Manifest summary present in onboarding without blocking core activation.
- No demo profile can enter production discovery/chat.
- Checklist state is UID-scoped and survives reload; offline changes reconcile deterministically.
- Quota never displays fabricated values.
- Offline and sync failures are visible and actionable.
- WCAG 2.1 AA keyboard/focus/screenreader/contrast evidence passes.
- Firestore rules tests pass.
- Vitest and Playwright critical-flow tests pass.
- Node runtime/toolchain matches the release baseline exactly; the current v146 gate baseline is Node 22.23.3 unless the repository's protected release metadata explicitly changes it.
- Production promotion remains fail-closed until all evidence and protected approval are present.

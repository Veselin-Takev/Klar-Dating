# Klar end-to-end audit

Audit date: 20 September 2026  
Repository: `veselin8606-source/Klar-App`  
Production baseline: `main`, merge `ee9059669a26a961beb996aa265af5454b41b51b`  
Accessibility candidate: PR 12, head `865d38c509046f4075016e7ab16c7eb56fb8a3da`

## Executive conclusion

Klar has a viable enterprise-oriented technical foundation. Authentication and authorization, Firestore rules, delivery controls, observability, recovery procedures, and accessibility patterns are materially stronger than the earlier baseline. The assessed candidate passed TypeScript, emulator-backed tests, production build, container build, Playwright, Axe, 320 CSS-pixel reflow, and keyboard-focus checks.

Recommendation: approve only a controlled pilot until the P1 findings are closed and independently evidenced. No P0 blocker was confirmed by the available automated checks. This is not a guarantee of complete defect freedom.

## Maturity assessment

| Dimension | Score | Conclusion |
|---|---:|---|
| Product and functionality | 3.7 / 5 | Core flows exist; AI-coach helpers are partly static; journey evidence is narrow |
| Quality and tests | 3.6 / 5 | Broad unit and rules coverage; only five browser tests in the assessed run |
| Security | 4.1 / 5 | Material authentication, authorization, and IDOR issues were closed; platform activation remains unproved |
| Operations and resilience | 3.7 / 5 | SLOs, health, canary, rollback, and runbooks exist; drills are not evidenced |
| Performance and TCO | 3.1 / 5 | Cost-aware scaling exists; no defensible load and unit-cost baseline |
| Compliance and privacy | 3.4 / 5 | Retention and deletion are addressed; durable consent evidence remains incomplete |
| Accessibility | 3.9 / 5 | PR 12 passes its automated scope; manual assistive-technology validation remains open |

A score of 5 means implemented, automatically controlled where practical, operationally exercised, and supported by durable evidence.

## Scope and method

The audit reviewed the merged enterprise hardening from PR 11 and the open accessibility candidate in PR 12. Evidence included source code, Firebase rules, runtime and deployment configuration, package scripts, CI workflows and results, Playwright results, SLO configuration, and operational runbooks.

The audit did not directly verify:

- live production IAM and secret-manager configuration;
- branch protection and production environment approvals;
- actual alert delivery and on-call response;
- cloud billing and production unit costs;
- backup schedules, retention lock, or completed restore evidence;
- legal contracts, vendor assessments, RoPA, or DPIA;
- manual sessions with NVDA, VoiceOver, speech input, or magnification.

Those items require external evidence before a broad production claim.

## Verified strengths

### Product and data model

- `UserMusicPreferences` is defined centrally and referenced by `UserProfile`.
- Onboarding captures interests and music preferences.
- Matching normalizes genres and uses symmetric set comparison.
- Music contributes 30% when both profiles provide music data.
- Missing music data does not create an artificial penalty.
- Music icebreakers use shared genres.
- Production-linked tests replace earlier placeholders.

### Security

- Protected routes authenticate before role checks.
- Email-based server authorization and document-ID substring authorization were removed.
- Firestore is default deny and validates the music-preference schema.
- Client writes are narrowly constrained and important server changes are transactional.
- IDOR, RBAC, unblock, guest-boundary, and route-authentication regression tests exist.
- Metrics require a dedicated bearer token.
- CI performs secret scanning and a production dependency audit.

### Runtime and operations

- Liveness and readiness are separate.
- Readiness returns 503 when dependencies are unavailable.
- Prometheus metrics, request IDs, structured logs, and W3C trace propagation exist.
- Graceful shutdown drains requests.
- SLOs and burn-rate alert thresholds are machine readable.
- Deterministic rollout buckets and kill switches reduce blast radius.
- Backup, restore, retention, release, rollback, and incident procedures exist.

### Delivery and supply chain

- CI gates TypeScript, tests, production build, and container build.
- Releases generate checksums, CycloneDX SBOM, build provenance, and an immutable container digest.
- Production deployment creates a no-traffic candidate revision.
- Canary traffic is limited to 10% before explicit promotion.
- A rollback path preserves the previous digest.
- Superseded branch and pull-request jobs are cancelled.

### Accessibility candidate

PR 12 adds:

- dialog and alert-dialog semantics;
- reusable focus trap, focus restoration, Escape handling, and body scroll lock;
- keyboard-operable legal-update tabs;
- semantic onboarding progress, headings, groups, labels, status, and errors;
- decorative icon and emoji isolation;
- minimum target-size protection;
- robust focus visibility including forced-colors mode;
- Axe A/AA, reflow, and keyboard-focus checks in the configured Playwright directory.

## Findings

| ID | Priority | Finding | Business effect |
|---|---|---|---|
| F01 | P1 | PR 12 is not merged to `main` | Accessibility hardening is absent from the released branch until merge |
| F02 | P1 | The assessed Playwright run contains only five tests | Critical journeys can regress while CI remains green |
| F03 | P1 | Platform controls are documented but not evidenced as active | Branch protection, approvals, alerts, TTL, or backup may be absent |
| F04 | P1 | No load, scaling, cold-start, or unit-cost report | SLO failure or cloud-cost surprise under real traffic |
| F05 | P1 | Legal-update acknowledgements are stored in browser local storage | No durable, cross-device, revision-safe acceptance record |
| F06 | P1 | Restore, rollback, and incident drills are not evidenced | RPO and RTO remain assumptions |
| F07 | P2 | The in-app notification expires after six seconds and uses a clickable `div` for details | Residual WCAG and usability risk |
| F08 | P2 | Some AI-coach helpers return static defaults | Feature promise and product value may diverge |
| F09 | P2 | Third-party Actions and base images are version-pinned rather than fully SHA/digest-pinned | Residual supply-chain and reproducibility risk |
| F10 | P2 | Dependency installation reported 15 development findings, including high and critical severities | Maintenance and CI exposure despite passing production audit |
| F11 | P2 | Enterprise static checks run primarily in release verification | Defects may be discovered after merge instead of during review |
| F12 | P2 | Playwright installs browsers not used by the single Chromium project | Avoidable runner time and cost |
| F13 | P2 | Accessibility is run explicitly and again inside the complete Playwright suite | Duplicate release work |
| F14 | P2 | Cloud Run uses `minScale: 0`, concurrency 80, and `maxScale: 10` without workload evidence | Cost and latency trade-off is unvalidated |
| F15 | P2 | Bundle and telemetry budgets are not enforced | Frontend and observability costs can grow silently |

## Feature and component assessment

| Domain | Status | Assessment | Required next evidence |
|---|---|---|---|
| Identity and access | Good baseline | Protected routes authenticate before authorization; guest boundary exists | Registration, session expiry, guest upgrade, and role-change E2E |
| Onboarding | Good in candidate | Interests and music are captured; semantics hardened in PR 12 | Persistence failure and resume E2E |
| Matching | Good | Symmetric Jaccard-based interests and music; bounded score | Property tests, fairness analysis, distribution monitoring |
| AI coach | Partial | Music icebreaker uses shared genres; other helpers are static | Declare rule-based behavior or integrate a monitored service |
| Profile and discovery | Incompletely evidenced | Routes and components exist | Search, filters, profile, block, and report E2E |
| Chat and messaging | Incompletely evidenced | Routes and SLO targets exist | Delivery, retry, order, idempotency, moderation, and load tests |
| Legal and consent | Risk | Legal text exists; acknowledgment is browser-local | Server-side immutable evidence with export and withdrawal |
| Error and offline | Good in candidate | Health checks, offline status, and accessible alert dialog | Dependency failure, retry, and recovery scenarios |
| Internationalization | Partial | i18next and language switcher exist | Key completeness, layout, and screen-reader tests per language |
| Theme and privacy UI | Present | Global theme and privacy controls | Contrast, persistence, and all-screen interaction checks |

## Quality and test strategy

### Proven signals

| Control | Result | Evidence |
|---|---|---|
| Secret scan and production dependency audit | Passed | [Enterprise CI](https://github.com/veselin8606-source/Klar-App/actions/runs/35532326784) |
| TypeScript | Passed | Enterprise CI |
| API, unit, integration, and Firebase Rules tests | Passed | Enterprise CI and PR 11 |
| Production build and container | Passed | Enterprise CI |
| Browser and Axe | 5 of 5 passed | [Playwright](https://github.com/veselin8606-source/Klar-App/actions/runs/35532326777) |
| PR mergeability | Mergeable at audit time | PR 12 |

### Required target matrix

| Layer | Purpose | Required coverage |
|---|---|---|
| Pure unit | Fast boundary coverage | Matching properties, normalization, flags, validation, retention timestamps |
| Components | Isolated interaction behavior | Dialog focus, form errors, timers, live regions, translation |
| API and Rules | Authorization proof | IDOR, RBAC, guest, rate limit, replay, webhook, deletion |
| Chromium E2E | Every critical journey | Happy path, failure, offline, resume, and rollback behavior |
| Safari and Firefox | Risk-based compatibility | Login, forms, chat, focus, storage, downloads |
| Non-functional | SLO and protection boundaries | Step load, spike, soak, chaos, dependency failure, unit cost |

Critical journeys are identity, guest upgrade, onboarding, music, discovery, matching, chat, safety/reporting, legal consent, export, deletion, verification, payment where enabled, offline operation, and dependency failure.

## Security and supply chain

### Positive controls

- Default-deny rules and server-centered transactions reduce manipulation.
- IDOR, RBAC, route authentication, and music validation have regression coverage.
- Runtime health does not expose internal state.
- The production container runs as the unprivileged `node` user.
- Release artifacts include SBOM, checksums, provenance, and immutable digest.
- Canary, rollback, and kill switches reduce blast radius.

### Required improvements

| Risk | Action | Acceptance criterion |
|---|---|---|
| Major-tag GitHub Actions | Pin external actions to full commit SHAs and use controlled update PRs | Every external `uses` entry is SHA-pinned |
| Version-only base image | Pin Node Alpine by digest and rebuild on a defined patch cadence | Reproducible image input and documented update policy |
| Development dependency findings | Triage and update transitive causes | No unaccepted critical/high finding; exceptions have owner and expiry |
| Public Cloud Run ingress | Route through controlled load balancer, WAF, and rate limits | Origin cannot be reached directly; attack simulation passes |
| External vendors | Define egress, timeout, circuit breaker, minimization, and vendor controls | Data-flow diagram, DPA, and failure tests |
| Logs and Sentry | Configure PII scrubbing and sampling | Test event arrives without raw personal data |

A focused independent penetration test should cover identity, authorization, API abuse, storage, webhooks, admin routes, privacy export, and account deletion before public launch.

## Performance scaling and TCO

Cloud Run currently uses zero minimum instances, ten maximum instances, one CPU, 512 MiB, and concurrency 80. This limits idle cost but may create cold starts and is not automatically compatible with the 300 ms API P95 objective.

### Highest-value TCO actions

| Action | Expected value | Risk |
|---|---|---|
| Install only Chromium in the Chromium-only workflow | Lower CI duration and runner cost | Low |
| Remove duplicate accessibility execution | Lower release duration | Low |
| Run enterprise checks before merge | Earlier and cheaper defect detection | Low |
| Tune minimum instances from measured traffic | Better cost/latency balance | Medium |
| Validate concurrency and maximum scale | Better resource utilization without overload | Medium |
| Enforce frontend bundle budget | Faster start and less transfer | Low |
| Apply privacy-safe telemetry sampling | Predictable observability cost | Medium |
| Prove TTL and deletion behavior | Lower storage and legal risk | Low |

### Measurement plan

1. Define core transactions: sign-in, discovery, match, message, AI call, verification, export, and deletion.
2. Record p50, p95, p99, error rate, CPU, memory, event-loop delay, Firestore operations, external calls, and variable cost.
3. Run cold-start, step-load, spike, soak, and dependency-failure tests.
4. Verify backpressure and every provider quota.
5. Configure environment and service budgets with forecast and deviation alerts.
6. Adopt an optimization only when SLO, security, accessibility, and user value do not regress.

## Operations and resilience

| Capability | Implemented | Missing evidence | Release criterion |
|---|---|---|---|
| Liveness and readiness | Separate endpoints; readiness can return 503 | Production probe | Synthetic check and tested alert |
| Observability | Metrics, request IDs, trace context, structured logs | Dashboard and paging | Dashboard, routing, and test alert |
| SLO | Availability, latency, burn rate | Query and ownership | Verified SLI, error budget, owner |
| Deployment | Immutable digest, canary, promotion, rollback | Real drill | Canary and rollback record |
| Backup | Guarded export script | Schedule, retention lock, success alert | Automated job and usable artifact |
| Restore | Isolated documented process | Completed drill | Quarterly checksum-verified drill with RPO/RTO |
| Incident | Severity and roles | On-call and exercise | Game day, contact chain, closed actions |
| Feature flags | Deterministic buckets and kill switch | Audit and expiry | Owner, expiry, change log, removal policy |

## Privacy compliance and accessibility

### Privacy

Technical retention, deletion, and restore controls are present. A production dating service also requires externally approved evidence for:

- record of processing activities;
- data protection impact assessment;
- data-flow and recipient inventory;
- processor agreements;
- lawful bases and consent model;
- data-subject access, export, correction, objection, and deletion;
- retention periods and legal-hold handling.

Legal-update acceptance must not rely only on local storage. Store an immutable server record containing user ID, document type, exact version or hash, decision, timestamp, presentation surface, and withdrawal relationship.

### Accessibility

| Control | Status | Remaining work |
|---|---|---|
| Dialog and focus management | Implemented in PR 12 | NVDA and VoiceOver |
| Keyboard and focus appearance | Automated check passed | Authenticated journeys |
| Reflow at 320 CSS pixels | Automated check passed | Complex chat, profile, and legal states |
| Axe A/AA | Entry page passed | Route and state matrix |
| Notification | Open finding | Controllable timer and semantic detail button |
| Manual conformance | Open | Keyboard, AT, 200/400% zoom, forced colors, speech input |
| Formal conformance statement | Not supported yet | Independent production audit |

A green Axe result is necessary evidence, not a WCAG conformance certification.

## Prioritized remediation portfolio

| Order | Priority | Action | Indicative effort | Acceptance |
|---:|---|---|---:|---|
| 1 | P1 | Review, merge, and deploy PR 12 | 1–2 person-days | Green merge-commit checks and manual focus verification |
| 2 | P1 | Build critical E2E matrix | 8–15 person-days | Every critical journey and failure path passes |
| 3 | P1 | Activate and evidence platform controls | 3–6 person-days | Protection, approvals, IAM, alerts, TTL, and backup evidence |
| 4 | P1 | Establish load, scale, and cost baseline | 5–10 person-days | Report includes cost per core transaction |
| 5 | P1 | Implement durable consent evidence | 5–10 person-days | Server record, export, withdrawal, and tests |
| 6 | P1 | Complete restore, rollback, and incident drills | 3–5 person-days | Measured RPO/RTO and closed actions |
| 7 | P2 | Fix notification accessibility | 1–2 person-days | Keyboard, timer, and screen-reader tests |
| 8 | P2 | Clarify AI-coach product contract | 2–5 person-days | Quality metric, fallback, and cost budget |
| 9 | P2 | Complete supply-chain pinning | 2–4 person-days | Actions and images pinned to SHA/digest |
| 10 | P2 | Reduce CI duplication and shift gates left | 2–4 person-days | Chromium-only install; no duplicate suite |
| 11 | P2 | Remediate development dependency findings | 3–6 person-days | No unexplained critical/high finding |
| 12 | P2 | Add bundle and telemetry budgets | 3–5 person-days | Enforced in CI and monthly review |

Effort ranges are planning estimates, not commitments.

## 30-60-90-day plan

### First 30 days

- Merge and release the accessibility candidate.
- Automate P1 critical journeys.
- Activate branch and production controls.
- Define the durable consent design.
- Test alert delivery.
- Produce the first load and cost baseline.

### Days 31 to 60

- Complete restore, rollback, and incident drills.
- Implement server-side consent evidence.
- Add risk-based Safari and Firefox coverage.
- Pin supply-chain inputs.
- Triage development dependency findings.

### Days 61 to 90

- Tune Cloud Run from measured traffic.
- Enforce bundle and telemetry budgets.
- Measure AI-coach quality and unit cost.
- Complete independent security and accessibility assessments.

## Broad-production acceptance criteria

- Every P1 finding is closed or has a named risk owner, short expiry, and effective compensation.
- PR 12 is merged and the merge commit passes CI, browser, Axe, build, and container gates.
- Critical E2E coverage includes identity, onboarding, matching, chat, safety, legal, export, deletion, and failure states.
- Production IAM, branch protection, approvals, secrets, TTL, backup, and alerting are evidenced.
- Load and soak tests meet SLOs within an approved cost budget.
- Restore, canary, rollback, and incident drills are complete.
- Consent and legal actions are durable, revision-safe, and exportable.
- The manual WCAG matrix is complete.
- Independent security and privacy reviews have no open blockers.

## Evidence

- [PR 11 enterprise hardening](https://github.com/veselin8606-source/Klar-App/pull/11)
- [PR 12 accessibility hardening](https://github.com/veselin8606-source/Klar-App/pull/12)
- [Enterprise CI run 35532326784](https://github.com/veselin8606-source/Klar-App/actions/runs/35532326784)
- [Playwright run 35532326777](https://github.com/veselin8606-source/Klar-App/actions/runs/35532326777)
- `ops/slo.json`
- [Production runbook](PRODUCTION_RUNBOOK.md)
- [Incident response](INCIDENT_RESPONSE.md)
- [Backup and restore](BACKUP_RESTORE.md)
- [Data retention](DATA_RETENTION.md)
- [Accessibility standard](ACCESSIBILITY.md)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA keyboard interface practice](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)

## Maintenance

This is a dated audit snapshot. Keep current readiness in [Project status](PROJECT_STATUS.md). Create a new dated audit after a material architecture, identity, navigation, data-processing, deployment, or design-system change.

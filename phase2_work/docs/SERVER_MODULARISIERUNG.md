# server.ts modularization

**Program:** [IMPROVEMENT_PROGRAM.md](IMPROVEMENT_PROGRAM.md) · Issue #27

## Status

| Step | State |
|------|--------|
| Phase 1a: `health` + `account` routers | **Merged** (PR #29) |
| Phase 1b: webhooks (raw body order) | In progress (`refactor/server-webhooks-routes`) |
| Phase 1c: chat / gate | Not started |
| Phase 1d: remaining routes | Not started |
| `server.ts` bootstrap-only | Not started |

## Phase 1a (done)

**Move-only.** Handlers for account/consent already lived in `datenschutz.ts` and `trustAndSafety.ts`.

- `src/server/routes/health.ts` — `/api/health`, `/api/ready`, `/api/metrics`, `/api/system-health`
- `src/server/routes/account.ts` — delete, alter, export, einwilligung, status

## Phase 1b (this change)

**Move-only.** Stripe webhook registration only.

- `src/server/routes/webhooks.ts`
  - `mountStripeRawBody(app)` — **must** run before `express.json()`
  - `createWebhooksRouter()` — `POST /api/webhooks/stripe` (mount at `/api/webhooks`)

Handler remains in `stripeService.ts` (`handleStripeWebhook`).

### Ordering (do not break)

```ts
mountStripeRawBody(app);           // path-scoped express.raw
app.use(express.json({ limit: '1mb' }));
// ...
app.use('/api/webhooks', createWebhooksRouter());
```

### Out of scope for 1b

- AdMob `/api/ads/callback` (501 stub) — leave in `server.ts` for now
- Checkout session routes

### Next

Phase 1c: chat / gate routers.

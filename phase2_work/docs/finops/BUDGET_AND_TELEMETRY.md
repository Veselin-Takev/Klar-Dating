# AI Budget & Telemetry — Phase 2

## 1. Cost model

The canonical unit is **cost per successful business task**, not cost per token alone.

```text
estimated cost = input tokens / 1,000,000 * input rate
               + output tokens / 1,000,000 * output rate

cost per successful task = total AI cost / successful business tasks
```

The checked-in model rates are planning defaults and must be reconciled with the current provider contract before financial forecasting or procurement decisions. Runtime code does not treat these planning rates as provider billing truth.

## 2. Budget hierarchy

```text
Enterprise budget
   └── Tenant budget
       └── Workflow budget
           └── Request token limit
```

Default planning controls are defined in `config/ai-budget.json`.

### Default thresholds

| Control | Threshold |
|---|---:|
| Soft monthly cap | 80% |
| Hard monthly cap | 100% |
| Default tenant request rate | 60/min |
| Default workflow request rate | 30/min |
| High-risk workflow request rate | 10/min |
| Max input tokens/request | 2,250 |
| Max output tokens/request | 750 |

## 3. Runtime behavior

`src/telemetry/costTracker.ts` records input/output tokens by tenant and workflow and calculates an estimate using configurable model rates.

`src/telemetry/budgetGuard.ts` enforces:

- `ALLOW` below 80%;
- `SOFT_CAP` at/above 80% and below 100%;
- `HARD_CAP` at/above 100%.

Hard-cap behavior is fail-closed: a request is rejected rather than allowed to create unbounded spend.

## 4. Alerting

| Signal | Action |
|---|---|
| 70% | FinOps visibility |
| 80% | Soft-cap alert + owner notification |
| 90% | Engineering/product investigation |
| 100% | Hard stop + incident/exception process |
| >100% observed | Security/FinOps incident; investigate bypass or delayed billing telemetry |

## 5. Required telemetry dimensions

- tenantId (pseudonymous where exported);
- workflowId;
- model;
- input token count;
- output token count;
- total token count where supplied;
- estimated cost;
- request result;
- human override / escalation;
- policy decision.

Raw prompts, secrets, access tokens and personal content are not telemetry dimensions.

## 6. Provider usage reconciliation

Application-side estimates are operational controls, not invoices. Monthly reconciliation must compare:

1. application token telemetry;
2. provider usage/billing export;
3. tenant/workflow allocation;
4. successful business task counts.

Material variance must create a FinOps investigation before the next budget cycle.

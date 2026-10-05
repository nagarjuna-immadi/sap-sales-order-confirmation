# Phase 2 · A1 Case Orchestrator

**Goal.** The deterministic core: case state machine, server-side business rules, role-based authorization, append-only audit log, case timeline and the OData V4 actions all apps will call. **No LLM in this phase or in A1, ever.**

**Duration.** 4–5 days.

**Depends on.** Phase 1.

**Blueprint.** §2.2 (lanes, worklist sort), §7 A1 (complete), §8.3 scenario 5.

---

## 1. Module structure

```
srv/orchestrator/
├── state-machine.js     # pure transition table + guard functions
├── rules.js             # business rules 1–8
├── orchestrator.js      # executeAction(): tx, lock, idempotency, audit, emit event
├── audit.js             # append-only writer (only module allowed to INSERT AuditLog)
├── ids.js               # FC-nnnn / CR-nnnn sequences
└── events.js            # in-process "status changed" event bus → A3, A4, A5 triggers
```

A1 is the **only** code path that updates `OrderFeasibilityCase.status` / `waitingForRole` and `CapacityRequest.status`. Agents call A1 functions (`openCase`, `attachRecommendation`); they never update these fields directly.

## 2. State machine

Implement the §7 A1 status table as data, not as scattered `if`s:

| From | To | Action | Role |
|---|---|---|---|
| `NEW` | `AUTO_CONFIRMED` | `autoConfirm` | system (A2) |
| `NEW` | `WITH_SUPPLY_PLANNING` | `routeToSupply` | system (A2) |
| `WITH_SUPPLY_PLANNING` | `SUPPLY_CONFIRMED` | `confirmFromStock` / `approveStockTransfer` / `approveReallocation` / `confirmDateToSales` | SupplyPlanner |
| `WITH_SUPPLY_PLANNING` | `WITH_PRODUCTION` | `requestProductionCheck` (creates CR) | SupplyPlanner |
| `WITH_SUPPLY_PLANNING` | `REJECTED` | `reject` (reason) | SupplyPlanner |
| `WITH_PRODUCTION` | `PRODUCTION_CONFIRMED` | `chooseOption` / `chooseOverrideOption` (reason) | ProductionPlanner |
| `WITH_PRODUCTION` | `PRODUCTION_REJECTED` | `rejectProduction` (reason) | ProductionPlanner |
| `PRODUCTION_CONFIRMED` | `SUPPLY_CONFIRMED` | `confirmDateToSales` | SupplyPlanner |
| `PRODUCTION_CONFIRMED` | `REJECTED` | `reject` (reason) | SupplyPlanner |
| `PRODUCTION_REJECTED` | `WITH_PRODUCTION` | `requestProductionCheck` (new CR) | SupplyPlanner |
| `PRODUCTION_REJECTED` | `REJECTED` | `reject` (reason) | SupplyPlanner |
| `SUPPLY_CONFIRMED` | `CONFIRMED_TO_CUSTOMER` | `confirmToCustomer` | Sales |
| `REJECTED` | `CLOSED` | `close` | Sales |

`waitingForRole` is derived from the target status (table in §7 A1). Final states: `AUTO_CONFIRMED`, `CONFIRMED_TO_CUSTOMER`, `CLOSED`.

Also handle the A2 lane change on an S/4 *Changed* event (delivery priority changed): not a status transition, but a field update by A1 with an audit row (§7 A2).

## 3. Business rules (server-side)

| # | Rule | Implementation |
|---|---|---|
| 1 | Only `waitingForRole` can act | Guard in `executeAction` using `req.user.is(role)` |
| 2 | Confirm to customer only in `SUPPLY_CONFIRMED` | Transition table |
| 3 | Confirm date to Sales after production check only if active CR is `PRODUCTION_CONFIRMED` | Guard on `confirmDateToSales` |
| 4 | Reject and frozen-horizon override need a reason; confirm has optional comment | Input validation → 400 with message key |
| 5 | No CR without parent | `parentCase` not null in CDS + guard |
| 6 | Audit row in the same transaction; no audit, no status change | `audit.write()` inside the same `cds.tx`; failure rolls back |
| 7 | Optimistic locking + idempotency key | `@odata.etag` on `version`; `IdempotencyKey` table checked first, returns the stored result on replay |
| 8 | Read access uses the same role checks; assistant has no action path | `@restrict` on entities; shared `canRead(user, case)` used by Phase 8 tools |

**Refused actions** (scenario 5): when a rule fails, the action is rejected **and** an `AuditLog` row with `outcome = REFUSED` is written in its own transaction, so the timeline shows "Confirm to customer refused (status WITH_PRODUCTION)". The case itself does not change.

## 4. Service layer (`srv/case-service.cds`)

One OData V4 service per role-facing app (keeps annotations clean), all delegating to `orchestrator.executeAction()`:

- `SalesService` → bound actions on `Cases`: `confirmToCustomer(comment, draftText)`, `close(comment)`, `checkFeasibility()` (calls A2, Phase 5).
- `SupplyPlanningService` → `confirmFromStock`, `approveStockTransfer`, `approveReallocation`, `requestProductionCheck`, `reject(reason)`, `confirmDateToSales(comment)`.
- `ProductionService` → bound on `CapacityRequests`: `chooseOption(optionId, comment)`, `chooseOverrideOption(optionId, reason)`, `rejectProduction(reason)`.

Every action takes an optional `idempotencyKey` and requires the ETag (`If-Match`).

**Worklist sort** (§2.2): a calculated `laneRank` (HIGH=1, MEDIUM=2, NORMAL=3) so lists sort by `laneRank`, then `requestedDate`.

## 5. Audit log and case timeline

- `AuditLog` is append-only: `@readonly` on all services; `before('UPDATE'|'DELETE', AuditLog)` handler rejects; only `audit.js` inserts.
- `CaseTimeline` view: audit rows per case **including all child CRs**, ordered by timestamp, with `durationSincePrevious` and a mapped `step` label (*Intake → Supply check → Production check → Supply decision → Customer confirmation*).
- Expose `CaseTimeline` read-only in all three case services and to the Order Assistant (`getCaseTimeline`, Phase 8).

## 6. Events out of A1

After commit, A1 emits `case.statusChanged {caseId, crId?, from, to, actor}` on the in-process bus. Subscribers (wired in later phases):
- A3 on `WITH_SUPPLY_PLANNING` and when a CR is answered (Phase 5).
- A4 on CR created (Phase 6).
- A5 on every change (Phase 6).

Subscribers run after the commit and must not block or fail the action (§5.2: the case flow never waits on the LLM).

## 7. Tests (from §7 A1)

- [ ] Every allowed transition succeeds with the right role.
- [ ] Every forbidden transition is refused (generate the matrix from the table).
- [ ] Wrong role per action → 403, refused row in audit.
- [ ] Reject without reason → 400; override without reason → 400.
- [ ] Confirm to customer in every non-`SUPPLY_CONFIRMED` status → refused (scenario 5).
- [ ] CR without parent → error.
- [ ] Concurrent update with stale ETag → 412.
- [ ] Same idempotency key twice → one status change, same response.
- [ ] Exactly one audit row per status change; audit insert failure rolls back the status change.
- [ ] UPDATE/DELETE on `AuditLog` → refused.
- [ ] `canRead` returns only cases the role may see.

## Checklist (rules)

- [ ] No LLM import anywhere under `srv/orchestrator/`.
- [ ] No other module writes `status`, `waitingForRole` or `AuditLog` (add a grep test).
- [ ] Reject and override reasons mandatory.

## Exit criteria

- [ ] All tests above green.
- [ ] Scenario 1 status path can be walked through with `curl`/`.http` files using the three mock users (recommendations still empty).
- [ ] Timeline view shows the walked path with durations.

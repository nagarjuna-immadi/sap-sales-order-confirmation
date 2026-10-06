# Phase 1: Core model and A1 Case Orchestrator

[← Development plan](README.md) · Previous: [Phase 0](phase-0-setup.md) · Next: [Phase 2](phase-2-tools-agent-logic.md)

**Goal:** the local case model, the case rules enforced on every action, the audit log and timeline, and the three case services. A1 is deterministic and has **no LLM**.

## 1.1 Domain model: `db/schema.cds`

- [x] Entities as in §7 A1 and §6.2, namespace `order.conf`:
  - `OrderFeasibilityCase`: `caseId` (FC-nnnn), `salesOrder`, `item`, `customer`, `material`, `plant`, `quantity`, `requestedDate`, `deliveryPriority`, `lane`, `penaltyRisk`, `penaltyAmount`, `penaltyRule`, `status`, `waitingForRole`, `summary`, `atpResult`, `confirmedDate`, `confirmedQty`, `customerDraft`, `version`. One case per sales order **item** (§7 A2).
  - `CapacityRequest`: `crId` (CR-nnnn), `parentCase` (**not null**, rule 5), `status`, `needByDate`, `quantity`, `options` (JSON), `chosenOption`, `overrideUsed`, `decidedBy`, `decidedAt`, `reason`.
  - `SupplyResult` (A3 snapshot), `Recommendation` (agent, kind, options, recommended option, rationale, input snapshot, `modelId`, `promptVersion`, `llmUsed`, `fallbackReason`, `agentTaskId`, `accepted`). No separate `Decision` entity: human decisions are `AuditLog` rows.
  - `AuditLog`: case, CR, action, actor, role, timestamp, from → to status, comment, reason, payload (the chosen option for a decision), recommendation shown and whether it was accepted, `outcome` (DONE / REFUSED).
  - `Notification` (A5, phase 2). No LLM call log: the plugin's `cap.agent.Tasks` keeps tokens and tool calls per run, and the recommendation keeps model, persona version and fallback reason (phase 7). No chat entities: the Order Assistant's conversations are kept by `@cap-js/agents` (phase 8). No `IdempotencyKey`: the ETag already refuses a second click (rule 7; idempotency keys are a pilot topic, phase 10).
- [x] Local mock entities for data with no standard S/4 API (phase 0.4): `CapacityLoad` (work center, day offset, available capacity, requirement, remaining capacity and utilization in pieces per day; the names mirror `A_WorkCenterCapPerBucket`, see [phase 0 consequences](phase-0-setup.md#real-s4-names) and open decision 7), `MaterialMovementStats` (last movement, monthly demand), `Customers` with `CustomerContract` (clause text, language, tone). C-1001 ABC Automotive has the clause "2% of order value per day late".
- [x] Code lists with criticality (1 = red, 2 = yellow, 3 = green) and a `name` column for value helps:
  - `Lanes`: HIGH 1, MEDIUM 2, NORMAL 3 (also used as `laneRank` for sorting, §2.2)
  - `CaseStatus`: NEW 0, AUTO_CONFIRMED 3, WITH_SUPPLY_PLANNING 2, WITH_PRODUCTION 2, PRODUCTION_CONFIRMED 3, PRODUCTION_REJECTED 1, SUPPLY_CONFIRMED 3, REJECTED 1, CONFIRMED_TO_CUSTOMER 3, CLOSED 0
  - `CapacityRequestStatus`, `RecommendationKinds`
- [x] Configuration tables with seed data in `db/data/`: `DeliveryPriorityLane` (`01` HIGH, `02` MEDIUM, `03`… and blank NORMAL), `PlanningParameters` (plant 1000: frozen horizon 3 days, excess threshold in days of supply), `ScoringWeights` (w1–w6), `LotSizePolicy` (FG-100 EXACT).
- [x] `srv/lib/demo-clock.js`: resolves `D+n` offsets against an injectable "today".

### Domain model result (done 2026-10-06)

`db/schema.cds` compiles without warnings, and `cds watch` loads the 12 seed files in `db/data/`. Choices that §7 and §8 leave open:

- **Keys:** cases and CRs are keyed by their readable IDs (`caseId`, `crId`), so deep links and the Order Assistant use them directly. Child rows point to the case through `parentCase` (`case` is a CDS keyword). `@assert.unique` on `salesOrder` + `item` enforces one case per item.
- **Code lists:** `status`, `lane`, CR `status` and recommendation `kind` are associations to the code lists (columns `status_code`, `lane_code`, …), so Fiori elements gets texts, criticality and value helps. `laneRank` is a calculated element (`lane.criticality`). The CR status codes are `OPEN`, `PRODUCTION_CONFIRMED` and `PRODUCTION_REJECTED`. The recommendation kinds are `CASE_SUMMARY`, `PRIORITY_RAISE`, `SUPPLY_OPTIONS`, `CAPACITY_OPTIONS` and `CUSTOMER_DRAFT`.
- **Agent names:** code and data name the agents by meaning, not A1–A5. The `Agent` enum is `FEASIBILITY_CASE_ORCHESTRATOR_AGENT`, `SALES_ORDER_INTAKE_AGENT`, `SUPPLY_INVENTORY_AGENT`, `PRODUCTION_CAPACITY_BALANCING_AGENT` and `COMMUNICATION_AGENT`. Folders and prompt IDs use the kebab-case form without the suffix (`srv/agents/feasibility-case-orchestrator/`, `srv/agents/sales-order-intake/`, `sales-order-intake-summary.v1`). The plan text keeps A1–A5, as in the blueprint.
- **ETag:** `version` (`@odata.etag`, default 0). The orchestrator increments it on every action.
- **JSON fields** (`atpResult`, CR `options`, the supply picture, payloads) are `LargeString`, with the expected shape in a comment.
- **AuditLog** has a `refusalCode` for `REFUSED` rows. `SupplyResult` stores the picture in parts (material tree, stock per plant, receipts, excess flags).
- **Configuration:** the delivery priority mapping has a row for blank (`""` → NORMAL), and `mapLane` must also map unknown keys to NORMAL ("`03` and above"). `PlanningParameters` for plant 1000: frozen horizon 3, excess above 90 days of supply, slow-moving after 90 days without movement (needed by `getSlowMovers`). The assistant's tool-call limit is plugin configuration (`cds.agents`, phase 8), not a table column. `ScoringWeights` for plant 1000: w1 1, w2 0.5, w3 50, w4 100, w5 5, w6 10; phase 2 checks that O-ALT scores better than O-MOVE.
- **CapacityLoad:** the §8.2 percentages at 200 / 100 / 80 pieces per day for D+1…D+5, keyed by plant, work center and day offset, with an `orders` column (SO-5001, SO-5004). Example: WC-ASSY-02 D+2 is 24 of 80, so O-ALT's +56 gives exactly 100%.
- **Customers:** all three have a `CustomerContract` row (language `EN`; tone formal / neutral / friendly), because A5 needs language and tone for every draft. Only C-1001 has a clause, plus the structured penalty rule (2, `DAY`, `ORDER_VALUE`) that A2 reads until phase 7. `MaterialMovementStats` has the one §8 row: FG-300 in plant 1100, last movement D-120, 25 per month.
- **Demo clock:** `today()` is `setToday()`, else the `DEMO_TODAY` environment variable, else the system date. Set `DEMO_TODAY` to the generator's `--base` date (2026-10-06 in the committed CSVs) if the S/4 mocks were not regenerated today.

A1 lives in `srv/agents/feasibility-case-orchestrator/`, next to A2–A5 (phase 2), so all five agents are under `srv/agents/` (the Order Assistant joins them in phase 8). `srv/lib/` holds only shared code (tools, adapters, case access, agent call, number check, demo clock).

## 1.2 Case rules: `srv/agents/feasibility-case-orchestrator/case-rules.js` (pure, no CDS imports)

Each function takes plain objects and returns `{ ok: true, next }` or `{ ok: false, code, message }`:

- [x] The §7 A1 status table as data: `TRANSITIONS[action] = { from: [...], to, role, needsReason }`, plus `waitingForRole(status)`.
- [x] `canAct({ caseRow, action, userRoles, input, activeCr })` covering the business rules:
  - only the role in `waitingForRole` can act (rule 1)
  - *Confirm to customer* only in `SUPPLY_CONFIRMED` (rule 2)
  - *Confirm date to Sales* after a production check only when the active CR is `PRODUCTION_CONFIRMED` (rule 3)
  - *Reject*, *Reject production* and *Choose override option* need a reason (rule 4)
  - a CR needs a parent case (rule 5)
- [x] `mapLane(deliveryPriority, mappingRows)`: blank → NORMAL.
- [x] `isFinal(status)`, `nextCaseId(lastId)`, `nextCrId(lastId)`.

### Case rules result (done 2026-10-06)

Choices that §7 and the list above leave open:

- **Actions:** `TRANSITIONS` has one row per bound action of 1.4 (`checkFeasibility` is not a transition), plus the system steps `autoConfirm` and `routeToSupplyPlanning` for A2. Rows also carry `crTo` (the active CR's next status) and `createsCr` (`requestProductionCheck`). The orchestrator passes `ROLES.SYSTEM` as the user role for agent steps.
- **Refusals** also carry `httpStatus`: 403 for rule 1 (`NOT_WAITING_FOR_ROLE`), 400 for everything else. Codes: `UNKNOWN_ACTION`, `UNKNOWN_STATUS`, `CASE_FINAL`, `CONFIRM_ONLY_IN_SUPPLY_CONFIRMED` (rule 2), `INVALID_TRANSITION`, `NOT_WAITING_FOR_ROLE` (rule 1), `NO_ACTIVE_CR`, `CR_WITHOUT_PARENT` (rule 5, also when the CR belongs to another case), `CR_NOT_OPEN`, `CR_NOT_PRODUCTION_CONFIRMED` (rule 3), `REASON_REQUIRED` (rule 4), `OPTION_REQUIRED`, `UNKNOWN_OPTION`, `OVERRIDE_NEEDS_REASON`.
- **Order of checks:** status before role, so Sales confirming to the customer in `WITH_PRODUCTION` gets rule 2 (400, "not yet `SUPPLY_CONFIRMED`"), not a 403 (scenario 5 and the scenario 6 answer). A wrong user in the right status gets 403.
- **Rule 1** uses `waitingForRole(status)`, not the stored column, so a stale `waitingForRole` cannot let the wrong role in.
- **Override:** `chooseOption` refuses an option with `needsOverride` (`OVERRIDE_NEEDS_REASON`); it has to go through `chooseOverrideOption` with a reason. `next.needsOverride` tells the orchestrator to set `overrideUsed`.
- **`checkCapacityRequest(cr, caseRow)`** is exported for rule 5 when the orchestrator creates a CR.
- **`mapLane`** reads a one-digit priority as NUMC 2 (`1` = `01`). Blank, null and unknown keys map to NORMAL.


## 1.3 Orchestrator: `srv/agents/feasibility-case-orchestrator/orchestrator.js`

- [x] `executeAction(req, action, input)`: one transaction that locks the case (`forUpdate`), checks the ETag (`version`), calls `case-rules`, updates status and `waitingForRole`, writes **one** audit row, and commits. No audit, no status change (rule 6).
- [x] Rule violations go through `req.error(400 | 403, …)` with the rule's `code`. A refused action also writes an `AuditLog` row with `outcome = REFUSED` in its own transaction, so the timeline shows it (scenario 5). The case itself does not change.
- [x] `openCase(...)` and system transitions (`NEW → AUTO_CONFIRMED`, `NEW → WITH_SUPPLY_PLANNING`) for A2, and `updateLane(...)` for a delivery priority change (audit row, no status change).
- [x] `attachRecommendation(...)` for A2–A5: writes a `Recommendation`, never the status.
- [x] After commit, emit `case.statusChanged { caseId, crId, from, to, actor }` on an in-process event bus. Subscribers (phase 2) must not block or fail the action.
- [x] `AuditLog` is append-only: `@readonly` in every service (1.4: not exposed at all; the `CaseTimeline` view is `@readonly`), and a `before('UPDATE' | 'DELETE')` handler that refuses.

### Orchestrator result (done 2026-10-06)

Choices that the list above leaves open, and what 1.4 has to provide:

- **Transaction:** `executeAction` runs in the request's transaction, so CAP commits or rolls back everything together. SQLite ignores `forUpdate`, so the case update also requires the version that was read (`where version = …`); if another action got there first it is a 412, and the CR insert or update rolls back with it.
- **ETag:** CAP already checks `If-Match` on bound actions of entities with `@odata.etag` (428 without it, 412 when stale), before the lock. `executeAction` checks it again under the lock and requires it (428 `ETAG_REQUIRED`). **For 1.4:** the `CapacityRequests` projection in `ProductionService` needs the parent case's `version` as its `@odata.etag`, because the production actions are bound to the CR and the ETag is the case version.
- **Keys:** `executeAction` reads the target key from the bound action. **For 1.4:** keep the keys named `caseId` (case projections) and `crId` (CR projection). A production action locks the CR's parent case.
- **Refused actions** get their `REFUSED` row through `cds.spawn`, after the request transaction ends: the in-memory SQLite of `cds watch` has one connection, so a second transaction alongside the first would wait forever. `at` is set to the time of the refusal, so the timeline keeps the order. A missing case or CR (404) and a stale ETag (412, a double click) are not audited: they are not rule violations.
- **Active CR:** the CR the production action is bound to; otherwise the case's latest CR. `requestProductionCheck` creates the next `CR-nnnn` (status `OPEN`, quantity from the case, `needByDate` from the input).
- **Input** of `executeAction`: `comment`, `reason`, `optionId`, plus optional `recommendationId` (stored on the audit row; `accepted` is set when `optionId` equals the recommended option, or from `recommendationAccepted`), `confirmedDate`/`confirmedQty` (set on the case) and `needByDate`. It returns `{ caseId, crId, from, to, actor, action, version }`.
- **System steps:** `openCase(data)` (one case per item: a second call returns the existing case with `created: false`; lane from `mapLane`; audit row `openCase`, `NEW`), `systemTransition(caseId, 'autoConfirm' | 'routeToSupplyPlanning')` and `updateLane(caseId, deliveryPriority)`. They join the caller's transaction or open their own, write the actor as the agent (`SALES_ORDER_INTAKE_AGENT`) with role `system`, and throw on a refusal (a system step that breaks the rules is a bug).
- **Event bus:** `onCaseEvent('case.statusChanged', listener)`. Events go out on the transaction's `succeeded`, so nothing is emitted on rollback. Each listener runs detached with its own error log. `openCase` emits `from: null → NEW`. `updateLane` emits nothing (no status change).
- **Append-only:** `guardAuditLog` refuses `UPDATE`, `DELETE` and `UPSERT` on `AuditLog` at the database service (405 `AUDIT_APPEND_ONLY`). It is registered when the module loads. **For 1.4:** the services import the orchestrator, which registers the guard, and declare `AuditLog` and the timeline `@readonly`.
- **IDs:** `max(caseId)` / `max(crId)` + 1. Fine for one demo user at a time up to `FC-9999`; a pilot needs a sequence.


## 1.4 Case services (`srv/*.cds` + `.js`)

One service per app, all delegating to `orchestrator.executeAction()`. Keep them narrow, as in the TM project.

- [x] `SupplyPlanningService` (`@requires: 'SupplyPlanner'`, `/odata/v4/supply`):
  - `Cases`: worklist of cases waiting for or handled by Supply Planning, sorted by `laneRank`, then `requestedDate`.
  - Bound actions: `confirmFromStock(comment)`, `approveStockTransfer(comment)`, `approveReallocation(comment)`, `requestProductionCheck(comment)` (creates the CR), `reject(reason)`, `confirmDateToSales(comment)`.
- [x] `ProductionService` (`@requires: 'ProductionPlanner'`, `/odata/v4/production`):
  - `CapacityRequests` with the parent case header (read-only).
  - Bound actions: `chooseOption(optionId, comment)`, `chooseOverrideOption(optionId, reason)`, `rejectProduction(reason)`.
- [x] `SalesService` (`@requires: 'Sales'`, `/odata/v4/sales`):
  - `Cases` for the user's orders, grouped by sales order; includes `AUTO_CONFIRMED` items.
  - Bound actions: `checkFeasibility()` (calls A2 in phase 2), `confirmToCustomer(comment)`, `close(comment)`.
- [x] Every action needs the ETag. A stale ETag (second click, other browser) returns 412.
- [x] `CaseTimeline` view over `AuditLog` per case **including its child CRs**, with a step label (*Intake → Supply check → Production check → Supply decision → Customer confirmation*) and the time since the previous step. Read-only in all three services.
- [x] `srv/lib/case-access.js` with `canRead(user, caseRow)`, used by the services' `@restrict` handlers and later by the Order Assistant tools (rule 8).
- [x] Generate `xs-security.json` (`cds add xsuaa`) with the scopes and role templates `Sales`, `SupplyPlanner` and `ProductionPlanner`, and the role collections `OrderConf_Sales`, `OrderConf_SupplyPlanner` and `OrderConf_ProductionPlanner`.
- [ ] Check by hand through the CAP index page (`http://localhost:4004`): open a case by hand (until phase 2), walk the scenario 1 status path as `supplychain_user` and `production_user`, and confirm to customer as `sales_user`. Also try the forbidden steps: wrong user (403), reject without a reason (400), confirm to customer in `WITH_PRODUCTION` and `WITH_SUPPLY_PLANNING` (refused, visible in the timeline; scenario 5).

### Case services result (done 2026-10-06, hand check open)

- **Files:** `srv/supply-service.cds|js`, `srv/production-service.cds|js`, `srv/sales-service.cds|js`, all built on `srv/lib/case-service.js` (read scope, default order, timeline durations, actions → `executeAction`). Each action returns its entity again, so Fiori elements gets the new status and ETag.
- **Read scope (rule 8):** `srv/lib/case-access.js` has the rule once: Sales sees every case (the demo has no owner on the case; the pilot narrows it to the user's orders), Supply Planning every case that is not `NEW` or `AUTO_CONFIRMED`, Production every case with a CR. `canRead` (pure) checks one case, and `scopeOf` gives the same rule as a CQL condition. Each service applies its own role's scope to cases, CRs, supply results, recommendations and the timeline. An action on a case outside the scope gets 404 before the orchestrator runs.
- **Wrong user:** a user without the service's role is stopped by `@requires` (403, no audit row: the request never reaches a case). The audited 403 of rule 1 (`NOT_WAITING_FOR_ROLE`) happens to a user who has the service's role while the case waits for another one, e.g. `demo_user`.
- **Reasons** are not `@mandatory` in CDS: CAP would refuse an empty reason before the handler, without the audit row. The orchestrator checks them (rule 4). The apps can still show the field as required (phases 3–5).
- **ETag:** `Cases` inherits `version` (`@odata.etag`). `ProductionService.CapacityRequests` is a `select … mixin` with `parentCase.version as caseVersion` as its `@odata.etag`, plus the parent case header fields and a `timeline` association. CAP answers 428 without `If-Match` and 412 for an old version.
- **Default order** when the client sends no `$orderby`: Supply `laneRank`, `requestedDate`; Production the same for CRs and cases; Sales `salesOrder`, `item`; the timeline `at`.
- **AuditLog** is not exposed in any service. The `CaseTimeline` view (`db/schema.cds`, association `timeline` on the case) is `@readonly` in all three. Step label from the status the action started in (see the view's comment); `previousAt` uses `lag()` per case and outcome, and `durationSeconds`/`durationText` are filled in JS (`srv/lib/case-timeline.js`), because SQLite and HANA have no common date difference. Refused rows have no duration.
- **`checkFeasibility`** is declared and answers 501 until Sales Order Intake exists (phase 2).
- **Opening a case by hand:** `srv/demo-service.cds|js` (`@requires: 'authenticated-user'`), the start of phase 2.4's `DemoService`, with one unbound action `openCase(salesOrder, item)`. It reads the order from the mocked `API_SALES_ORDER_SRV`, opens the case and routes it to Supply Planning (no ATP or penalty check yet). Phase 2 moves the read into the sales order adapter and replaces this with `simulateNewOrder`.
- **Fiori preview:** `srv/preview-annotations.cds` has just enough UI for the index page's Fiori preview (lists, object pages with the timeline, action buttons). The case apps of phases 3–5 replace it.
- **`xs-security.json`:** `cds add xsuaa` (scopes and role templates, `auth: xsuaa` in the `[production]` profile), plus the role collections `OrderConf_Sales`, `OrderConf_SupplyPlanner` and `OrderConf_ProductionPlanner`. `xsappname` and `tenant-mode` come with the MTA in phase 6.

**Hand check, scenario 1** (`npm run watch`, log in with the user name and an empty password):

1. Open the case as `demo_user` (the index page cannot call unbound actions):
   `curl -u demo_user: -X POST http://localhost:4004/odata/v4/demo/openCase -H 'Content-Type: application/json' -d '{"salesOrder":"SO-5005"}'`
2. `supplychain_user`: Fiori preview of `SupplyPlanningService` → `Cases` → FC-0001 → *Reject* with an empty reason (400, refused row in the timeline), then *Request Production Check* (CR-0001).
3. `sales_user`: preview of `SalesService` → FC-0001 → *Confirm to Customer* (400, case is `WITH_PRODUCTION`; refused row).
4. `production_user`: preview of `ProductionService` → `CapacityRequests` → CR-0001 → *Reject* with an empty reason (400), then *Choose Option* `O-ALT` (no options are stored yet before phase 2, so any ID is accepted).
5. `supplychain_user`: *Confirm Date to Sales*. `sales_user`: *Confirm to Customer* → `CONFIRMED_TO_CUSTOMER`.
6. The timeline on any of the three object pages shows the path with steps, refusals and durations. A second click on an old page gets 412.


**Exit criteria:** under `cds watch`, the scenario 1 status path works through the CAP index page with the three users, every forbidden step is refused with an audit row, and the timeline shows the path with durations.

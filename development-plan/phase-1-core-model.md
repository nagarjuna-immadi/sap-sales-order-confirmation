# Phase 1: Core model and A1 Case Orchestrator

[← Development plan](README.md) · Previous: [Phase 0](phase-0-setup.md) · Next: [Phase 2](phase-2-tools-agent-logic.md)

**Goal:** the local case model, the case rules enforced on every action, the audit log and timeline, and the three case services. A1 is deterministic and has **no LLM**.

## 1.1 Domain model: `db/schema.cds`

- [x] Entities as in §7 A1 and §6.2, namespace `order.conf`:
  - `OrderFeasibilityCase`: `caseId` (FC-nnnn), `salesOrder`, `item`, `customer`, `material`, `plant`, `quantity`, `requestedDate`, `deliveryPriority`, `lane`, `penaltyRisk`, `penaltyAmount`, `penaltyRule`, `status`, `waitingForRole`, `summary`, `atpResult`, `confirmedDate`, `confirmedQty`, `customerDraft`, `version`. One case per sales order **item** (§7 A2).
  - `CapacityRequest`: `crId` (CR-nnnn), `parentCase` (**not null**, rule 5), `status`, `needByDate`, `quantity`, `options` (JSON), `chosenOption`, `overrideUsed`, `decidedBy`, `decidedAt`, `reason`.
  - `SupplyResult` (A3 snapshot), `Recommendation` (agent, kind, options, recommended option, rationale, input snapshot, `modelId`, `promptVersion`, `llmUsed`, `accepted`). No separate `Decision` entity: human decisions are `AuditLog` rows.
  - `AuditLog`: case, CR, action, actor, role, timestamp, from → to status, comment, reason, payload (the chosen option for a decision), recommendation shown and whether it was accepted, `outcome` (DONE / REFUSED).
  - `Notification` (A5, phase 2), `ChatConversation` and `ChatMessage` (phase 8), `LlmCallLog` (phase 7). No `IdempotencyKey`: the ETag already refuses a second click (rule 7; idempotency keys are a pilot topic, phase 10).
- [x] Local mock entities for data with no standard S/4 API (phase 0.4): `CapacityLoad` (work center, day offset, available capacity, requirement, remaining capacity and utilization in pieces per day; the names mirror `A_WorkCenterCapPerBucket`, see [phase 0 consequences](phase-0-setup.md#real-s4-names) and open decision 7), `MaterialMovementStats` (last movement, monthly demand), `Customers` with `CustomerContract` (clause text, language, tone). C-1001 ABC Automotive has the clause "2% of order value per day late".
- [x] Code lists with criticality (1 = red, 2 = yellow, 3 = green) and a `name` column for value helps:
  - `Lanes`: HIGH 1, MEDIUM 2, NORMAL 3 (also used as `laneRank` for sorting, §2.2)
  - `CaseStatus`: NEW 0, AUTO_CONFIRMED 3, WITH_SUPPLY_PLANNING 2, WITH_PRODUCTION 2, PRODUCTION_CONFIRMED 3, PRODUCTION_REJECTED 1, SUPPLY_CONFIRMED 3, REJECTED 1, CONFIRMED_TO_CUSTOMER 3, CLOSED 0
  - `CapacityRequestStatus`, `RecommendationKinds`
- [x] Configuration tables with seed data in `db/data/`: `DeliveryPriorityLane` (`01` HIGH, `02` MEDIUM, `03`… and blank NORMAL), `PlanningParameters` (plant 1000: frozen horizon 3 days, excess threshold in days of supply, max 6 assistant tool calls), `ScoringWeights` (w1–w6), `LotSizePolicy` (FG-100 EXACT).
- [x] `srv/lib/demo-clock.js`: resolves `D+n` offsets against an injectable "today".

### Domain model result (done 2026-10-06)

`db/schema.cds` compiles without warnings, and `cds watch` loads the 12 seed files in `db/data/`. Choices that §7 and §8 leave open:

- **Keys:** cases and CRs are keyed by their readable IDs (`caseId`, `crId`), so deep links and the Order Assistant use them directly. Child rows point to the case through `parentCase` (`case` is a CDS keyword). `@assert.unique` on `salesOrder` + `item` enforces one case per item.
- **Code lists:** `status`, `lane`, CR `status` and recommendation `kind` are associations to the code lists (columns `status_code`, `lane_code`, …), so Fiori elements gets texts, criticality and value helps. `laneRank` is a calculated element (`lane.criticality`). The CR status codes are `OPEN`, `PRODUCTION_CONFIRMED` and `PRODUCTION_REJECTED`. The recommendation kinds are `CASE_SUMMARY`, `PRIORITY_RAISE`, `SUPPLY_OPTIONS`, `CAPACITY_OPTIONS` and `CUSTOMER_DRAFT`.
- **Agent names:** code and data name the agents by meaning, not A1–A5. The `Agent` enum is `FEASIBILITY_CASE_ORCHESTRATOR_AGENT`, `SALES_ORDER_INTAKE_AGENT`, `SUPPLY_INVENTORY_AGENT`, `PRODUCTION_CAPACITY_BALANCING_AGENT` and `COMMUNICATION_AGENT`. Folders and prompt IDs use the kebab-case form without the suffix (`srv/agents/sales-order-intake/`, `sales-order-intake-summary.v1`). The plan text keeps A1–A5, as in the blueprint.
- **ETag:** `version` (`@odata.etag`, default 0). The orchestrator increments it on every action.
- **JSON fields** (`atpResult`, CR `options`, the supply picture, payloads) are `LargeString`, with the expected shape in a comment.
- **AuditLog** has a `refusalCode` for `REFUSED` rows. `SupplyResult` stores the picture in parts (material tree, stock per plant, receipts, excess flags).
- **Configuration:** the delivery priority mapping has a row for blank (`""` → NORMAL), and `mapLane` must also map unknown keys to NORMAL ("`03` and above"). `PlanningParameters` for plant 1000: frozen horizon 3, excess above 90 days of supply, slow-moving after 90 days without movement (needed by `getSlowMovers`), 6 tool calls. `ScoringWeights` for plant 1000: w1 1, w2 0.5, w3 50, w4 100, w5 5, w6 10; phase 2 checks that O-ALT scores better than O-MOVE.
- **CapacityLoad:** the §8.2 percentages at 200 / 100 / 80 pieces per day for D+1…D+5, keyed by plant, work center and day offset, with an `orders` column (SO-5001, SO-5004). Example: WC-ASSY-02 D+2 is 24 of 80, so O-ALT's +56 gives exactly 100%.
- **Customers:** all three have a `CustomerContract` row (language `EN`; tone formal / neutral / friendly), because A5 needs language and tone for every draft. Only C-1001 has a clause, plus the structured penalty rule (2, `DAY`, `ORDER_VALUE`) that A2 reads until phase 7. `MaterialMovementStats` has the one §8 row: FG-300 in plant 1100, last movement D-120, 25 per month.
- **Demo clock:** `today()` is `setToday()`, else the `DEMO_TODAY` environment variable, else the system date. Set `DEMO_TODAY` to the generator's `--base` date (2026-10-06 in the committed CSVs) if the S/4 mocks were not regenerated today.

## 1.2 Case rules: `srv/lib/case-rules.js` (pure, no CDS imports)

Each function takes plain objects and returns `{ ok: true, next }` or `{ ok: false, code, message }`:

- [ ] The §7 A1 status table as data: `TRANSITIONS[action] = { from: [...], to, role, needsReason }`, plus `waitingForRole(status)`.
- [ ] `canAct({ caseRow, action, userRoles, input, activeCr })` covering the business rules:
  - only the role in `waitingForRole` can act (rule 1)
  - *Confirm to customer* only in `SUPPLY_CONFIRMED` (rule 2)
  - *Confirm date to Sales* after a production check only when the active CR is `PRODUCTION_CONFIRMED` (rule 3)
  - *Reject*, *Reject production* and *Choose override option* need a reason (rule 4)
  - a CR needs a parent case (rule 5)
- [ ] `mapLane(deliveryPriority, mappingRows)`: blank → NORMAL.
- [ ] `isFinal(status)`, `nextCaseId(lastId)`, `nextCrId(lastId)`.

## 1.3 Orchestrator: `srv/lib/orchestrator.js`

- [ ] `executeAction(req, action, input)`: one transaction that locks the case (`forUpdate`), checks the ETag (`version`), calls `case-rules`, updates status and `waitingForRole`, writes **one** audit row, and commits. No audit, no status change (rule 6).
- [ ] Rule violations go through `req.error(400 | 403, …)` with the rule's `code`. A refused action also writes an `AuditLog` row with `outcome = REFUSED` in its own transaction, so the timeline shows it (scenario 5). The case itself does not change.
- [ ] `openCase(...)` and system transitions (`NEW → AUTO_CONFIRMED`, `NEW → WITH_SUPPLY_PLANNING`) for A2, and `updateLane(...)` for a delivery priority change (audit row, no status change).
- [ ] `attachRecommendation(...)` for A2–A5: writes a `Recommendation`, never the status.
- [ ] After commit, emit `case.statusChanged { caseId, crId, from, to, actor }` on an in-process event bus. Subscribers (phase 2) must not block or fail the action.
- [ ] `AuditLog` is append-only: `@readonly` in every service, and a `before('UPDATE' | 'DELETE')` handler that refuses.

## 1.4 Case services (`srv/*.cds` + `.js`)

One service per app, all delegating to `orchestrator.executeAction()`. Keep them narrow, as in the TM project.

- [ ] `SupplyPlanningService` (`@requires: 'SupplyPlanner'`, `/odata/v4/supply`):
  - `Cases`: worklist of cases waiting for or handled by Supply Planning, sorted by `laneRank`, then `requestedDate`.
  - Bound actions: `confirmFromStock(comment)`, `approveStockTransfer(comment)`, `approveReallocation(comment)`, `requestProductionCheck(comment)` (creates the CR), `reject(reason)`, `confirmDateToSales(comment)`.
- [ ] `ProductionService` (`@requires: 'ProductionPlanner'`, `/odata/v4/production`):
  - `CapacityRequests` with the parent case header (read-only).
  - Bound actions: `chooseOption(optionId, comment)`, `chooseOverrideOption(optionId, reason)`, `rejectProduction(reason)`.
- [ ] `SalesService` (`@requires: 'Sales'`, `/odata/v4/sales`):
  - `Cases` for the user's orders, grouped by sales order; includes `AUTO_CONFIRMED` items.
  - Bound actions: `checkFeasibility()` (calls A2 in phase 2), `confirmToCustomer(comment)`, `close(comment)`.
- [ ] Every action needs the ETag. A stale ETag (second click, other browser) returns 412.
- [ ] `CaseTimeline` view over `AuditLog` per case **including its child CRs**, with a step label (*Intake → Supply check → Production check → Supply decision → Customer confirmation*) and the time since the previous step. Read-only in all three services.
- [ ] `srv/lib/case-access.js` with `canRead(user, caseRow)`, used by the services' `@restrict` handlers and later by the Order Assistant tools (rule 8).
- [ ] Generate `xs-security.json` (`cds add xsuaa`) with the scopes and role templates `Sales`, `SupplyPlanner` and `ProductionPlanner`, and the role collections `OrderConf_Sales`, `OrderConf_SupplyPlanner` and `OrderConf_ProductionPlanner`.
- [ ] Check by hand through the CAP index page (`http://localhost:4004`): open a case by hand (until phase 2), walk the scenario 1 status path as `supplychain_user` and `production_user`, and confirm to customer as `sales_user`. Also try the forbidden steps: wrong user (403), reject without a reason (400), confirm to customer in `WITH_PRODUCTION` and `WITH_SUPPLY_PLANNING` (refused, visible in the timeline; scenario 5).

**Exit criteria:** under `cds watch`, the scenario 1 status path works through the CAP index page with the three users, every forbidden step is refused with an audit row, and the timeline shows the path with durations.

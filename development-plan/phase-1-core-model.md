# Phase 1: Core model and A1 Case Orchestrator

[← Development plan](README.md) · Previous: [Phase 0](phase-0-setup.md) · Next: [Phase 2](phase-2-tools-agent-logic.md)

**Goal:** the local case model, the case rules enforced on every action, the audit log and timeline, and the three case services. A1 is deterministic and has **no LLM**.

## 1.1 Domain model: `db/schema.cds`

- [ ] Entities as in §7 A1 and §6.2, namespace `order.conf`:
  - `OrderFeasibilityCase`: `caseId` (FC-nnnn), `salesOrder`, `item`, `customer`, `material`, `plant`, `quantity`, `requestedDate`, `deliveryPriority`, `lane`, `penaltyRisk`, `penaltyAmount`, `penaltyRule`, `status`, `waitingForRole`, `summary`, `atpResult`, `confirmedDate`, `confirmedQty`, `customerDraft`, `version`. One case per sales order **item** (§7 A2).
  - `CapacityRequest`: `crId` (CR-nnnn), `parentCase` (**not null**, rule 5), `status`, `needByDate`, `quantity`, `options` (JSON), `chosenOption`, `overrideUsed`, `decidedBy`, `decidedAt`, `reason`.
  - `SupplyResult` (A3 snapshot), `Recommendation` (agent, kind, options, recommended option, rationale, confidence, input snapshot, `modelId`, `promptVersion`, `llmUsed`, `accepted`), `Decision`.
  - `AuditLog`: case, CR, action, actor, role, timestamp, from → to status, comment, reason, payload, recommendation shown and whether it was accepted, `outcome` (DONE / REFUSED).
  - `Notification` (A5, phase 2), `ChatConversation` and `ChatMessage` (phase 8), `LlmCallLog` (phase 7), `IdempotencyKey`.
- [ ] Local mock entities for data the sandbox does not have (phase 0.4): `CapacityLoad` (work center, day offset, load in units), `MaterialMovementStats` (last movement, monthly demand), `Customers` with `CustomerContract` (clause text, language, tone). C-1001 ABC Automotive has the clause "2% of order value per day late".
- [ ] Code lists with criticality (1 = red, 2 = yellow, 3 = green) and a `name` column for value helps:
  - `Lanes`: HIGH 1, MEDIUM 2, NORMAL 3 (also used as `laneRank` for sorting, §2.2)
  - `CaseStatus`: NEW 0, AUTO_CONFIRMED 3, WITH_SUPPLY_PLANNING 2, WITH_PRODUCTION 2, PRODUCTION_CONFIRMED 3, PRODUCTION_REJECTED 1, SUPPLY_CONFIRMED 3, REJECTED 1, CONFIRMED_TO_CUSTOMER 3, CLOSED 0
  - `CapacityRequestStatus`, `RecommendationKinds`
- [ ] Configuration tables with seed data in `db/data/`: `DeliveryPriorityLane` (`01` HIGH, `02` MEDIUM, `03`… and blank NORMAL), `PlanningParameters` (plant 1000: frozen horizon 3 days, excess threshold in days of supply, max 6 assistant tool calls), `ScoringWeights` (w1–w6), `LotSizePolicy` (FG-100 EXACT).
- [ ] `srv/lib/demo-clock.js`: resolves `D+n` offsets against an injectable "today".

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
- [ ] `test/case-rules.test.js`: one `describe` block per function. The transition test is generated from the table: every allowed transition with the right role, every forbidden one, wrong role, missing reason, and confirm to customer in every non-allowed status (scenario 5).

## 1.3 Orchestrator: `srv/lib/orchestrator.js`

- [ ] `executeAction(req, action, input)`: one transaction that locks the case (`forUpdate`), checks the ETag (`version`) and the idempotency key, calls `case-rules`, updates status and `waitingForRole`, writes **one** audit row, and commits. No audit, no status change (rule 6).
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
- [ ] Every action takes an optional `idempotencyKey` and needs the ETag. A stale ETag returns 412.
- [ ] `CaseTimeline` view over `AuditLog` per case **including its child CRs**, with a step label (*Intake → Supply check → Production check → Supply decision → Customer confirmation*) and the time since the previous step. Read-only in all three services.
- [ ] `srv/lib/case-access.js` with `canRead(user, caseRow)`, used by the services' `@restrict` handlers and later by the Order Assistant tools (rule 8).
- [ ] Generate `xs-security.json` (`cds add xsuaa`) with the scopes and role templates `Sales`, `SupplyPlanner` and `ProductionPlanner`, and the role collections `OrderConf_Sales`, `OrderConf_SupplyPlanner` and `OrderConf_ProductionPlanner`.
- [ ] `test/http/case-flow.http` (REST Client): open a case by hand (until phase 2), walk the scenario 1 status path as `nag` and `satish`, and confirm to customer as `srini`. Also try the forbidden steps: wrong user (403), reject without a reason (400), confirm to customer in `WITH_PRODUCTION` (refused, visible in the timeline).

**Exit criteria:** under `cds watch`, the scenario 1 status path works through the `.http` file with the three users, every forbidden step is refused with an audit row, the timeline shows the path with durations, and `npm test` is green.

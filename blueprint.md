# Agent Blueprints: High-Priority Sales Order Communication

Source of truth: `High_Priority_Sales_Order_Communication_Agent_Design.pdf` (cited below as §n).
This document breaks the spec's single "Orchestration Agent" into six cooperating agents and gives each one a build-ready blueprint.

---

## 0. Design principle: humans decide, code controls, LLMs only assist

The spec's hard rule (§1, §3) is that the agent **never makes a business decision**. Confirming SO-005 and rescheduling SO-004 are always explicit Confirm/Reject clicks by a human. So the agents are split into three layers:

| Layer | Who | May change workflow state? |
|---|---|---|
| **Decision** | Humans: Sales, Planning, Production Scheduler | Yes, but only through Orchestrator commands |
| **Control** | A1 Orchestrator, A6 Audit (deterministic code, **no LLM**) | A1 is the **only** writer of request status |
| **Assist** | A2–A4 role copilots, A5 Notification | No. They read data, compute analysis and draft text. |

Consequences:
- The state machine and its guards contain no LLM calls, so they are fully testable and can't be talked out of a rule.
- Every copilot has a deterministic "facts" part (numbers, tree, simulation) and an optional LLM "narrative" part (summary, drafted comment). With all LLMs switched off the demo still passes every acceptance criterion in §11, just with plainer text.
- Copilots output **recommendations and drafts**, which are always labelled as such and always need a human click to take effect.

---

## 1. Agent roster

| ID | Agent | Kind | Serves | Spec basis |
|---|---|---|---|---|
| A1 | **Workflow Orchestrator** | Deterministic engine | All roles | §5, §6, §10 |
| A2 | **Sales Copilot** | Facts + optional LLM | Sales / Customer Service | §4 steps 1 & 6, §9 Sales Worklist |
| A3 | **Planning Copilot** | Facts + optional LLM | Planning | §4 steps 2 & 5, §7.2, §9 Planning Inbox |
| A4 | **Scheduler Copilot** | Facts + optional LLM | Production Scheduler | §4 step 4, §7.3, §9 Scheduler Inbox |
| A5 | **Notification Agent** | Templates + optional LLM wording | All roles | §8, §9 Notification Center |
| A6 | **Audit & Timeline Agent** | Deterministic | All roles | §6 audit rule, §9 Request Timeline, §11 |

### 1.1 Architecture

```
  ┌────────────── Human screens (§9) ───────────────────────────────────────────┐
  │ Sales Worklist │ Planning Inbox │ Scheduler Inbox │ Timeline │ Notif. Center│
  └───────┬───────────────┬────────────────┬──────────────▲──────────────▲──────┘
          │ commands: Submit / Request check / Confirm / Reject          │
          ▼                                                │              │
  ┌─────────────────── A1 Workflow Orchestrator ─────────────────┐       │
  │ authorize role → guard transition → write state + audit (1 tx)│       │
  │ → publish domain event                                        │       │
  └────────┬───────────────────────────────┬──────────────────────┘       │
           │ same transaction               │ domain events (after commit) │
           ▼                                ▼                              │
     A6 Audit & Timeline             A5 Notification Agent ────────────────┘
           ▲
           │ read-only queries
  A2 Sales Copilot   A3 Planning Copilot   A4 Scheduler Copilot
           │                 │                     │
           ▼                 ▼                     ▼
  ┌──────────────── Data Service Layer (mock JSON / in-memory) ────────────────┐
  │ Customers │ SalesOrders │ Materials+Stock │ BOM │ Resources+Schedule │ Repos│
  └────────────────────────────────────────────────────────────────────────────┘
```

All data access goes through the service layer (§1, §12), so real SAP APIs can replace the mock services later without touching A1.

---

## 2. Shared foundation (used by every agent)

### 2.1 Roles and demo users

| Role code | Demo user | Screens |
|---|---|---|
| `SALES` | `sales.demo` | Sales Worklist, Timeline, Notifications |
| `PLANNING` | `planning.demo` | Planning Inbox, Timeline, Notifications |
| `PRODUCTION_SCHEDULER` | `scheduler.demo` | Scheduler Inbox, Timeline, Notifications |
| `AGENT` | `system` | Used as the actor on system-generated audit rows |

Demo login can be a role picker. Every command carries `{actorRole, actorUser}`.

### 2.2 Mock master and transactional data

From §2. Values marked *(demo)* are not in the spec and were chosen here to make the scheduler panel work. Change them in one place.

```jsonc
// customers.json
[{ "customerId": "CUST-1001", "name": "ABC Automotive", "status": "Active" }]

// salesOrders.json
[
  { "salesOrder": "SO-005", "customerId": "CUST-1001", "material": "FG-100", "quantity": 100,
    "priority": "HIGH",   "requestedDeliveryDate": "2026-10-15" /*(demo)*/, "status": "AWAITING_FEASIBILITY" },
  { "salesOrder": "SO-004", "customerId": "CUST-1001" /*(demo)*/, "material": "FG-100", "quantity": 100,
    "priority": "NORMAL", "requestedDeliveryDate": "2026-10-22" /*(demo)*/, "status": "PLANNED" }
]

// materials.json  (stock per §2)
[
  { "material": "FG-100",  "type": "FG",  "description": "Finished Product",      "stock": 0   },
  { "material": "SFG-200", "type": "SFG", "description": "Semi-Finished Product", "stock": 0   },
  { "material": "RAW-1",   "type": "RAW", "description": "Primary Raw Material",  "stock": 150 },
  { "material": "RAW-2",   "type": "RAW", "description": "Secondary Raw Material","stock": 20  }
]

// bom.json  (per 1 unit of parent; gives the §7.2 needs of 105 and 5 for qty 100)
[
  { "parent": "FG-100",  "component": "SFG-200", "qtyPer": 1.00 },
  { "parent": "SFG-200", "component": "RAW-1",   "qtyPer": 1.05 },
  { "parent": "SFG-200", "component": "RAW-2",   "qtyPer": 0.05 }
]

// resources.json + schedule.json  (all (demo))
[{ "resourceId": "LINE-01", "description": "FG-100 assembly line", "capacityPerDay": 100 }]
[
  { "slotDate": "2026-10-12", "resourceId": "LINE-01", "salesOrder": "SO-004", "quantity": 100 },
  { "slotDate": "2026-10-13", "resourceId": "LINE-01", "salesOrder": null,     "quantity": 0   },
  { "slotDate": "2026-10-14", "resourceId": "LINE-01", "salesOrder": null,     "quantity": 0   }
]
```

The demo dependency chain must stay consistent: `CUST-1001 → SO-005 → FG-100 → SFG-200 → RAW-1 + RAW-2`, with `SO-004` as the candidate to move.

### 2.3 Data service interfaces

All reads used by copilots. Swappable for real APIs.

| Service | Methods |
|---|---|
| `CustomerService` | `get(customerId)` |
| `SalesOrderService` | `get(so)`, `list(filter)`, `markConfirmed(so)` *(A1 only)* |
| `MaterialService` | `get(material)`, `getStock(material)`, `explodeBom(material, qty)` |
| `ResourceService` | `getResource(id)`, `getSchedule(resourceId, from, to)`, `findOrdersOn(resourceId, material)` |
| `RequestRepository` | `create`, `get`, `update(req, expectedVersion)`, `list(filter)` |
| `ScheduleRequestRepository` | `create`, `get`, `listByParent(requestId)`, `update` |
| `AuditRepository` | `append(entry)` *(same tx as status change)*, `listByRequest(requestId)` |
| `NotificationRepository` | `create`, `listForRole(role, unreadOnly)`, `markRead(id)` |

### 2.4 Entities

Field names follow §7.

**FeasibilityRequest** (parent, owned by Sales)
```jsonc
{
  "requestId": "REQ-001",
  "customerId": "CUST-1001",
  "salesOrder": "SO-005",
  "fg": "FG-100",
  "quantity": 100,
  "priority": "HIGH",
  "requestedDeliveryDate": "2026-10-15",
  "requestReason": "Key customer needs SO-005 ahead of plan",
  "status": "WAITING_FOR_PLANNING",
  "requestedByRole": "SALES",
  "requestedByUser": "sales.demo",
  "stockResult": null,                 // §7.2 snapshot, set at Planning stock check
  "schedulerCheckRequested": false,    // true once any SCH has been created
  "activeScheduleRequestId": null,     // latest SCH-xxx
  "planningDecision": null,            // §7.4
  "salesOrderConfirmed": false,
  "version": 1,
  "createdAt": "...", "updatedAt": "..."
}
```

**ScheduleRequest** (child, must reference parent)
```jsonc
{
  "scheduleRequestId": "SCH-001",
  "parentRequestId": "REQ-001",        // REQUIRED, validated on create
  "highPrioritySalesOrder": "SO-005",
  "orderToReschedule": "SO-004",
  "question": "Can SO-004 be rescheduled so SO-005 can be produced first?",
  "status": "WAITING_FOR_PRODUCTION",  // → CONFIRMED | REJECTED
  "decision": null,                    // "CONFIRM" | "REJECT"
  "proposedProductionDate": null,
  "comment": null,
  "decidedByUser": null, "decidedAt": null,
  "createdAt": "..."
}
```

**AuditEntry** (append-only, see A6) and **Notification** (see A5).

### 2.5 Status state machine

Parent request (§6), with the "resubmit scheduler request" path written out:

| From | Waiting for | Allowed to | Command | Actor |
|---|---|---|---|---|
| `DRAFT` | Sales | `WAITING_FOR_PLANNING` | `submitFeasibility` | SALES |
| `WAITING_FOR_PLANNING` | Planning | `WAITING_FOR_PRODUCTION` | `requestProductionCheck` | PLANNING |
| `WAITING_FOR_PLANNING` | Planning | `REJECTED_BY_PLANNING` | `planningDecision(REJECT)` | PLANNING |
| `WAITING_FOR_PRODUCTION` | Scheduler | `PRODUCTION_CONFIRMED` | `schedulerDecision(CONFIRM)` | PRODUCTION_SCHEDULER |
| `WAITING_FOR_PRODUCTION` | Scheduler | `REJECTED_BY_PRODUCTION` | `schedulerDecision(REJECT)` | PRODUCTION_SCHEDULER |
| `PRODUCTION_CONFIRMED` | Planning | `PLANNING_CONFIRMED` | `planningDecision(CONFIRM)` | PLANNING |
| `PRODUCTION_CONFIRMED` | Planning | `REJECTED_BY_PLANNING` | `planningDecision(REJECT)` | PLANNING |
| `REJECTED_BY_PRODUCTION` | Planning | `REJECTED_BY_PLANNING` | `planningDecision(REJECT)` | PLANNING |
| `REJECTED_BY_PRODUCTION` | Planning | `WAITING_FOR_PRODUCTION` (new SCH) | `resubmitProductionCheck` | PLANNING |
| `PLANNING_CONFIRMED` | Sales | `COMPLETED` | `confirmSalesOrder` | SALES |
| `REJECTED_BY_PLANNING` | Sales | *(closed)* | `closeRequest` / start new REQ | SALES |
| `COMPLETED` | none | *(final)* | none | none |

Child `SCH-xxx`: `WAITING_FOR_PRODUCTION → CONFIRMED | REJECTED`. A rejected SCH is never reopened; resubmitting creates `SCH-002` with the same `parentRequestId`.

### 2.6 Commands (API surface of A1)

| Command | HTTP sketch | Spec handler |
|---|---|---|
| `submitFeasibility` | `POST /requests` | `onSalesSubmit` |
| `requestProductionCheck` | `POST /requests/{id}/production-check` | `onPlanningStockCheck` (non-reject branch) |
| `planningDecision` | `POST /requests/{id}/planning-decision` | `onPlanningStockCheck` (reject branch) / `onPlanningDecision` |
| `schedulerDecision` | `POST /schedule-requests/{id}/decision` | `onSchedulerDecision` |
| `resubmitProductionCheck` | `POST /requests/{id}/production-check` (from REJECTED_BY_PRODUCTION) | §6 "resubmit" |
| `confirmSalesOrder` | `POST /requests/{id}/sales-confirm` | `onSalesConfirm` |
| `closeRequest` | `POST /requests/{id}/close` | §6 "closed" |

Every command body: `{ actorRole, actorUser, expectedVersion, idempotencyKey, comment?, reason?, ...payload }`.

### 2.7 Domain events (published by A1 after commit)

`RequestSubmitted`, `ProductionCheckRequested`, `SchedulerDecisionRecorded`, `PlanningDecisionRecorded`, `SalesOrderConfirmed`, `RequestClosed`, `TransitionRefused`.
Every event carries `{eventId, requestId, scheduleRequestId?, previousStatus, newStatus, actorRole, actorUser, comment, reason, occurredAt, payload}`.

---

## 3. Agent blueprints

Each blueprint uses the same template: Mission · Autonomy · Triggers · Inputs · Tools (allowed / denied) · Behaviour · Outputs · Guardrails · Edge cases · Tests.

---

### A1. Workflow Orchestrator

**Mission.** Be the single gatekeeper of the business case. Accept human commands, enforce the state machine and business rules, persist state and audit atomically, and emit events so others can notify and display.

**Autonomy.** None over business outcomes. It decides only *whether a human's command is allowed*, never *what the decision is*. No LLM.

**Triggers.** The commands in §2.6.

**Inputs.** Command payload, current `FeasibilityRequest` / `ScheduleRequest`, data services (for snapshots).

**Tools.**
- Allowed: all repositories (write), `SalesOrderService.markConfirmed`, `MaterialService` (to snapshot the stock result), `AuditRepository.append`, event publisher.
- Denied: anything that changes stock, BOM or the production schedule (§12: no automatic rescheduling, no real production transactions).

**Behaviour: common pipeline for every command**
```
handle(command):
  1. idempotency: if idempotencyKey seen → return stored result
  2. load request (and SCH if applicable)
  3. authorize: command.actorRole == waitingFor(request.status)      else REFUSE(ROLE_NOT_ALLOWED)
  4. guard:     (request.status → target) in TRANSITIONS               else REFUSE(INVALID_TRANSITION)
  5. rules:     command-specific checks (below)                        else REFUSE(RULE_VIOLATION)
  6. version:   request.version == command.expectedVersion             else REFUSE(STALE_VERSION)
  7. in ONE transaction:
       apply effects, status = target, version++
       audit.append({actor, timestamp, comment/reason, previousStatus, newStatus, ...})
  8. after commit: publish domain event
  9. return updated request view
REFUSE(code): no state change; audit.append(kind="REFUSED", ...); publish TransitionRefused; return 409/403 with message
```

**Behaviour: per handler (maps §10)**

| Handler | Rules (step 5) | Effects (step 7) | Event |
|---|---|---|---|
| `onSalesSubmit` | SO exists, priority `HIGH`, no open REQ for this SO | create `REQ-nnn`, audit `DRAFT → WAITING_FOR_PLANNING` | `RequestSubmitted` |
| `onPlanningStockCheck` → request check | `stockResult` computed server-side via `MaterialService.explodeBom` (never trust client numbers); `planningAction = REQUEST_PRODUCTION_CHECK`; `orderToReschedule` exists, is NORMAL, same FG/resource | save `stockResult`; create `SCH-nnn` with `parentRequestId`; `schedulerCheckRequested = true`; parent → `WAITING_FOR_PRODUCTION` | `ProductionCheckRequested` |
| `onPlanningStockCheck` → reject | `reason` non-empty | save `stockResult`; parent → `REJECTED_BY_PLANNING` | `PlanningDecisionRecorded` |
| `onSchedulerDecision` | SCH status `WAITING_FOR_PRODUCTION`; parent status `WAITING_FOR_PRODUCTION`; SCH is parent's `activeScheduleRequestId`; CONFIRM needs `proposedProductionDate`; REJECT needs `reason` | SCH → `CONFIRMED`/`REJECTED`; parent → `PRODUCTION_CONFIRMED`/`REJECTED_BY_PRODUCTION` | `SchedulerDecisionRecorded` |
| `onPlanningDecision` | CONFIRM: if `schedulerCheckRequested` then active SCH `decision == CONFIRM` (§6, §10); `confirmedDate` required. REJECT: `reason` required | store §7.4 `planningDecision`; parent → `PLANNING_CONFIRMED`/`REJECTED_BY_PLANNING` | `PlanningDecisionRecorded` |
| `resubmitProductionCheck` | status `REJECTED_BY_PRODUCTION` | new `SCH-nnn` (same parent), parent → `WAITING_FOR_PRODUCTION` | `ProductionCheckRequested` |
| `onSalesConfirm` | status **must** be `PLANNING_CONFIRMED` (§6) | `SalesOrderService.markConfirmed("SO-005")`; `salesOrderConfirmed = true`; parent → `COMPLETED` | `SalesOrderConfirmed` |
| `closeRequest` | status `REJECTED_BY_PLANNING` | mark closed (status unchanged, `closedAt` set) | `RequestClosed` |

**Outputs.** Updated entities, audit rows (via A6), domain events, and a per-role **available actions** list for each request (`getAvailableActions(requestId, role)`). The UI renders buttons from this list, but the server rules above still apply even if a button is forced. Per §11 the rule is enforced, not just hidden.

**Guardrails.**
- Status is written only here. Copilots get no write access.
- Reject without a reason is refused. Confirm accepts an optional comment.
- `SCH` without `parentRequestId`, or with a parent that doesn't exist, is refused at create.
- Never edits `schedule.json`. The scheduler's confirmation is recorded as a decision with a proposed date only.

**Edge cases.** Double click → idempotency key. Two Planning users at once → version check. Late scheduler decision on a superseded SCH → refused (`not active`). Sales confirm before Planning → refused + audit `REFUSED` row (good demo moment).

**Tests.** One test per row of §2.5 (allowed), plus one per forbidden pair, e.g. `WAITING_FOR_PLANNING → PLANNING_CONFIRMED`, `WAITING_FOR_PRODUCTION → COMPLETED`, Sales confirm in every status except `PLANNING_CONFIRMED`, Planning confirm while SCH is pending or rejected, reject with empty reason, wrong role for each command.

---

### A2. Sales Copilot

**Mission.** Help Sales raise a complete feasibility request quickly, understand where it is, and act correctly when Planning answers.

**Autonomy.** Advisory. Prefills forms and writes summaries. Never submits or confirms.

**Triggers.**
- Sales opens SO-005 in the Sales Worklist ("Check Possibility").
- `PlanningDecisionRecorded` for a Sales-owned request.
- Sales opens a request and asks "what's happening?" (status explainer).

**Inputs.** `SalesOrderService.get`, `CustomerService.get`, `RequestRepository.get`, A6 timeline, A1 `getAvailableActions`.

**Tools.**
- Allowed (read-only): `getSalesOrder`, `getCustomer`, `getRequest`, `getTimeline`, `getAvailableActions`.
- Denied: every A1 command.

**Behaviour.**
1. **Prefill request.** From SO-005 build a §7.1 draft: customer, SO, FG, quantity, priority, requested date. Draft a short `requestReason` (LLM optional; fallback template: *"High-priority order SO-005 for ABC Automotive (100 × FG-100) requested for 2026-10-15. Please check confirmation possibility."*). Sales edits and clicks **Submit**.
2. **Status explainer.** Turn the current status into one line: *"REQ-001 is waiting for Production Scheduler (SCH-001: can SO-004 move so SO-005 goes first?)."*
3. **Planning answer digest.** On CONFIRM: confirmed date, Scheduler's proposed date and comment, Planning comment, and the decision trail. On REJECT: the reason, which team rejected and the next options (close / new request).
4. **Disabled-button reason.** If Sales hovers a disabled "Confirm Sales Order", explain *"Available only when REQ-001 is PLANNING_CONFIRMED. Current status: WAITING_FOR_PRODUCTION."*

**Outputs.** Draft request (unsaved), status line, decision digest card.

**Guardrails.** It must not say "SO-005 is confirmed" unless status is `COMPLETED`. It never invents dates: every date in the text comes from stored fields. The digest is labelled "Summary by assistant".

**LLM prompt sketch** (if enabled)
```
You summarise a sales-order feasibility request for a Sales user.
Use ONLY the JSON facts provided. Do not infer dates, quantities or decisions.
You cannot approve, confirm or submit anything; tell the user which button they can press, if any,
based on availableActions. Max 4 sentences.
FACTS: {request, scheduleRequests, planningDecision, availableActions, timeline}
```

**Tests.** Prefill equals §7.1 fields for SO-005. Digest text contains the reason on rejection. No "confirmed" wording before `COMPLETED`.

---

### A3. Planning Copilot

**Mission.** Give Planning the connected material picture (FG → SFG → RAW) and the right next action, then help them close the loop after the Scheduler answers.

**Autonomy.** Advisory. Computes the stock result and recommends one of: *Request Production Check* or *Reject*. Planning clicks.

**Triggers.**
- `RequestSubmitted` (precompute on arrival so the inbox opens instantly).
- Planning opens REQ in the Planning Inbox.
- `SchedulerDecisionRecorded` (prepare the confirm/reject draft).

**Inputs.** Request, `MaterialService` (stock + BOM), `ResourceService.findOrdersOn`, `SalesOrderService.list`, active SCH.

**Tools.**
- Allowed (read-only): `getRequest`, `explodeBom(fg, qty)`, `getStock(material)`, `findCandidateOrders(fg, resource, beforeDate)`, `getScheduleRequest`.
- Denied: A1 commands, any stock or BOM write.

**Behaviour.**
1. **Material explosion** (deterministic) for FG-100 × 100:

   | Level | Material | Required | Available | Status |
   |---|---|---|---|---|
   | FG | FG-100 | 100 | 0 | SHORT |
   | SFG | SFG-200 | 100 | 0 | SHORT |
   | RAW | RAW-1 | 105 | 150 | AVAILABLE |
   | RAW | RAW-2 | 5 | 20 | AVAILABLE |

   Output is exactly the §7.2 shape plus a tree view model for the inbox.
2. **Classify the scenario**:
   - FG available ≥ required → `FROM_STOCK` (recommend: no production check needed; flagged as an open question in §6).
   - any RAW short → `MATERIAL_SHORT` (recommend: Reject; draft reason naming the short RAW and quantity).
   - FG/SFG short, all RAW available → `NEEDS_CAPACITY` (recommend: **Request Production Rescheduling Check**). This is the demo case.
3. **Find the candidate order to move.** Rule: same FG or same resource, priority `NORMAL`, status `PLANNED`, slot on or before the HP order's needed date. Result: `SO-004`. Prefill `orderToReschedule` and the §7.3 question.
4. **After the Scheduler answers.**
   - CONFIRM → draft §7.4: `confirmedDate = proposedProductionDate` (Planning may edit) and comment *"Material situation checked and Production Scheduler confirmed rescheduling."*
   - REJECT → show the scheduler's reason and two drafted options: resubmit with another candidate (if `findCandidateOrders` returns one) or reject to Sales with a drafted reason.

**Outputs.** `stockResult` view (A1 recomputes and stores its own snapshot on submit), material tree, recommendation + rationale, drafted comment/reason, candidate order.

**Guardrails.** Recommendation is visibly labelled "Suggested" and never auto-applied. If the stock numbers changed since the inbox was opened, show a "data refreshed" notice. The numbers in the narrative must equal the computed table.

**LLM prompt sketch**
```
You support a production planner. Given the computed material table and scenario
classification, explain in ≤3 sentences why the suggested action fits.
Never change numbers. Never state that anything is approved.
FACTS: {stockResult, scenario, candidateOrder, scheduleRequest?}
```

**Tests.** Explosion gives 100/100/105/5. Scenario = `NEEDS_CAPACITY`. Candidate = SO-004. Setting RAW-2 stock to 3 gives `MATERIAL_SHORT` and a reject draft mentioning RAW-2.

---

### A4. Scheduler Copilot

**Mission.** Show the Production Scheduler what happens if SO-004 moves so SO-005 goes first, and prefill a decision they can confirm or reject.

**Autonomy.** Advisory. Runs a **what-if simulation only**. Nothing is written to the schedule (§12).

**Triggers.** `ProductionCheckRequested`; Scheduler opens SCH in the Scheduler Inbox.

**Inputs.** SCH + parent REQ (the material summary from `stockResult`), `ResourceService.getSchedule`, both sales orders.

**Tools.**
- Allowed (read-only): `getScheduleRequest`, `getRequest`, `getSchedule(resourceId, from, to)`, `getSalesOrder`, `simulateSwap(hpOrder, orderToMove)` (pure function).
- Denied: A1 commands, schedule writes.

**Behaviour.**
1. **Load panel.** Show LINE-01 slots before and after for 2026-10-12 to 2026-10-14 *(demo)*:

   | Date | Before | After (simulated) |
   |---|---|---|
   | 10-12 | SO-004 (100%) | **SO-005** (100%) |
   | 10-13 | free | **SO-004** (100%) |
   | 10-14 | free | free |

2. **Impact check.** For the moved order compare new completion with its requested date: SO-004 finishes 10-13 against a need of 10-22, so it is **still on time**. For SO-005: production 10-12 against a need of 10-15, so **on time**. Flag a conflict if either would be late or if no free slot exists.
3. **Prefill decision.**
   - No conflict → suggest CONFIRM with `proposedProductionDate = 2026-10-12` and comment *"Rescheduling is possible for the demo scenario."* (§7.3).
   - Conflict → suggest REJECT with a drafted reason, e.g. *"Moving SO-004 makes it 3 days late."*
4. The Scheduler edits and clicks **Confirm** or **Reject**. A1 records it.

**Outputs.** Resource/load panel view model, impact list, suggested decision + drafts.

**Guardrails.** Shows "Simulation: no schedule changed" on the panel. Never posts a decision. The proposed date must come from the simulation or the Scheduler, never from LLM text.

**Tests.** Simulation gives SO-005 → 10-12 and SO-004 → 10-13. Setting SO-004 requested date to 10-12 gives a conflict and a reject suggestion. Confirming doesn't modify `schedule.json`.

---

### A5. Notification Agent

**Mission.** Make sure the right team learns, at the right moment, that it's their turn, with enough context to act and a deep link to do it.

**Autonomy.** Delivery only. Content is built from event payloads.

**Triggers.** Domain events from A1 (§2.7). `TransitionRefused` is shown as an inline UI error, not a notification.

**Routing table** (§8, plus rejection rows required by §11)

| Event (condition) | Recipient(s) | Content | Actions shown | Deep link |
|---|---|---|---|---|
| `RequestSubmitted` | PLANNING | High-priority feasibility request: SO/customer/product/date/qty, reason | Review → Request Production Check / Reject | `/planning/requests/REQ-001` |
| `ProductionCheckRequested` | PRODUCTION_SCHEDULER | SO-005 request + SO-004 candidate + material check summary + question | Confirm / Reject | `/scheduler/schedule-requests/SCH-001` |
| `SchedulerDecisionRecorded` (CONFIRM) | PLANNING | Scheduler decision, proposed date, comment | Confirm to Sales / Reject | `/planning/requests/REQ-001` |
| `SchedulerDecisionRecorded` (REJECT) | PLANNING | **Rejection reason**, scheduler, SCH id | Resubmit check / Reject to Sales | `/planning/requests/REQ-001` |
| `PlanningDecisionRecorded` (CONFIRM) | SALES | Final feasibility decision, confirmed/proposed date, decision trail | Confirm Sales Order | `/sales/requests/REQ-001` |
| `PlanningDecisionRecorded` (REJECT) | SALES | **Rejection reason**, which team rejected | Close / New request | `/sales/requests/REQ-001` |
| `SalesOrderConfirmed` | PLANNING + PRODUCTION_SCHEDULER | Request completed, SO-005 confirmed | View only | `/timeline/REQ-001` |

**Notification record**
```jsonc
{ "notificationId": "N-0007", "eventId": "...", "recipientRole": "PLANNING",
  "requestId": "REQ-001", "scheduleRequestId": "SCH-001",
  "title": "SO-005: Production Scheduler confirmed rescheduling",
  "body": "...", "actions": ["CONFIRM_TO_SALES", "REJECT"],
  "deepLink": "/planning/requests/REQ-001", "read": false, "createdAt": "..." }
```

**Behaviour.** Consume event → look up routing row → render template → dedupe on `(eventId, recipientRole)` → store → push to UI (polling or websocket) → update the unread badge. Every title starts with the request ID so all screens read as one case (§11).

**Guardrails.** Actions in a notification are display hints only. Clicking opens the deep link, where A1's `getAvailableActions` is re-evaluated, so stale notifications can't trigger invalid transitions. The optional LLM may rephrase the body but must keep every ID, date, quantity and reason verbatim (validate by string check; fall back to the template if the check fails).

**Channels.** In-app Notification Center for the demo. Keep a `NotificationChannel` interface so email or Teams can be added later.

**Tests.** Each routing row fires exactly once per event. Rejection notifications contain the reason. Completion goes to both Planning and Scheduler.

---

### A6. Audit & Timeline Agent

**Mission.** Keep the tamper-evident record of who did what, when and why, and present the business case as one readable timeline.

**Autonomy.** None. Deterministic.

**Triggers.** Called synchronously by A1 inside the command transaction (writes). Called by screens and copilots for reads.

**Audit entry** (satisfies §6: role/user, timestamp, comment, previous/new status)
```jsonc
{ "auditId": "A-0004", "requestId": "REQ-001", "scheduleRequestId": "SCH-001",
  "kind": "TRANSITION",               // TRANSITION | REFUSED | SYSTEM
  "action": "SCHEDULER_CONFIRM",
  "actorRole": "PRODUCTION_SCHEDULER", "actorUser": "scheduler.demo",
  "timestamp": "2026-10-05T10:42:11Z",
  "previousStatus": "WAITING_FOR_PRODUCTION", "newStatus": "PRODUCTION_CONFIRMED",
  "comment": "Rescheduling is possible for the demo scenario.", "reason": null,
  "payload": { "proposedProductionDate": "2026-10-12" } }
```

**Behaviour.**
1. `append(entry)`: append-only, no update or delete API. Optionally chain `hash = sha256(prevHash + entry)` for tamper evidence.
2. `getTimeline(requestId)`: merge parent + all child SCH entries in time order and group them into the five §9 stages: *Sales request → Planning stock check → Scheduler decision → Planning decision → Sales confirmation*. Each stage shows actor, time, decision, comment/reason. Stages not reached yet are shown as pending, and the current "waiting for" role is highlighted.
3. `checkIntegrity(requestId)` (debug / test endpoint): every SCH has an existing parent; every status change has exactly one TRANSITION row; the replayed status sequence is valid against §2.5; the final status equals the replayed status.

**Guardrails.** A1 must fail the whole command if `append` fails (no state change without audit). REFUSED rows never change status.

**Tests.** The happy path produces 5 TRANSITION rows (§4.1 below). `checkIntegrity` passes after every scenario. Timeline for REQ-001 shows SCH-001 inside the Scheduler stage.

---

## 4. End-to-end scenarios

### 4.1 Happy path (§4 steps 1–6)

| # | Human action | A1 transition | Copilot help | A5 notifies | A6 rows |
|---|---|---|---|---|---|
| 1 | Sales clicks Check Possibility → Submit | `DRAFT → WAITING_FOR_PLANNING` (REQ-001) | A2 prefills §7.1 | Planning | 1 |
| 2–3 | Planning reviews tree, clicks Request Production Check (SO-004) | `→ WAITING_FOR_PRODUCTION`, SCH-001 created | A3: table, NEEDS_CAPACITY, candidate SO-004 | Scheduler | 2 |
| 4 | Scheduler confirms, date 2026-10-12 | SCH-001 `→ CONFIRMED`; REQ `→ PRODUCTION_CONFIRMED` | A4: swap simulation, prefilled confirm | Planning | 3 |
| 5 | Planning confirms to Sales | `→ PLANNING_CONFIRMED` | A3 drafts §7.4 | Sales | 4 |
| 6 | Sales clicks Confirm Sales Order | `→ COMPLETED`, SO-005 confirmed | A2 digest | Planning + Scheduler | 5 |

One audit row per human command. The step 4 row carries both the SCH-001 and the REQ-001 status change.

### 4.2 Alternate paths to demo

| Scenario | Setup | Expected |
|---|---|---|
| **Early confirm attempt** | After step 2, Sales calls `confirmSalesOrder` | 409 `INVALID_TRANSITION`; REFUSED audit row; status unchanged |
| **Planning rejects at stock check** | RAW-2 stock = 3 | A3 suggests Reject; `→ REJECTED_BY_PLANNING`; Sales notified with reason |
| **Scheduler rejects, Planning rejects** | Scheduler rejects SCH-001 with reason | `→ REJECTED_BY_PRODUCTION`; Planning notified with reason; Planning rejects → `REJECTED_BY_PLANNING`; Sales notified with both reasons in the trail |
| **Scheduler rejects, Planning resubmits** | As above, Planning resubmits | SCH-002 with same parent; `→ WAITING_FOR_PRODUCTION`; Scheduler confirms; happy path continues; timeline shows SCH-001 (rejected) and SCH-002 |
| **Planning confirms while SCH pending** | Force `planningDecision(CONFIRM)` in `WAITING_FOR_PRODUCTION` | Refused (wrong role/state + scheduler not confirmed) |
| **Reject without reason** | Any reject with empty reason | 400 `REASON_REQUIRED` |

---

## 5. Acceptance criteria traceability (§11)

| §11 criterion | Agents | Verified by |
|---|---|---|
| Sales submits; Planning gets a notification | A1, A2, A5 | Happy path step 1 |
| Planning sees FG/SFG/RAW and sends a scheduler request | A3, A1 | A3 explosion test; step 2–3 |
| Scheduler can Confirm or Reject | A4, A1 | Step 4; "Scheduler rejects" scenarios |
| Planning auto-receives the Scheduler response and can Confirm/Reject to Sales | A5, A3, A1 | Step 4–5 notification test |
| Sales cannot confirm SO-005 before Planning confirms | A1 (server guard), A2 (explains) | "Early confirm attempt" |
| After Sales confirms → COMPLETED + full audit visible | A1, A6 | Step 6; `checkIntegrity`; Timeline screen |
| Rejections go back to the preceding team with a reason | A1, A5 | Rejection scenarios; notification content test |
| Same request ID/linkage on every screen | A1 (IDs), A5 (titles/links), A6 (timeline) | Every screen header shows `REQ-001` (+ `SCH-00n`) |

---

## 6. Build order (recommended)

1. **Foundation**: mock data + services (§2.2–2.3), entities, ID generator.
2. **A1 Orchestrator + A6 Audit** with the full transition test suite. This alone passes most of §11 through the API.
3. **A5 Notifications** + Notification Center.
4. **Screens** (§9) driven by `getAvailableActions`.
5. **A3 → A4 → A2 copilots**, facts first and then the optional LLM narrative.
6. Scripted demo run of §4.1 and §4.2.

Optional LLM layer: if enabled, use one small call per narrative with the facts JSON as the only context and strict output-length limits. A fast model is enough. Every LLM output has a template fallback so the demo never depends on the model being available.

---

## 7. Open questions for the spec owner

1. **Direct Planning confirm.** §8 lists "Confirm" among Planning's actions on a new request, but §6 has no `WAITING_FOR_PLANNING → PLANNING_CONFIRMED` transition. This blueprint follows §6 (not allowed). Should a `FROM_STOCK` case be allowed to confirm directly?
2. **Resubmit semantics.** Is resubmitting a new SCH (SCH-002) the intended reading of "resubmit scheduler request", and should a second candidate order be allowed?
3. **Schedule after confirm.** Should the demo schedule show SO-004 moved once the Scheduler confirms, or (as here) only record the proposed date?
4. **Demo dates.** §7 uses `<demo-date>`. The dates in §2.2 are placeholders. Fixed dates, or relative to "today" at demo start?
5. **Closed requests.** After `REJECTED_BY_PLANNING`, should "new request" link back to the old one (`previousRequestId`)?
6. **Users.** Is one user per role enough, or do we need several Planning users (which would make the version check visible)?

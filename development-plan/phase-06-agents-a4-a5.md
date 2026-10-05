# Phase 6 · A4 Capacity & Load Balancing and A5 Communication

**Goal.** A4 gives the Production Planner scored capacity options that prefer free alternative capacity and protect the frozen horizon. A5 turns every status change into a short, actionable notification and drafts the customer message for Sales.

**Duration.** 4–5 days.

**Depends on.** Phases 2, 3, 4, 5.

**Blueprint.** §2.1 (principle 5), §7 A4, §7 A5, §8.2, §8.3 scenarios 1 and 4.

---

## A4 · Capacity & Load Balancing

### Trigger
A1 event: CR created (case → `WITH_PRODUCTION`).

### Logic (§7 A4)
1. `getWorkCenters(material, plant)` → primary + alternatives.
2. `getLoad` and `getScheduledOrders` for the window up to the need-by date (+ a buffer for moved orders).
3. `generateOptions(cr)`:
   - **O-ALT**: alternative work center with free capacity, split across days if needed.
   - **O-MOVE**: move lower-priority orders later on the primary work center.
   - **O-SPLIT**: partial now, rest later, only if the item allows partial delivery.
   - **O-OVERTIME**: extra shift, flagged as cost.
4. `simulate(option)` → load per work center per day **before vs after**, moved orders with new completion vs due date.
5. `score(option)` with `ScoringWeights`; infeasible if the HIGH date is missed or a moved order becomes late; `needsOverride` if a frozen-horizon order (D+0…D+3) moves. New orders may use *free* capacity inside the frozen window.
6. Recommended option = lowest feasible score (deterministic).
7. LLM step (prompt `a4-compare.v1`): compare the top options in 3–4 sentences and draft the planner's comment. Scores and the recommendation are inputs, never outputs, of the LLM.
8. Store options on the CR and a `Recommendation` (agent A4).

### Human actions (through A1, Phase 2)
`chooseOption(optionId, comment?)` · `chooseOverrideOption(optionId, reason)` (only for `needsOverride` options) · `rejectProduction(reason)`.

### Guardrails
Simulation only. Nothing is rescheduled. In the connected phase the chosen option becomes a task linked to *Manage Production Orders* / *Capacity Scheduling Board* (Phase 12).

### Tests
- [ ] Scenario 1: O-ALT and O-MOVE values exactly as §8.3 (see Phase 3 golden tests); O-ALT recommended; O-MOVE `needsOverride`.
- [ ] Choosing O-MOVE without reason → 400 (A1); with reason → `PRODUCTION_CONFIRMED`, `overrideUsed = true` in audit.
- [ ] Scenario 4 (`sc4-assy02-down`): no feasible option before D+6 without frozen moves; Planner rejects with reason → `PRODUCTION_REJECTED`; A3 re-runs and proposes D+7.
- [ ] O-SPLIT only generated when partial delivery is allowed.
- [ ] LLM comparison mentioning a load value not in the simulation → template.

---

## A5 · Communication

### Trigger
Every `case.statusChanged` event from A1 (plus lane upgrades).

### Routing (§7 A5)

| Event | Recipients | Content | Deep link |
|---|---|---|---|
| Case opened (HIGH/MEDIUM) | Supply Chain Planners (plant) | Summary, lane, requested date, penalty risk | Supply Planning Workbench → FC |
| Production check requested | Production Planners | Question, material status, need-by date, options ready | Production Capacity Workbench → CR |
| Production confirmed / rejected | Supply Chain Planner | Chosen option, date, comment / reason | Supply Planning Workbench → FC |
| Supply confirmed | Sales rep | Confirmed date and qty, decision trail, **draft customer message** | Sales Order Feasibility → FC |
| Rejected | Sales rep | Reason, earliest possible date, alternatives | Sales Order Feasibility → FC |
| Confirmed to customer | Supply Chain + Production | Closure info | Case Timeline |

No notification for `AUTO_CONFIRMED` (scenario 3: no team gets a task).

### Notification texts
- Built mainly from templates with data fields (IDs, dates, quantities, reasons inserted from data). Optional LLM polish at low effort; the number check applies.
- Stored in `Notification` with `deepLink` as a semantic-object intent (`FeasibilityCase-manage?caseId=FC-0001`), resolved in Phase 7/9.
- Optional: push to Work Zone notifications if set up on the trial site (Phase 9). The in-app notification list is the primary channel.

### Customer draft (LLM step, prompt `a5-customer.v1`)
- On `SUPPLY_CONFIRMED`: confirmation draft; on `REJECTED`: delay message with the earliest date (scenario 4).
- Language and tone from `CustomerContract` (customer record). Facts only from the case.
- After generation: confirmed date, quantity, order and case IDs and reasons are checked against case data; mismatch → template draft.
- Stored on the case as `customerDraft`; Sales edits it and presses *Confirm to customer*. **A5 never sends anything to a customer.**

### Tests
- [ ] Each routing row produces exactly one notification to the right role with the right deep link.
- [ ] `AUTO_CONFIRMED` → no notification.
- [ ] Scenario 1: draft contains D+5 date and 100 × FG-100, customer name unmasked after generation, never sent.
- [ ] Scenario 4: delay draft contains D+7.
- [ ] Notification failure doesn't roll back the status change (runs after commit).

---

## Checklist (rules)

- [ ] Frozen-horizon override requires a reason (enforced by A1, shown by A4).
- [ ] A4 and A5 never change status and never write to S/4.
- [ ] No outbound channel to customers exists in code.

## Exit criteria

- [ ] Scenario 1 runs end to end through OData calls: SO-5005 → FC-0001 → CR-0001 → O-ALT → `SUPPLY_CONFIRMED` with draft → `CONFIRMED_TO_CUSTOMER`, with notifications at each step.
- [ ] Scenario 4 rejection loop runs end to end.

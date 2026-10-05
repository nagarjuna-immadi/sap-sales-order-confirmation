# Phase 5 · A2 Order Intake and A3 Supply & Inventory

**Goal.** The first two agents: A2 turns a (simulated) S/4 sales order event into a case in the right lane with penalty risk and a summary; A3 builds the complete supply picture, ranks options with the deterministic decision ladder and explains the recommendation.

**Duration.** 4–5 days.

**Depends on.** Phase 2 (A1), Phase 3 (tools), Phase 4 (LLM client).

**Blueprint.** §2.2, §2.3, §4.3 (simulated events), §5.1, §7 A2, §7 A3, §8.3 scenarios 1–4.

---

## Common agent pattern (§5.1)

Every agent in `srv/agents/<id>/` follows the same steps, implemented once in `srv/agents/base.js`:

1. **Trigger** (event or user action).
2. **Tools** → facts snapshot (all numbers).
3. **Reasoning** → `llm.generate()` with the facts as the only source; structured output.
4. **Store** a `Recommendation` via A1 (`attachRecommendation`): input snapshot, output, model ID, prompt version, `llmUsed`, fallback reason, labelled "Suggested by agent".
5. **Never** change status. Status moves only through A1 (system transitions on intake, human actions otherwise).

If the LLM fails, steps 1, 2, 4 still run with template text (flag "LLM unavailable").

---

## A2 · Order Intake & Prioritization

### Triggers
- `DemoService.simulateS4Event(payload)`: accepts a payload in the **sales order business event format** documented on Business Accelerator Hub (*SalesOrder Created / Changed*), so the pilot can swap in Event Mesh without changing A2 (§4.3).
- `SalesService.checkFeasibility(salesOrder, item)` from the Sales app.
- Seed buttons in the demo service: "Simulate new order SO-5005 / SO-5006 / SO-5007".

### Logic (§7 A2)
1. `getSalesOrder` → per item: `mapLane(deliveryPriority)`.
2. `getCustomer` → if a penalty clause exists and lane ≠ HIGH, add a *suggestion* "raise delivery priority" (Sales changes it in S/4; A2 never changes it).
3. `runAvailabilityCheck`.
   - NORMAL and fully confirmed on time → A1 `openCase` + system transition `NEW → AUTO_CONFIRMED`. No notification to planners.
   - Otherwise → A1 `openCase` + `NEW → WITH_SUPPLY_PLANNING` with the mapped lane.
4. LLM step (prompt `a2-intake.v1`):
   - 2–3 line case summary for the planner.
   - Structured `penaltyRule { rate, unit, basis }` extracted from the clause text.
5. Guard: the extracted `rate` must literally appear in the clause text; otherwise "no penalty rule verified". `penaltyAmount` is computed by `calculatePenalty` (tool), never by the LLM. No clause → "no penalty clause found".

### Changed event
- Re-read the item; if delivery priority changed, A1 updates `lane` with an audit row. An upgrade to HIGH moves the case to the top of worklists (laneRank) and triggers an A5 notification.

### Output
Case `FC-nnnn`: lane, `penaltyRisk`, `penaltyRule`, `penaltyAmount`, `summary`, `atpResult`.

### Tests
- [ ] SO-5005 → FC-0001, HIGH, penalty risk true, rule {2, %, order value per day late}, status `WITH_SUPPLY_PLANNING`.
- [ ] SO-5006 → MEDIUM case; SO-5007 → `AUTO_CONFIRMED`, no task.
- [ ] One case per item; a two-item order with different priorities gives two cases in different lanes.
- [ ] Penalty rate not in clause → rule rejected.
- [ ] Changed event with priority `02` → `01` → lane HIGH, audit row.
- [ ] LLM in failure mode → case still created with template summary.

---

## A3 · Supply & Inventory

### Triggers
- Case enters `WITH_SUPPLY_PLANNING` (A1 event).
- Planner opens the case and the stored picture is older than a configurable age → refresh.
- CR answered (`PRODUCTION_CONFIRMED` / `PRODUCTION_REJECTED`) → re-evaluate (scenario 4 needs the earliest date D+7).

### Logic (§7 A3)
1. `buildSupplyPicture(case)` → stored as `SupplyResult` snapshot.
2. `rankSupplyOptions(picture, case)` — the decision ladder, **deterministic**:

| Rank | Option | Planner action it maps to |
|---|---|---|
| 1 | Confirm from local stock / open receipt | `confirmFromStock` |
| 2 | Stock transfer from another plant (prefer slow-moving / excess) | `approveStockTransfer` |
| 3 | Reallocate from a lower-priority order whose own date still holds | `approveReallocation` |
| 4 | Produce → production check (with lot-size leftover and value) | `requestProductionCheck` |
| 5 | Reject / earliest possible date | `reject` |

3. Excess-inventory guard: for rank 4, if leftover > `excessDaysOfSupplyThreshold`, add a warning and propose exact lot size.
4. LLM step (prompt `a3-explain.v1`): plain explanation of why the recommended option ranks first, plus a draft message to Sales or the production-check question (e.g. *"Can we produce 100 × FG-100 by D+3? RAW-1 and RAW-2 are available. Plant 1100 has no FG-100 stock."*). The LLM never chooses or reorders options.
5. Store `Recommendation` (agent A3, all feasible options, recommended rank, rationale).

### Production check hand-off
When the planner presses *Request production check*, A1 creates `CR-nnnn` with the need-by date and quantity from the A3 snapshot (no LLM numbers) and the A3 question text as context for A4.

### Guardrails
- A3 creates no stock transfers or planned orders. *Approve stock transfer* in the demo only records the decision; in the connected phase it becomes an STO **proposal** (§7 A3, Phase 12).
- Reallocation records the decision only; S/4 re-confirmation happens through standard ATP (§4.3 write-back rule).

### Tests
- [ ] Scenario 1: snapshot matches §8.3 (FG 0/100, SFG 0/100, RAW-1 150/105, RAW-2 20/5, none in 1100, no candidate); recommendation = production check; leftover 0.
- [ ] Scenario 2: recommendation = stock transfer 30 from plant 1100, excess flag shown.
- [ ] Scenario 4: after `PRODUCTION_REJECTED`, earliest possible date D+7 proposed.
- [ ] Narrative with an invented number → number check falls back to template.
- [ ] A3 never writes `status` (spy on A1).

---

## Checklist (rules)

- [ ] Agents never change status; system transitions on intake go through A1.
- [ ] Penalty amount, quantities and dates come from tools.
- [ ] Contract clause text is user data → delimited in the prompt, customer name masked.
- [ ] A2 only *suggests* raising priority.

## Exit criteria

- [ ] Simulating SO-5005, SO-5006 and SO-5007 produces exactly the §8.3 outcomes in `mock` LLM mode and in `anthropic` mode.
- [ ] Recommendations visible via OData with model ID and prompt version.

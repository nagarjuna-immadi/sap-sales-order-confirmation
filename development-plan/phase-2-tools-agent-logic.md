# Phase 2: Tools and deterministic agent logic

[← Development plan](README.md) · Previous: [Phase 1](phase-1-core-model.md) · Next: [Phase 3](phase-3-supply-workbench.md)

**Goal:** A2–A5 run end to end **without an LLM**. Every number, ranking and score comes from a deterministic tool. Where the blueprint has an LLM step, this phase uses a template text; phase 6 adds Claude on top and keeps the template as the fallback.

## 2.0 Decisions and seed data

The rules below fill gaps that §7 and §8 leave open. Each one is needed to reproduce the §8.3 outcomes; change them here first if they change. Decided 2026-10-06, choosing the least work for the demo.

- [x] **Open decision 5** (frozen horizon): 3 days (`PlanningParameters.frozenHorizonDays`, §8.1 D+0 … D+3), overridden only by the Production Planner through `chooseOverrideOption` with a reason. Already seeded and enforced in phase 1.
- [x] **Lane rule:** §2.2 lists "the customer has a penalty clause" as a HIGH trigger, §7 A2 says A2 only *suggests* raising the delivery priority. The plan follows §7 A2: the lane comes from the delivery priority alone, and a clause on a non-HIGH item gives a `PRIORITY_RAISE` recommendation. No §8.3 scenario has a clause on a non-HIGH item, so this changes no outcome.
- [x] **Routing (local mock entity `ProductionRouting`):** §4.2 has no routing API, and nothing in the mocks says which work centers make FG-100. Seed for FG-100 in plant 1000: version `0001` (primary) = 0010 machining on WC-MACH-01 → 0020 assembly on WC-ASSY-01; version `0002` (alternative) = 0010 machining on WC-MACH-01 → 0020 assembly on WC-ASSY-02. Read by `work-center.js` in every profile; a routing API is a pilot topic (phase 11).
- [x] **Shipping lead time:** `PlanningParameters.shippingLeadDays` (plant 1000: **2**). It is the gap in §8.3 between "requested D+5" and "must be produced by D+3". `needByDate = requestedDate − shippingLeadDays`; earliest delivery = earliest production finish + `shippingLeadDays`.
- [x] **O-SPLIT and O-OVERTIME are not built for the demo.** §8 has no data for either (no overtime capacity, no order that allows partial delivery), and no §8.3 scenario uses them. A4 generates O-ALT and O-MOVE only; `overtimeHours` is always 0 in the score. Both options are pilot topics (phase 11).
- [x] **Scoring:** as defined in 2.2 (percent, window D+1 … D+5, spread = highest minus lowest per-work-center average). It fixes the expected scores, so phase 3–4 and scenario 6 can be checked against numbers.
- [x] **Lot size:** one source, `A_ProductSupplyPlanning` (`LotSizingProcedure` + lot-size quantities) through `product.js`, as noted in phase 0. The phase 1 `LotSizePolicy` entity and its CSV are removed.
- [x] **Text fields on the case:** `summary` and `customerDraft` are copies of the latest `CASE_SUMMARY` / `CUSTOMER_DRAFT` recommendation's rationale, written together with it. The recommendation is the record (template or LLM, fallback reason); phase 6 updates both. Done in `orchestrator.attachRecommendation`: same transaction, case `version` unchanged (not a status change).

## 2.1 S/4 access layer: `srv/lib/s4/`

The blueprint's adapters (§4.3) map onto CAP profiles, as in the TM project: the imported services are mocked from CSV in development (`mock`), and point at the S/4HANA CAL system in `[hybrid]` (technical user from `.env`) and `[production]` (destination `S4_CAL`), both `s4` (phase 9). The pilot later swaps only the `s4` credentials to the Private Cloud system (phase 11).

- [x] One module per data source (`sales-order.js`, `availability.js`, `stock.js`, `bom.js`, `product.js`, `orders.js`, `work-center.js`), each connecting once (`cds.connect.to`) and returning **plain domain objects** (`{ material, plant, unrestrictedQty }`), never raw OData payloads. Field mapping lives only here, with the real names from the phase 0 table.
- [x] **Mode per data source, not per profile** (§4.3): a shared `isMocked(serviceName)` (no `credentials` in `cds.requires.<service>`) decides `mock` or `s4`. Phase 9 keeps APIs that are not active in CAL mocked in `[production]` (open decision 3), so a profile check would be wrong there.
- [x] Always use an explicit `$select`.
- [x] `sales-order.js`: header, item and first schedule line (flat reads, phase 0), including `DeliveryPriority` and `NetAmount`. Replaces the direct read in `DemoService.openCase`.
- [x] `availability.js`: when mocked, compute basic ATP from the stock CSV (unrestricted stock of the material in the plant; the generic mock cannot run the function) and return the `AvailabilityRecord` shape. When `s4`, call the real V2 function import (`DetermineAvailabilityOf` for quantity → date).
- [x] `stock.js`: unrestricted stock (`InventoryStockType` `01`) per plant, summed over storage locations. Filter by material only, so every plant that has the material is returned (plant 1100 is not configured anywhere else).
- [x] `bom.js`: explode level by level over `MaterialBOMItem` in every profile; do not call the `ExplodeBOM` function import (no mock for it).
- [x] `orders.js`: planned and production orders with their capacity or operation rows. A receipt with `SalesOrder` set is **pegged** to that order.
- [x] `work-center.js`: work centers and capacity, plus the `ProductionRouting` mock (2.0).
- [x] Call only entity reads and the GET function imports. The imported models also contain write function imports (release, convert, schedule, approve); no module calls them.
- [x] `capacity-load.js` and `movement-stats.js`: read the local mock entities from phase 1 (no API, §4.2).
- [x] `srv/lib/cache.js`: a small TTL cache for master data (products, BOM, work centers, routing).
- [x] Every result carries a `source` field (`mock` / `s4`), so the UI can show where the data came from.

### S/4 access layer result (done 2026-10-06)

Checked against the CSV mocks with `DEMO_TODAY=2026-10-06`: every module returns the §8 values (SO-5005 priority `01`, requested D+5; FG-300 stock 20 in 1000 and 200 in 1100; BOM FG-100 × 100 → SFG-200 100, RAW-1 105, RAW-2 5; FG-100 lot size `EX` → `EXACT`; FG-100's two production orders pegged to SO-5001 / SO-5004; routing versions `0001` / `0002`; WC-ASSY-02 load 40 / 30 / 25%; FG-300 in 1100 120 days without movement). `DemoService.openCase` opens FC-0001 through `sales-order.js`. Choices the list above leaves open:

- **Functions** (domain objects, all with `source`): `getSalesOrderItems(salesOrder)`, `getSalesOrderItem(salesOrder, item)`, `getItemsForMaterial(material, plant)` (for reallocation candidates); `checkAvailability({ material, plant, quantity })` → `{ availableQty, availableDate }` (null date = never); `getStock(material, plants?)`; `getBomItems(material, plant)`, `explodeBom(material, plant, quantity)`; `getProduct(material)`, `getSupplyPlanning(material, plant)` with `lotSize.policy` `EXACT` / `FIXED` / `OTHER`; `getReceipts(material, plant)`, `getScheduledOrders(workCenter, plant, from, to)`; `getWorkCenters(plant)`, `getRouting(material, plant)`; `getLoad({ plant, workCenters?, from, to })`; `getMovementStats(material, plants?)`. Dates in and out are `YYYY-MM-DD`.
- **Shared code:** `srv/lib/s4/connection.js` has `isMocked`, `sourceOf`, `connect` and the value helpers (`isoDate` also reads the V2 `/Date(ms)/` format, `num` reads SQLite's decimal strings, `flag` reads `X`, `qty` rounds to 3 decimals so 100 × 1.05 is 105).
- **Mock ATP:** available on D+0 when unrestricted stock covers the quantity, otherwise never (no receipts). **s4 ATP:** checking rule `A` (SD), a constant in `availability.js`; S/4's `9999-12-31` means never. The V2 function call is untested until the CAL system is connected (phase 9).
- **Stock:** special stock (`InventorySpecialStockType` set) is not free and is skipped.
- **BOM:** production BOMs only (category `M`, usage `1`), the first variant, items valid today; scrap is added to the component quantity.
- **Orders:** deleted, closed and technically completed production orders are skipped (the flags are filtered in JS, because the mock has them as null). A production order's quantity is its total quantity; goods receipts are not subtracted until the pilot.
- **Cache:** 5 minutes, keyed with the source, failures not cached; `clearCache()` is for `resetDemo` (2.4). Transactional data (orders, stock, ATP, load) is never cached.

## 2.2 Tools: `srv/lib/tools/` (pure or read-only, no LLM)

- [x] A2: `getSalesOrder`, `getCustomer` (with clause text), `runAvailabilityCheck`, `calculatePenalty(rule, orderValue, daysLate)`. At intake `daysLate` is 1, so `penaltyAmount` is the amount per day late.
- [x] A3: `explodeBom`, `getStock(material)`, `getOpenReceipts`, `getSlowMovers` (days since last movement, months of supply), `simulateLeftover(material, need, lotSizePolicy)`, `findReallocationCandidates(material, needDate)`, `earliestDeliveryDate(case)`, `buildSupplyPicture(case)`.
  - `getOpenReceipts` returns only receipts **not pegged** to a sales order. SO-5001's and SO-5004's production orders are pegged, so FG-100 has no open receipt.
  - `findReallocationCandidates`: stock or receipts pegged to an order in a lower lane, **only if** that order stays covered by its own date from the remaining unpegged stock and receipts, without new production. SO-5001 and SO-5004 are therefore no candidates.
  - `earliestDeliveryDate(case)`: earliest production finish using free capacity only (no order moved), with the A4 simulation rules below, plus `shippingLeadDays`. Uses the A4 tools. If nothing fits in the `CapacityLoad` window (D+1 … D+5), it returns no date and says so.
- [x] A3 decision ladder `rankSupplyOptions(picture, case)`: the first option that meets the date is recommended, and all feasible options are returned (rank 1 local stock / receipt, 2 local stock plus stock transfer for the rest, preferring excess, 3 reallocation, 4 produce with leftover, 5 reject with `earliestDeliveryDate`). Add the excess-inventory warning for rank 4 when the leftover is above `excessThresholdDays` of supply (§7 A3).
- [x] A4: `getWorkCenters(material, plant)` (primary and alternative versions from `ProductionRouting`), `getLoad`, `getScheduledOrders`, `generateOptions(cr)`, `simulate(option)`, `score(option)`.
  - **Simulation:** operations run in routing sequence; an operation starts the day after the previous one ends and fills free capacity (`remainingCapacity`) from its first day. New orders may use free capacity inside the frozen horizon.
  - **O-ALT:** the alternative version on free capacity. **O-MOVE:** primary version; the lower-lane order on the day the assembly needs is moved, whole, to the first day after the frozen horizon. No O-SPLIT or O-OVERTIME in the demo (2.0).
  - **Feasibility** (§7 A4): infeasible if the CR's `needByDate` is missed or a moved order misses its own date. An overload above 100% is **not** infeasible; it raises the score. `needsOverride` if an order inside the frozen horizon moves.
  - **Score** (lower is better, utilization in percent, window D+1 … D+5, work centers with zero capacity left out):
    - `peakUtilization` = highest utilization of any work center on any day, after the option
    - `utilizationSpread` = highest minus lowest per-work-center average utilization over the window, after the option
    - `frozenHorizonViolations` = orders moved inside the frozen horizon
    - `daysLateForMovedOrders` = total days late of moved orders
    - `setupChanges` = work-center days the option puts an operation on (the new order's and the moved orders')
    - `overtimeHours` = overtime used (0 in the demo)
    - `score = w1·peak + w2·spread + w3·frozen + w4·daysLate + w5·setups + w6·overtime`, with `ScoringWeights`. The lowest feasible score is recommended.
- [ ] §8.3 golden values, checked by hand through the CAP index page (`http://localhost:4004`):
  - Scenario 1, A2: HIGH lane, penalty risk, penalty 2,500 EUR per day late (2% of 125,000 EUR).
  - Scenario 1, A3: BOM → SFG-200 100, RAW-1 105, RAW-2 5; FG 0/100, SFG 0/100, RAW-1 150/105, RAW-2 20/5; nothing in plant 1100; no open receipt and no reallocation candidate → **production check**; leftover 0. `needByDate` D+3.
  - Scenario 1, A4: **O-ALT**: WC-MACH-01 D+1 +100 (40% → 90%), WC-ASSY-02 D+2 +56 (30% → 100%) and D+3 +44 (25% → 80%), no order moved, finished D+3; peak 100, spread 36 (WC-ASSY-01 avg 80, WC-MACH-01 avg 44), 3 setups → **score 133**. **O-MOVE**: SO-5004 D+2 → D+4, `needsOverride`, WC-ASSY-01 D+2 100% and D+4 160%, finished D+2; peak 160, spread 73 (WC-ASSY-01 avg 100, WC-ASSY-02 avg 27), 1 frozen violation, 3 setups → **score 261.5**. O-ALT is recommended.
  - Scenario 2: 20 from plant 1000 plus a stock transfer of 30 from plant 1100 (slow-moving, 120 days without movement; excess, 8 months of supply). No production.
  - Scenario 3: ATP 20 ≥ 10 in plant 1000 → `AUTO_CONFIRMED`.
  - Scenario 4 (WC-ASSY-02 capacity 0): A4 has no O-ALT; O-MOVE is the only option (`needsOverride`, peak 160, spread 56, score 253). After the planner rejects, A3's earliest production finish without moving any order is D+5 (WC-ASSY-01 free 10 + 40 + 50 on D+3 … D+5), so the earliest delivery is **D+7**. (The planner's reason in §8.3, *"No capacity before D+6 without moving frozen orders"*, is free text, not a computed value.)

### Tools result (done 2026-10-06, hand check open)

All golden values above come out exactly in a throwaway script against the mocks (`DEMO_TODAY=2026-10-06`, scenario 4 with WC-ASSY-02's capacity set to 0 in the passed-in load). The hand check through the CAP index page waits for 2.3, which stores the results on cases, CRs and supply results. Choices the list above leaves open:

- **Files:** `srv/lib/tools/order-intake.js` (A2), `supply.js` (A3), `capacity.js` (A4), `config.js` (planning parameters, scoring weights, lane mapping and ranks, `PLANNING_WINDOW` D+1 … D+5).
- **A2:** `runAvailabilityCheck` gives `confirmedInFull` when the full quantity is available and `availableDate + shippingLeadDays ≤ requestedDate` (SO-5007: D+2 ≤ D+7). `calculatePenalty` supports the demo's rule (percent of order value per day) and returns null for any other basis rather than a guess. `penaltyRuleText(rule)` gives "2% of order value per day late".
- **A3 material tree** is netted: a component is needed only for the parent's shortfall, so FG-100 stock would reduce SFG-200's need. `toProduceQty` is the root shortfall minus unpegged receipts due by `needByDate`.
- **A3 ladder:** option IDs `S-LOCAL`, `S-TRANSFER`, `S-REALLOCATE`, `S-PRODUCE`, `S-REJECT`, each with the Supply Planning action that carries it out (`confirmFromStock` … `reject`). Ranks 2–4 appear only when local supply is short. Rank 4 is feasible when every component without a BOM is covered (FG-300 has no BOM, so scenario 2 cannot produce). Rank 5 is always there, with the earliest date. Stock transfers count as on time (no transport lead time in the demo).
- **Earliest date:** stock and unpegged receipts first, the rest from production on free capacity over all production versions, plus `shippingLeadDays`. Scenario 1 (normal load): D+5, via O-ALT's path.
- **A4:** `generateOptions(cr, { load })` leaves out options that do not fit in the window at all (scenario 4: no O-ALT) and an O-MOVE that moves nothing. Infeasible options that fit stay in the list with `infeasibleReason`. Each option carries `slots`, `movedOrders`, `metrics`, `score`, and `loadBefore` / `loadAfter` rows for the phase 4 chart. A moved order goes to `max(frozenHorizonDays + 1, day + 1)`; orders of a lower lane move first, latest due date first. `simulate` and `score` are pure.
- **The `load` parameter** of `generateOptions` and `buildSupplyPicture` replaces the stored load; `setScenario` (2.4) can use the stored mock instead.

## 2.3 Agents without LLM: `srv/agents/<agent>/`

A2–A5 sit next to A1 (`srv/agents/feasibility-case-orchestrator/`, phase 1). Each agent: trigger → tools → template text → `orchestrator.attachRecommendation()`. **Agents never change a status**; only A1 does.

- [x] **A2 Order Intake** (`srv/agents/sales-order-intake/`): per item, map the lane, check the penalty clause (non-HIGH item with a clause → `PRIORITY_RAISE` recommendation), run ATP. NORMAL and fully confirmed on time → A1 `AUTO_CONFIRMED`; otherwise A1 routes the case to `WITH_SUPPLY_PLANNING`. Writes `penaltyRisk`, `penaltyAmount`, `penaltyRule`, `atpResult` and a template `CASE_SUMMARY`. The penalty rule is read from the structured fields on `CustomerContract` until phase 6 extracts it from the clause text.
- [x] **`SalesService.checkFeasibility`** (501 since phase 1): re-runs A2 for the case's item. A changed delivery priority goes through `updateLane`; ATP and the summary are refreshed. No status change.
- [x] **A3 Supply** (`srv/agents/supply-inventory/`): on `WITH_SUPPLY_PLANNING` and when a CR is answered (`PRODUCTION_CONFIRMED`, `PRODUCTION_REJECTED`), build and store the `SupplyResult` and a `SUPPLY_OPTIONS` recommendation with the ranked options. After `PRODUCTION_CONFIRMED` it recommends confirming the delivery date to Sales; after `PRODUCTION_REJECTED` it recommends rank 5 with `earliestDeliveryDate`. Template explanation and production-check question.
- [x] **`SupplyPlanningService.requestProductionCheck`:** when the input has no `needByDate`, the handler sets it to `requestedDate − shippingLeadDays` before calling the orchestrator.
- [x] **A4 Capacity** (`srv/agents/production-capacity-balancing/`): on CR created (`to = WITH_PRODUCTION` with a `crId`), generate, simulate and score the options, store them in `CapacityRequest.options` (not a status field) and a `CAPACITY_OPTIONS` recommendation. Template comparison.
- [x] **A5 Communication** (`srv/agents/communication/`): on every status change, write `Notification` rows per the §7 A5 routing table (role, text, deep link as a semantic-object intent, e.g. `#FeasibilityCase-plan?caseId=FC-0001`; phases 3–5 use the same intents). None for `AUTO_CONFIRMED`. Template customer draft on `SUPPLY_CONFIRMED` (confirmation) and `REJECTED` (delay with the earliest date from A3's latest recommendation), stored as a `CUSTOMER_DRAFT` recommendation and copied to `customerDraft`, in the language and tone from `CustomerContract`. A5 never sends anything to a customer.
- [x] Wire the subscribers to the `case.statusChanged` bus from phase 1. They run after the commit; a failure is logged and never rolls back the action.

### Agents result (done 2026-10-06)

Checked end to end on `cds serve all --with-mocks --in-memory` with curl as the three users (`DEMO_TODAY=2026-10-06`): scenario 1 runs from intake to `CONFIRMED_TO_CUSTOMER` with the 2.2 values on the stored recommendations, CR options and supply results (O-ALT 133, O-MOVE 261.5 with override, confirmed date D+5); scenario 2 recommends and confirms the transfer of 30; scenario 3 is `AUTO_CONFIRMED` with no notification; O-MOVE without a reason is refused; a production rejection gives A3's earliest date and a delay draft. Scenario 4's D+7 needs `setScenario` (2.4). Choices the list above leaves open:

- **Files:** `srv/agents/sales-order-intake/sales-order-intake.js`, `supply-inventory/supply-inventory.js`, `production-capacity-balancing/production-capacity-balancing.js`, `communication/communication.js`; `srv/agents/index.js` registers A3–A5; the root `server.js` calls it on `served` (phase 3 adds the path prefix handling to the same file). Shared: `srv/lib/agent-trigger.js` (`onStatusChange`), `srv/lib/case-facts.js` (case, CR and latest recommendation reads).
- **Background runs:** A3–A5 run per event in `cds.spawn` as a privileged user, in their own transaction after the commit. A failure is logged and changes nothing.
- **A2** runs in the caller's transaction (`DemoService.openCase` until 2.4, `checkFeasibility`). `AUTO_CONFIRMED` sets the confirmed date and quantity (requested date, full quantity). `penaltyRisk` = a clause and not confirmed in full on time. Re-evaluation writes the intake facts directly (not a status, version unchanged) and a new summary.
- **A3 options** carry what the action needs: confirming options (`S-LOCAL`, `S-TRANSFER`, `S-REALLOCATE` when feasible) have `confirmedDate` (the requested date) and `confirmedQty`; after `PRODUCTION_CONFIRMED` the only options are `S-CONFIRM-DATE` (finish + `shippingLeadDays`, never before the requested date) and `S-REJECT`. Receipts pegged to the case's own sales order count as its supply.
- **Numbers into actions:** `SupplyPlanningService` fills `confirmedDate` / `confirmedQty`, `needByDate` and the CR quantity (`S-PRODUCE` quantity) from A3's latest recommendation; the user never types them. Supply and production actions link the recommendation shown to the audit row (`recommendationAccepted`).
- **A4** stores the full options (with `loadBefore` / `loadAfter`) on the CR; the recommendation keeps them without the load rows.
- **A5 routing:** `WITH_SUPPLY_PLANNING` → SupplyPlanner; `WITH_PRODUCTION` → ProductionPlanner; `PRODUCTION_CONFIRMED` / `_REJECTED` → SupplyPlanner; `SUPPLY_CONFIRMED`, `REJECTED` → Sales; `CONFIRMED_TO_CUSTOMER` → SupplyPlanner, plus ProductionPlanner when the case had a CR. Nothing for `NEW`, `AUTO_CONFIRMED`, `CLOSED`. Intents (renamed in phase 4, one per app): `#FeasibilityCase-plan?caseId=…`, `#CapacityRequest-decide?crId=…`, `#FeasibilityCase-track?caseId=…` (`INTENTS` in `communication.js`; phases 3–5 define them as the apps' inbounds). The closure notice to Production links to its CR. Customer drafts are English templates in the contract's tone (formal / neutral / friendly) for every language until phase 6; the internal reject reason is not in the customer draft.
- **Notifications** are exposed read-only as `Notifications` in each case service, filtered to the service's role, newest first.

## 2.4 Simulated S/4 events: `DemoService`

- [x] `srv/demo-service.cds` (`@requires: 'authenticated-user'`, demo only): `simulateS4Event(payload)` accepts a CloudEvents payload in the *SalesOrder Created / Changed* format noted in phase 0.1 and calls A2, which reads the order through `sales-order.js` (the event carries no items or priority). Shortcut: `simulateNewOrder(salesOrder)` for SO-5005, SO-5006 and SO-5007. Remove the phase 1 `openCase` action.
- [x] `simulatePriorityChange(salesOrder, item, deliveryPriority)`: the *Changed* payload has no `DeliveryPriority`, so this first updates the mocked `A_SalesOrderItem` (refused when the sales order service is `s4`), then posts a `Changed` event. A2 re-evaluates the lane, and A1 updates it with an audit row. An upgrade to HIGH moves the case to the top of the worklists. Phase 5's *Simulate priority change* button calls it.
- [x] `setScenario('default' | 'sc4-assy02-down')`: switches the mock override for scenario 4 (WC-ASSY-02 capacity 0 in `CapacityLoad`). Set it **before** the production check is requested: A4 computes the options when the CR is created.
- [x] `resetDemo()`: reseeds the database (cases, CRs, audit, notifications, recommendations, mock S/4 rows changed by `simulatePriorityChange`), sets the scenario back to `default`, and so resets the IDs to FC-0001 / CR-0001.
- [x] The index page cannot call unbound actions (phase 1.4), so `DemoService` is called with curl, e.g.:
  - `curl -u demo_user: -X POST http://localhost:4004/odata/v4/demo/simulateNewOrder -H 'Content-Type: application/json' -d '{"salesOrder":"SO-5005"}'`
  - `curl -u demo_user: -X POST http://localhost:4004/odata/v4/demo/setScenario -H 'Content-Type: application/json' -d '{"scenario":"sc4-assy02-down"}'`
  - `curl -u demo_user: -X POST http://localhost:4004/odata/v4/demo/resetDemo -H 'Content-Type: application/json' -d '{}'`
- [ ] Walk scenarios 1–5 by hand: events with curl, then the case actions through the CAP index page with the three users.

### DemoService result (done 2026-10-06, hand walk open)

Checked with curl on `cds serve all --with-mocks --in-memory` (`DEMO_TODAY=2026-10-06`): scenario 4 gives O-MOVE only (score 253), then after the production rejection A3's earliest date D+7 and a delay draft with that date; scenario 5's confirm to customer in `WITH_PRODUCTION` is refused and in the timeline; SO-5006 `02` → `01` moves FC-0002 from MEDIUM to HIGH with an `updateLane` audit row; `resetDemo` leaves no case, priority `02` back on SO-5006, scenario `default`, and the next SO-5005 is FC-0001 / CR-0001 with 133 / 261.5 again. Choices the list above leaves open:

- **Actions:** `simulateS4Event(payload)` takes the CloudEvents envelope as `payload` (`id`, `specversion` `1.0`, `source`, `type` required; only `SalesOrder.Created.v1` and `.Changed.v1`). Both types run Sales Order Intake for every item of the order: items without a case get one, items with a case are re-evaluated. `simulateNewOrder` and `simulatePriorityChange` build that envelope themselves. All three return one `IntakeResult` per item (`caseId`, `created`, `lane`, `status`, `laneChanged`).
- **Scenario switch:** `srv/lib/demo-scenario.js`, applied in `capacity-load.js` when the load is read; the stored `CapacityLoad` rows never change. It lives in process memory, so a restart or `resetDemo` goes back to `default`.
- **Reset:** redeploys the model and all seed data (including the S/4 mocks) into the in-memory SQLite database in a background transaction (one connection), then clears the master-data cache. Refused with 501 on any other database (phase 9, open decision 2).
- **`openCase` is gone;** the phase 1 hand check now uses `simulateNewOrder`.

**Hand walk** (`npm run watch`, users log in with an empty password):

1. `curl -u demo_user: -X POST http://localhost:4004/odata/v4/demo/simulateNewOrder -H 'Content-Type: application/json' -d '{"salesOrder":"SO-5005"}'`; then as `supplychain_user` in the Fiori preview of `SupplyPlanningService`: FC-0001's `Recommendations` (`S-PRODUCE`), `SupplyResults` and `Notifications`; *Request Production Check*.
2. `production_user`, `ProductionService` → `CapacityRequests` → CR-0001: `options` with O-ALT 133 and O-MOVE 261.5; *Choose Option* `O-ALT`.
3. `supplychain_user`: *Confirm Date to Sales* (2026-10-11 = D+5 is filled in). `sales_user`: `customerDraft` on FC-0001, *Confirm to Customer*.
4. Scenarios 2 and 3: `simulateNewOrder` for SO-5006 (*Approve Stock Transfer*) and SO-5007 (`AUTO_CONFIRMED`, no notification).
5. Scenario 4: `resetDemo`, then `setScenario` `sc4-assy02-down`, SO-5005 again, *Request Production Check*, *Reject Production* with a reason, *Reject* with a reason; `sales_user` sees the delay draft with 2026-10-13 (D+7).
6. Scenario 5: on a case in `WITH_PRODUCTION`, `sales_user` *Confirm to Customer* → 400, refused row in the timeline.

**Exit criteria:** under `cds watch`, simulating SO-5005, SO-5006 and SO-5007 with curl gives exactly the §8.3 outcomes, visible through the CAP index page; the golden values in 2.2 match, including the scores; notifications appear for the right roles; and scenario 4 ends with D+7 and a delay draft.

# Phase 2: Tools and deterministic agent logic

[← Development plan](README.md) · Previous: [Phase 1](phase-1-core-model.md) · Next: [Phase 3](phase-3-supply-workbench.md)

**Goal:** A2–A5 run end to end **without an LLM**. Every number, ranking and score comes from a deterministic tool. Where the blueprint has an LLM step, this phase uses a template text; phase 7 adds Claude on top and keeps the template as the fallback.

## 2.1 S/4 access layer: `srv/lib/s4/`

The blueprint's adapters (§4.3) map onto CAP profiles, as in the TM project: the imported services are mocked from CSV in development (`mock`), and point at the S/4HANA CAL system in `[hybrid]` (technical user from `.env`) and `[production]` (destination `S4_CAL`), both `s4` (phase 6). The pilot later swaps only the `s4` credentials to the Private Cloud system (phase 10).

- [ ] One module per data source (`sales-order.js`, `availability.js`, `stock.js`, `bom.js`, `product.js`, `orders.js`, `work-center.js`), each connecting once (`cds.connect.to`) and returning **plain domain objects** (`{ material, plant, unrestrictedQty }`), never raw OData payloads. Field mapping lives only here, with the real names from the phase 0 table.
- [ ] Always use an explicit `$select`.
- [ ] `availability.js`: in the mock profile, compute basic ATP from the stock CSV (the generic mock cannot run the function) and return the `AvailabilityRecord` shape. In `[hybrid]`, call the real V2 function import (`DetermineAvailabilityOf` for quantity → date).
- [ ] `bom.js`: explode level by level over `MaterialBOMItem` in every profile; do not call the `ExplodeBOM` function import (no mock for it).
- [ ] Call only entity reads and the GET function imports. The imported models also contain write function imports (release, convert, schedule, approve); no module calls them.
- [ ] `capacity-load.js` and `movement-stats.js`: read the local mock entities from phase 1 (no API, §4.2).
- [ ] `srv/lib/cache.js`: a small TTL cache for master data (products, BOM, work centers).
- [ ] Every result carries a `source` field (`mock` / `s4`), so the UI can show where the data came from.

## 2.2 Tools: `srv/lib/tools/` (pure or read-only, no LLM)

- [ ] A2: `getSalesOrder`, `getCustomer` (with clause text), `runAvailabilityCheck`, `calculatePenalty(rule, orderValue, daysLate)`.
- [ ] A3: `explodeBom`, `getStock(material, plants[])`, `getOpenReceipts`, `getSlowMovers` (days since last movement, months of supply), `simulateLeftover(material, need, lotSizePolicy)`, `findReallocationCandidates(material, needDate)`, `buildSupplyPicture(case)`.
- [ ] A3 decision ladder `rankSupplyOptions(picture, case)`: the first option that meets the date is recommended, and all feasible options are returned (rank 1 local stock / receipt, 2 stock transfer preferring excess, 3 reallocation, 4 produce with leftover, 5 reject with the earliest possible date). Add the excess-inventory warning for rank 4 (§7 A3).
- [ ] A4: `getWorkCenters` (with alternatives), `getLoad`, `getScheduledOrders`, `generateOptions(cr)` (O-ALT, O-MOVE, O-SPLIT only if partial delivery is allowed, O-OVERTIME), `simulate(option)`, `score(option)` with the §7 A4 formula and `ScoringWeights`. Infeasible if the HIGH date is missed or a moved order becomes late; `needsOverride` if an order inside the frozen horizon moves.
- [ ] §8.3 golden values, checked by hand through the CAP index page (`http://localhost:4004`):
  - Scenario 1: BOM → SFG-200 100, RAW-1 105, RAW-2 5; FG 0/100, SFG 0/100, RAW-1 150/105, RAW-2 20/5; nothing in plant 1100; no reallocation candidate → **production check**; leftover 0.
  - O-ALT: WC-MACH-01 D+1 +100 (40% → 90%), WC-ASSY-02 D+2 +56 (30% → 100%) and D+3 +44 (25% → 80%), no order moved, finished D+3. O-MOVE: SO-5004 D+2 → D+4, `needsOverride`, WC-ASSY-01 D+4 at 160%, worse score. O-ALT is recommended.
  - Scenario 2: stock transfer of 30 from plant 1100 (excess, 8 months of supply).
  - Scenario 4 (WC-ASSY-02 down): no option before D+6 without moving frozen orders; earliest date **D+7**.

## 2.3 Agents without LLM: `srv/agents/<agent>/`

Each agent: trigger → tools → template text → `orchestrator.attachRecommendation()`. **Agents never change a status**; only A1 does.

- [ ] **A2 Order Intake** (`srv/agents/sales-order-intake/`): per item, map the lane, check the penalty clause (non-HIGH item with a clause → *suggest* raising the priority), run ATP. NORMAL and fully confirmed on time → A1 `AUTO_CONFIRMED`; otherwise A1 opens the case in `WITH_SUPPLY_PLANNING`. Template summary for now. The penalty rule is read from a structured field on `CustomerContract` until phase 7 extracts it from the clause text.
- [ ] **A3 Supply** (`srv/agents/supply-inventory/`): on `WITH_SUPPLY_PLANNING` and when a CR is answered, build and store the supply picture and the ranked options. Template explanation and production-check question.
- [ ] **A4 Capacity** (`srv/agents/production-capacity-balancing/`): on CR created, generate, simulate and score the options, and store them on the CR. Template comparison.
- [ ] **A5 Communication** (`srv/agents/communication/`): on every status change, write `Notification` rows per the §7 A5 routing table (role, text, deep link as a semantic-object intent). None for `AUTO_CONFIRMED`. Template customer draft on `SUPPLY_CONFIRMED` (confirmation) and `REJECTED` (delay with the earliest date), stored as `customerDraft`. A5 never sends anything to a customer.
- [ ] Wire the subscribers to the `case.statusChanged` bus from phase 1. They run after the commit; a failure is logged and never rolls back the action.

## 2.4 Simulated S/4 events: `DemoService`

- [ ] `srv/demo-service.cds` (`@requires: 'authenticated-user'`, demo only): `simulateS4Event(payload)` accepts a payload in the *SalesOrder Created / Changed* format noted in phase 0.1 and calls A2. Shortcuts: `simulateNewOrder(salesOrder)` for SO-5005, SO-5006 and SO-5007.
- [ ] `Changed` event with a new delivery priority: A2 re-evaluates the lane, A1 updates it with an audit row. An upgrade to HIGH moves the case to the top of the worklists.
- [ ] `setScenario('default' | 'sc4-assy02-down')`: switches the mock override for scenario 4 (WC-ASSY-02 capacity 0).
- [ ] `resetDemo()`: reseeds the database and resets the IDs to FC-0001 / CR-0001.
- [ ] Walk scenarios 1–5 by hand through the CAP index page with the three users.

**Exit criteria:** under `cds watch`, simulating SO-5005, SO-5006 and SO-5007 gives exactly the §8.3 outcomes through the CAP index page, the golden values in 2.2 match, notifications appear for the right roles, and scenario 4 ends with D+7 and a delay draft.

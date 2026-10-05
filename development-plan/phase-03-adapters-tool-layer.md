# Phase 3 · Adapters and deterministic tool layer

**Goal.** All facts the agents and the Order Assistant use (stock, BOM, ATP, receipts, load, simulations, scores) come from deterministic, unit-tested functions that read through switchable adapters. This is where "numbers come from tools, never from the LLM" is made true.

**Duration.** 5–6 days.

**Depends on.** Phase 1. Runs in parallel with Phases 2 and 4.

**Blueprint.** §4.2, §4.3, §5.1, §7 A2/A3/A4 tool tables, §8.

---

## 1. Adapter design

```
srv/adapters/
├── index.js                 # getAdapter(source) → mode from cds.requires.<source>.mode
├── sales-order/   { mock.js, sandbox.js, s4.js }
├── availability/  { mock.js, sandbox.js, s4.js }
├── stock/         { mock.js, sandbox.js, s4.js }
├── bom/           { mock.js, sandbox.js, s4.js }
├── product/       { mock.js, sandbox.js, s4.js }
├── orders/        { mock.js, sandbox.js, s4.js }     # planned + production orders
├── work-center/   { mock.js, sandbox.js, s4.js }
├── capacity-load/ { mock.js, s4.js }                 # no sandbox (§4.2)
└── business-partner/ { mock.js, sandbox.js, s4.js }
```

- One **interface per data source** returning plain domain objects (`{ material, plant, unrestrictedQty, storageLocation }`), never raw OData payloads. Field mapping lives only in `sandbox.js` / `s4.js`.
- Mode per source in `cds.requires`, e.g. `"stock": { "mode": "mock" }`. The demo can mix modes (§4.3).
- `sandbox.js`: `cds.connect.to('S4_SANDBOX_<API>')` using the imported EDMX (`cds import srv/external/*.edmx`) and the `S4_SANDBOX` destination; locally the `APIKey` header comes from `.env`. Never log the key.
- `s4.js`: same code as `sandbox.js` against a different destination (`S4_PRIVATE_CLOUD`, Cloud Connector). In the demo it is a stub that throws `NotAvailableOnTrial`; it is completed in Phase 11.
- `mock.js`: reads `mock-data/*.json`, resolves `D+n` with the demo clock, applies scenario overrides (e.g. `sc4-assy02-down`) from a `DemoScenario` setting.

### Sandbox mapping tasks
- [ ] Map `API_SALES_ORDER_SRV` item → `{ salesOrder, item, material, plant, qty, requestedDate, deliveryPriority, customer }`. Confirm the delivery priority property name in `$metadata` (§7 A2) and record it in a code comment.
- [ ] Map `API_PRODUCT_AVAILY_INFO_BASIC` → `{ confirmedQty, confirmedDate, fullyConfirmedOnTime }`.
- [ ] Map stock, BOM, product MRP (lot size), planned/production orders, work centers.
- [ ] Integration tests against the sandbox run only when `SANDBOX_API_KEY` is set (skipped in CI).

## 2. Tool functions

All tools live in `srv/tools/`, are **pure or read-only**, take explicit inputs, return JSON-serializable results with a `source` field (`mock` / `sandbox` / `s4`) and never call the LLM.

### A2 tools
| Tool | Logic |
|---|---|
| `getSalesOrder(so, item?)` | Adapter read |
| `getCustomer(id)` | Adapter read + `CustomerContract` clause text |
| `runAvailabilityCheck(material, plant, qty, date)` | Adapter read (basic ATP) |
| `mapLane(deliveryPriority)` | `DeliveryPriorityLane` table lookup; blank → NORMAL |
| `calculatePenalty(rule, orderValue, daysLate)` | Pure; uses the rule extracted and verified in Phase 5 |

### A3 tools
| Tool | Logic |
|---|---|
| `explodeBom(material, plant, qty)` | Multi-level explosion with quantities per level; returns tree with `required` |
| `getStock(material, plants[])` | Unrestricted stock per plant / storage location |
| `getOpenReceipts(material, plant)` | Unpegged planned/production orders and POs |
| `getSlowMovers(material)` | Days since last movement, months of supply = stock / monthly demand |
| `simulateLeftover(material, need, lotSizePolicy)` | Leftover qty, days of supply, value |
| `findReallocationCandidates(material, needDate)` | Lower-priority orders holding stock/receipts whose own date still holds |
| `buildSupplyPicture(case)` | Combines the above into the snapshot stored in `SupplyResult` (tree with required/available, other plants, receipts, excess/slow flags) |
| `rankSupplyOptions(picture, case)` | **Deterministic decision ladder** §7 A3 (ranks 1–5); returns all feasible options + the recommended one + earliest possible date |

### A4 tools
| Tool | Logic |
|---|---|
| `getWorkCenters(material, plant)` | Primary + alternatives (production versions) |
| `getLoad(workCenter, from, to)` | Load per day in units and % (mock until custom CDS in pilot) |
| `getScheduledOrders(workCenter, from, to)` | Orders with priority, due date, frozen flag |
| `generateOptions(cr)` | O-ALT, O-MOVE, O-SPLIT (only if partial delivery allowed), O-OVERTIME |
| `simulate(option)` | Pure: new load per day, moved orders, their new completion vs due date |
| `score(option)` | Pure: §7 A4 formula with `ScoringWeights`; marks infeasible if HIGH date missed or any moved order late; sets `needsOverride` if a frozen order moves |

## 3. Golden tests from §8 (must match the blueprint exactly)

Scenario 1 (`SO-5005`, 100 × FG-100, plant 1000):
- [ ] `mapLane('01')` = HIGH.
- [ ] `explodeBom` → SFG-200 100, RAW-1 105, RAW-2 5.
- [ ] Availability: FG 0/100, SFG 0/100, RAW-1 150/105 ✔, RAW-2 20/5 ✔; plant 1100 has no FG-100; no reallocation candidate.
- [ ] `rankSupplyOptions` → recommended **production check** (rank 4); `simulateLeftover` with EXACT → leftover 0.
- [ ] O-ALT: WC-MACH-01 D+1 +100 (40% → 90%); WC-ASSY-02 D+2 +56 (30% → 100%), D+3 +44 (25% → 80%); no order moved; finish D+3.
- [ ] O-MOVE: SO-5004 D+2 → D+4 on WC-ASSY-01, `needsOverride = true`; WC-ASSY-01 D+4 = 160% → split or infeasible; score worse than O-ALT.
- [ ] Recommended option = O-ALT.

Scenario 2 (`SO-5006`, 50 × FG-300, prio `02`):
- [ ] Lane MEDIUM; plant 1000 stock 20; plant 1100 200 with 8 months of supply → excess flag.
- [ ] Recommended: **stock transfer 30 from plant 1100** (rank 2), not production.

Scenario 3 (`SO-5007`, 10 × FG-300, prio `03`):
- [ ] Lane NORMAL; ATP fully confirmed on time → auto-confirm path.

Scenario 4 (override `sc4-assy02-down`):
- [ ] O-ALT infeasible; no option before D+6 without moving frozen orders; earliest possible date **D+7** from `rankSupplyOptions`.

Also: property-based tests for `simulate`/`score` (load never negative, moved orders accounted for once).

## Checklist (rules)

- [ ] Tools never call the LLM and never write case data.
- [ ] No direct `new Date()`; all dates via the demo clock.
- [ ] Every tool result includes `source` so the UI can show "mock" vs "sandbox".
- [ ] No write calls in any adapter (read-only until Phase 12).

## Exit criteria

- [ ] All golden tests green in `mock` mode.
- [ ] Sandbox integration tests pass locally for the read APIs that exist in the sandbox.
- [ ] Tool outputs documented with JSON examples in `srv/tools/README.md` (these become LLM prompt inputs and assistant tool results).

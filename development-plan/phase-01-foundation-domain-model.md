# Phase 1 · Project foundation and domain model

**Goal.** A runnable CAP (Node.js) project with the full CDS domain model, the §8 demo data as seed files, configuration tables, roles and a test harness. Every later phase builds on this.

**Duration.** 3–4 days.

**Depends on.** Phase 0.

**Blueprint.** §4 (architecture), §4.1, §4.3, §7 A1 (case model), §7 A2 (priority mapping), §8 (demo data).

---

## 1. Project scaffold

```
sap-sales-order-confirmation/
├── app/                       # Fiori apps (Phase 7, 8)
├── db/
│   ├── schema.cds             # domain model
│   ├── config.cds             # configuration tables
│   └── data/                  # seed CSVs (§8)
├── srv/
│   ├── case-service.cds       # A1-facing OData V4 services (Phase 2)
│   ├── assistant-service.cds  # OrderAssistantService (Phase 8)
│   ├── demo-service.cds       # "Simulate S/4 event", demo reset (Phase 5, 10)
│   ├── orchestrator/          # A1 (Phase 2)
│   ├── agents/                # A2–A5 (Phase 5, 6)
│   ├── tools/                 # deterministic tool functions (Phase 3)
│   ├── adapters/              # mock | sandbox | s4 (Phase 3)
│   ├── llm/                   # LLM client module (Phase 4)
│   ├── lib/                   # demo clock, ids, errors
│   └── external/              # imported sandbox EDMX/CSN (cds import)
├── test/
│   ├── unit/
│   ├── integration/
│   └── scenarios/             # §8.3 end-to-end tests (Phase 10)
├── mock-data/                 # JSON for the mock adapters (§8)
├── xs-security.json
├── mta.yaml                   # skeleton now, completed in Phase 9
└── package.json
```

Tasks:
- `cds init` with Node.js, add `@cap-js/sqlite` for development and demo, `@sap/xssec` for auth.
- Test runner: `jest` (or `node --test`) with `@cap-js/cds-test` for service-level tests.
- ESLint with the CAP recommended config.
- Scripts in `package.json`: `watch` (`cds watch`), `test`, `lint`, `build` (`mbt build` later).
- Profiles in `package.json` → `cds.requires`:
  - `[development]`: SQLite in-memory, mocked auth with the three demo users, all adapters `mock`, LLM `mock`.
  - `[demo-live]`: same, but LLM `anthropic`, and `sandbox` adapters for the "live data" view.
  - `[production]` (CF trial): SQLite file reseeded at start (default) or HANA Cloud (optional), XSUAA.
- Add the run and test commands to `CLAUDE.md`.

## 2. Domain model (`db/schema.cds`)

From §7 A1 and §6.2. Use `cuid` + `managed` aspects where useful; human-readable IDs (`FC-nnnn`, `CR-nnnn`) are separate fields set by A1.

| Entity | Key fields | Notes |
|---|---|---|
| `OrderFeasibilityCase` | `caseId` (FC-nnnn), `salesOrder`, `item`, `customer`, `material`, `plant`, `quantity`, `requestedDate`, `deliveryPriority`, `lane` (HIGH/MEDIUM/NORMAL), `penaltyRisk` (flag), `penaltyAmount`, `penaltyRule` (rate, unit, basis), `status`, `waitingForRole`, `summary`, `atpResult`, `confirmedDate`, `confirmedQty`, `version`, `customerDraft` | One case per sales order **item** (§7 A2). |
| `SupplyResult` | `case`, `snapshot` (JSON: material tree, stock per plant, receipts, flags), `createdAt` | A3 tool result snapshot. |
| `Recommendation` | `case`, `capacityRequest?`, `agent` (A2–A5), `kind`, `recommendedOption`, `options` (JSON), `rationale`, `confidence`, `inputSnapshot`, `modelId`, `promptVersion`, `llmUsed`, `llmFallbackReason`, `accepted?` | "Suggested by agent". Stored for every agent run (§5.1). |
| `Decision` | `case`, `capacityRequest?`, `action`, `actor`, `role`, `comment`, `reason`, `recommendationShown`, `accepted` | Human decisions. |
| `CapacityRequest` | `crId` (CR-nnnn), `parentCase` (**not null**), `status`, `options` (JSON), `chosenOption`, `decidedBy`, `decidedAt`, `reason`, `overrideUsed` | Rule 5: no CR without parent. |
| `AuditLog` | `case`, `capacityRequest?`, `action`, `actor`, `role`, `timestamp`, `fromStatus`, `toStatus`, `comment`, `reason`, `payload`, `recommendationId`, `recommendationAccepted`, `outcome` (DONE / REFUSED) | Append-only. No UPDATE/DELETE (enforced in Phase 2). |
| `Notification` | `recipientRole`, `recipientUser?`, `plant?`, `case`, `capacityRequest?`, `eventType`, `title`, `body`, `deepLink`, `read` | A5 output (§7 A5). |
| `ChatConversation` | `owner`, `contextCaseId?`, `createdAt` | Owner-only read. |
| `ChatMessage` | `conversation`, `role`, `text`, `cards` (JSON), `links` (JSON), `toolCalls` (JSON), `modelId`, `inputTokens`, `outputTokens`, `verified` | |
| `LlmCallLog` | `agent`, `caseId`, `modelId`, `promptVersion`, `inputTokens`, `outputTokens`, `cacheReadTokens`, `latencyMs`, `stopReason`, `fallbackUsed` | §5.2 logging. No prompt text with unmasked data. |
| `IdempotencyKey` | `key`, `action`, `caseId`, `result`, `createdAt` | Rule 7. |

Case timeline is a **view** over `AuditLog` (defined in Phase 2), not a table.

## 3. Configuration tables (`db/config.cds`)

| Table | Content | Seed |
|---|---|---|
| `DeliveryPriorityLane` | `deliveryPriority` → `lane` | `01` HIGH, `02` MEDIUM, `03`… NORMAL, blank NORMAL (§7 A2) |
| `CustomerContract` | `customer`, `clauseText`, `language`, `tone` | C-1001 clause with "2% of order value per day late" |
| `PlanningParameters` | `plant`, `frozenHorizonDays`, `excessDaysOfSupplyThreshold`, `maxToolCallsPerQuestion` | 1000: 3 days; threshold e.g. 90 days; 6 |
| `ScoringWeights` | `w1`…`w6` | Defaults chosen so scenario 1 ranks O-ALT above O-MOVE |
| `LotSizePolicy` | `material`, `plant`, `policy` (EXACT / FIXED), `fixedLotSize` | FG-100 EXACT (§8.3 sc. 1) |

## 4. Demo data (§8) as seed and mock files

**Rule:** one source of truth for each fact. CAP seed CSVs hold case-domain config; adapter mock JSON holds "S/4" data. Write a consistency test that loads both and checks the shared facts.

| File | Content (from §8) |
|---|---|
| `mock-data/customers.json` | C-1001 ABC Automotive (penalty clause), C-1002 Delta Machines, C-1003 Nova Retail |
| `mock-data/materials.json` | FG-100 Gearbox Assembly, SFG-200 Gear Housing, RAW-1 Aluminium Casting, RAW-2 Bearing Set, FG-300 Pump Unit; MRP lot-size data |
| `mock-data/bom.json` | FG-100 → 1 SFG-200; SFG-200 → 1.05 RAW-1 + 0.05 RAW-2 |
| `mock-data/stock.json` | Plant 1000: FG-100 0, SFG-200 0, RAW-1 150, RAW-2 20, FG-300 20. Plant 1100: FG-300 200, last movement D-120, demand 25/month |
| `mock-data/work-centers.json` | WC-MACH-01 200/day, WC-ASSY-01 100/day (primary FG-100), WC-ASSY-02 80/day (alternative production version) |
| `mock-data/load.json` | §8.2 table, D+1…D+5 (and D+6…D+10 at low load so O-MOVE can be simulated) |
| `mock-data/scheduled-orders.json` | SO-5001 on WC-ASSY-01 D+1; SO-5004 NORMAL 100 × FG-100 on WC-ASSY-01 D+2, due D+9 |
| `mock-data/sales-orders.json` | SO-5001, SO-5004, SO-5005 (C-1001, 100 × FG-100, prio `01`, req. D+5), SO-5006 (C-1002, 50 × FG-300, prio `02`, req. D+6), SO-5007 (C-1003, 10 × FG-300, prio `03`) |
| `mock-data/receipts.json` | Empty for FG-100 (no open receipts in sc. 1) |
| `mock-data/scenario-overrides/sc4-assy02-down.json` | WC-ASSY-02 capacity 0 for D+1…D+5 (scenario 4) |

**Relative dates.** All dates are stored as offsets (`D+5`) and resolved by one `demoClock` module (`srv/lib/demo-clock.js`) at load time. Tests freeze the clock. Never call `new Date()` directly in tools.

## 5. Roles and authorization skeleton

`xs-security.json` scopes and role templates:

| Role template | Scope | Who |
|---|---|---|
| `Sales` | `Sales` | Sales reps / Customer Service |
| `SupplyPlanner` | `SupplyPlanner` | Supply Chain Planners |
| `ProductionPlanner` | `ProductionPlanner` | Production Planners |

Optional attribute `plant` for later plant-level restriction (pilot). Mocked users in `[development]`: `sales@demo`, `scp@demo`, `pp@demo`.

## 6. First deploy skeleton (recommended)

Push a minimal `mta.yaml` (CAP srv + XSUAA) to CF trial at the end of this phase or Phase 2. This flushes out memory quota, buildpack and Node version issues early.

## Checklist (rules)

- [ ] No `@anthropic-ai/sdk` import outside `srv/llm/` (add an ESLint `no-restricted-imports` rule now).
- [ ] No word "copilot" in code, UI texts or i18n (add a CI grep check over `app/`, `srv/`, `db/`; the rule statements in `blueprints/`, `development-plan/` and `CLAUDE.md` are excluded).
- [ ] `.env` / `default-env.json` git-ignored.
- [ ] §8 data entered once per fact; consistency test added.

## Exit criteria

- [ ] `cds watch` starts with SQLite and seeded data; all entities browsable via `$metadata`.
- [ ] Test harness runs in CI (one smoke test, one data consistency test).
- [ ] Demo clock resolves `D+n` offsets deterministically in tests.
- [ ] `CLAUDE.md` lists build, test and run commands.

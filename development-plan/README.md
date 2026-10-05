# Development Plan: Sales-to-Planning Order Confirmation Agents

This is the step-by-step build plan for `sap-sales-order-confirmation`. The **what** and **why** are in [`blueprints/blueprint-without-aicore.md`](../blueprints/blueprint-without-aicore.md) (the BTP trial variant). This plan is the **how** and **in which order**. Section references (§n) point to that blueprint. If the plan and the blueprint disagree, the blueprint wins and the plan gets fixed.

The plan follows the same build order as `sap-cap-tm-dispatch-cockpit`: first a deterministic CAP app that runs fully on mocks, then the Fiori apps one by one, then BTP deployment, and only then the LLM (agent texts and the Order Assistant). It does **not** follow the blueprint's §9 roadmap phases.

## Phases

| Phase | Document | Goal |
| --- | --- | --- |
| 0 | [Setup and API verification](phase-0-setup.md) | A CAP project that starts with mocked S/4 services and returns the §8 demo orders. Also holds the **real S/4 names** table. |
| 1 | [Core model and A1 Case Orchestrator](phase-1-core-model.md) | The local case model, the case rules enforced on every action, the audit log and timeline, and the three case services. |
| 2 | [Tools and deterministic agent logic](phase-2-tools-agent-logic.md) | A2–A5 run end to end **without an LLM**: lanes, supply ladder, capacity options and scores, template texts, simulated S/4 events. |
| 3 | [Fiori app 1, Supply Planning Workbench](phase-3-supply-workbench.md) | The supply planner works the HIGH/MEDIUM worklist and decides in the UI. |
| 4 | [Fiori app 2, Production Capacity Workbench](phase-4-production-workbench.md) | A production check requested by the supply planner shows up for the production planner and can be decided. |
| 5 | [Fiori app 3, Sales Order Feasibility](phase-5-sales-feasibility.md) | Sales sees its orders and confirms to the customer; scenarios 1–5 work across all three apps locally. |
| 6 | [Hybrid mode and BTP deployment](phase-6-deployment.md) | The apps run on BTP trial in Work Zone, against the real sandbox for every S/4 API that has one. |
| 7 | [LLM client and agent reasoning](phase-7-llm-agents.md) | A2–A5 get their Claude steps (summaries, explanations, drafts) through one LLM client module, with the template texts as fallback. |
| 8 | [Order Assistant](phase-8-order-assistant.md) | The read-only chat app in Work Zone answers questions about cases with data cards and deep links (scenario 6). |
| 9 | [Demo readiness](phase-9-demo-readiness.md) | All six §8.3 scenarios run in the cloud, with a demo reset and a runbook. |
| 10 | [Extras (optional, real S/4)](phase-10-extras.md) | `s4` adapters, real events, write-back proposals, HANA, MCP server for local development. |

## Ground rules

- **Work on `main`.** A phase counts as done when its exit criteria pass. Tick off each checkbox in the phase file as it is done.
- **No unit tests (this is a demo).** No jest, no `cds.test`, no `*.test.js` and no `.http` files. Everything is verified by hand under `cds watch`, through the CAP server index page (`http://localhost:4004`, with its Fiori preview) and, from phase 3 on, the apps.
- **The mock profile always works.** `cds watch` with no credentials and no Anthropic key must keep serving the full app after every phase. From phase 7 on, the LLM `mock` mode returns the template texts.
- **S/4 stays read-only.** Agents recommend, people decide in Fiori, and nothing writes to S/4HANA. Write-back is a phase 10 extra and never targets the sandbox.
- **A1 is the only writer of case status.** Every action writes an audit row in the same transaction. Reject and frozen-horizon override need a reason.
- **Numbers come from tools.** Quantities, dates, loads and scores come from deterministic functions, never from LLM text.
- **Field names:** the blueprint uses API names but not property names. After `cds import`, use the real EDMX names everywhere (see the table in [phase 0](phase-0-setup.md#real-s4-names)).
- **Dates** are relative to the demo day (D+n, §8). One `demo-clock` helper resolves them; never call `new Date()` in rules or tools. Timestamps are stored in UTC.
- **Four apps only:** three case apps plus the Order Assistant. No analytical apps, dashboards or KPI cockpit. Never use the word "copilot".
- **Claude runs development commands; the user runs BTP, build and deploy commands** (`mbt build`, `cf …`, `cds bind`, cockpit actions). Claude prepares the config and gives the exact commands.
- **Never commit keys** (Hub API key, Anthropic API key). They live in a BTP destination, a user-provided service or a git-ignored `.env`.

## Verification summary

All checks are manual. There are no unit tests.

| Layer | Tool | Location | Covers |
| --- | --- | --- | --- |
| Case rules | CAP index page | `http://localhost:4004` | Scenario 1 status path, forbidden steps: wrong user, missing reason, confirm to customer in a non-allowed status |
| Tools and agents | CAP index page | `http://localhost:4004` | Scenarios 1–5 with the §8.3 golden values: BOM, supply ladder, O-ALT / O-MOVE loads, earliest date D+7 |
| LLM guards | `cds watch --profile hybrid` + `LlmCallLog` | – | Masking, number check, fallback to template text (forced failures) |
| Order Assistant | Order Assistant app | Work Zone site | Scenario 6 questions, a case the user may not see, an action request |
| UI | Manual, per phase exit | – | The flows listed in each exit criterion |

## Comparison with `sap-cap-tm-dispatch-cockpit`

| Topic | TM Dispatch Cockpit | This project |
| --- | --- | --- |
| S/4 edition and APIs | Public Cloud, OData V4 `CE_FREIGHT*_0001` | Private Cloud, mostly OData V2 `API_*_SRV` (§4.2); check each one's version at import |
| Link between S/4 and the app | Freight order ID | Sales order + item → case `FC-nnnn` |
| Local rules | `award-rules.js` | `case-rules.js` (A1 state machine) + pure tool functions (A3/A4) |
| Apps | 2 Fiori elements apps + 1 analytics extra | 3 Fiori elements case apps, no analytics (§6) |
| Chat | TM Assistant over `@cap-js/agents` (A2A, HITL actions) | Order Assistant, **read-only**, `OrderAssistantService` + Claude tool use (§6.2) |
| LLM access | `@cap-js/agents` with `kind: anthropic` | One LLM client module on `@anthropic-ai/sdk` (§4.4, §5.2); see open decision 1 |
| Persistence on trial | HANA Cloud | SQLite reseeded at start by default (§4.1); see open decision 2 |
| Agent writes | Actions with human approval in chat | None. All actions only in the Fiori apps |

## Open decisions

| # | Decision | Decide in |
| --- | --- | --- |
| 1 | LLM integration: the blueprint's own LLM client module on `@anthropic-ai/sdk` (default in this plan), or `@cap-js/agents` with `kind: anthropic` as in the TM project. The plugin fits a chat agent with approvals; here the agents make single structured calls and the Order Assistant has no actions, so the plain SDK is the simpler fit. Changing this needs a blueprint update first | Phase 7.0 |
| 2 | Persistence on trial: SQLite reseeded at every start (blueprint default, a restart resets the demo) or HANA Cloud trial as in the TM project (survives restarts, stops every night) | Phase 6 |
| 3 | Behaviour if a §4.2 API has no usable sandbox data or no sandbox at all (stays mock-only on BTP) | Phase 0.1 |
| 4 | Delivery priority keys for HIGH / MEDIUM / NORMAL (§10.2). Default `01` / `02` / `03`+blank | Phase 1 |
| 5 | Frozen horizon length and who may override it (§10.4). Default 3 days, Production Planner | Phase 2 |
| 6 | Models and effort per agent (§10.7). Default `claude-opus-5-5`; cheaper options measured in phase 9 | Phase 7, 9 |

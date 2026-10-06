# Development Plan: Sales-to-Planning Order Confirmation Agents

This is the step-by-step build plan for `sap-sales-order-confirmation`. The **what** and **why** are in [`blueprints/blueprint-without-aicore.md`](../blueprints/blueprint-without-aicore.md) (the BTP trial variant). This plan is the **how** and **in which order**. Section references (§n) point to that blueprint. If the plan and the blueprint disagree, the blueprint wins and the plan gets fixed.

The plan follows the same build order as `sap-cap-tm-dispatch-cockpit`: first a deterministic CAP app that runs fully on mocks, then the Fiori apps one by one, then the LLM (agent texts and the Order Assistant), all locally, and only then BTP deployment. It does **not** follow the blueprint's §9 roadmap phases.

## Phases

| Phase | Document | Goal |
| --- | --- | --- |
| 0 | [Setup and API verification](phase-0-setup.md) | A CAP project that starts with mocked S/4 services and returns the §8 demo orders. Also holds the **real S/4 names** table. |
| 1 | [Core model and A1 Case Orchestrator](phase-1-core-model.md) | The local case model, the case rules enforced on every action, the audit log and timeline, and the three case services. |
| 2 | [Tools and deterministic agent logic](phase-2-tools-agent-logic.md) | A2–A5 run end to end **without an LLM**: lanes, supply ladder, capacity options and scores, template texts, simulated S/4 events. |
| 3 | [Fiori app 1, Supply Planning Workbench](phase-3-supply-workbench.md) | The supply planner works the HIGH/MEDIUM worklist and decides in the UI. |
| 4 | [Fiori app 2, Production Capacity Workbench](phase-4-production-workbench.md) | A production check requested by the supply planner shows up for the production planner and can be decided. |
| 5 | [Fiori app 3, Sales Order Feasibility](phase-5-sales-feasibility.md) | Sales sees its orders and confirms to the customer; scenarios 1–5 work across all three apps locally. |
| 6 | [A2–A5 as CAP agents](phase-6-llm-agents.md) | A2–A5 become CAP agents on `@cap-js/agents` and get their Claude steps (summaries, explanations, drafts), with the template texts as fallback. |
| 7 | [Order Assistant](phase-7-order-assistant.md) | The read-only chat app answers questions about cases with data cards and deep links (scenario 6). |
| 8 | [Hybrid mode and BTP deployment](phase-8-deployment.md) | All four apps run on BTP trial in Work Zone; the Live data dialog reads the S/4HANA CAL system. |
| 9 | [Demo readiness](phase-9-demo-readiness.md) | All six §8.3 scenarios run in the cloud, with a demo reset and a runbook. |
| 10 | [Extras (optional, real S/4)](phase-10-extras.md) | `s4` adapters, real events, write-back proposals, HANA, MCP server for local development. |

## Ground rules

- **Work on `main`.** A phase counts as done when its exit criteria pass. Tick off each checkbox in the phase file as it is done.
- **No unit tests (this is a demo).** No jest, no `cds.test`, no `*.test.js` and no `.http` files. Everything is verified by hand under `cds watch`, through the CAP server index page (`http://localhost:4004`, with its Fiori preview) and, from phase 3 on, the apps.
- **The mock profile always works.** `cds watch` with no credentials and no Anthropic key must keep serving the full app after every phase. From phase 6 on, `cds.requires.llm` is `llm-mock` there, and A2–A5 use their template texts without calling the agent.
- **S/4 stays read-only.** Agents recommend, people decide in Fiori, and nothing writes to S/4HANA. The CAL system is writable, but its technical user is display-only. Write-back is a phase 10 extra.
- **A1 is the only writer of case status.** Every action writes an audit row in the same transaction. Reject and frozen-horizon override need a reason.
- **Numbers come from tools.** Quantities, dates, loads and scores come from deterministic functions, never from LLM text.
- **Field names:** the blueprint uses API names but not property names. After `cds import`, use the real EDMX names everywhere (see the table in [phase 0](phase-0-setup.md#real-s4-names)).
- **Dates** are relative to the demo day (D+n, §8). One `demo-clock` helper resolves them; never call `new Date()` in rules or tools. Timestamps are stored in UTC.
- **Four apps only:** three case apps plus the Order Assistant. No analytical apps, dashboards or KPI cockpit. Never use the word "copilot".
- **Claude runs development commands; the user runs BTP, build and deploy commands** (`mbt build`, every `cf …` command, including read-only ones like `cf apps`, `cds bind`, cockpit actions). Claude prepares the config and gives the exact commands, one step at a time, each with what it does, why it is needed, and what to look for in the output. The user is learning BTP and Cloud Foundry.
- **Never commit credentials** (CAL technical user, Anthropic API key). They live in a BTP destination, a user-provided service or a git-ignored `.env`.

## Verification summary

All checks are manual. There are no unit tests.

| Layer | Tool | Location | Covers |
| --- | --- | --- | --- |
| Case rules | CAP index page | `http://localhost:4004` | Scenario 1 status path, forbidden steps: wrong user, missing reason, confirm to customer in a non-allowed status |
| Tools and agents | CAP index page | `http://localhost:4004` | Scenarios 1–5 with the §8.3 golden values: BOM, supply ladder, O-ALT / O-MOVE loads, earliest date D+7 |
| LLM guards | `cds watch --profile hybrid` + `Recommendation.fallbackReason` | – | Masking, number check, fallback to template text (forced failures) |
| Order Assistant | Order Assistant app | Locally (phase 7), then the Work Zone site | Scenario 6 questions, a case the user may not see, an action request |
| UI | Manual, per phase exit | – | The flows listed in each exit criterion |

## Comparison with `sap-cap-tm-dispatch-cockpit`

| Topic | TM Dispatch Cockpit | This project |
| --- | --- | --- |
| S/4 edition and APIs | Public Cloud, OData V4 `CE_FREIGHT*_0001` | Private Cloud, OData V2 `API_*` (§4.2); all eight downloaded EDMX files are V2 |
| Link between S/4 and the app | Freight order ID | Sales order + item → case `FC-nnnn` |
| Local rules | `award-rules.js` | `case-rules.js` (A1 state machine) + pure tool functions (A3/A4) |
| Apps | 2 Fiori elements apps + 1 analytics extra | 3 Fiori elements case apps, no analytics (§6) |
| Chat | TM Assistant over `@cap-js/agents` (A2A, HITL actions, token streaming) | Order Assistant on the same plugin and A2A, but **read-only** (no actions, no approvals) and with progress steps instead of token streaming, so only checked answers are shown (§6.2) |
| LLM access | `@cap-js/agents` with `kind: anthropic` | The same for A2–A5 and the Order Assistant (open decision 1). A2–A5 are internal agents called from CAP code (`srv.chat`), not chat agents for users |
| Persistence on trial | HANA Cloud | SQLite reseeded at start by default (§4.1); see open decision 2 |
| Agent writes | Actions with human approval in chat | None. All actions only in the Fiori apps |

## Open decisions

| # | Decision | Decide in |
| --- | --- | --- |
| 1 | LLM integration. **Decided 2026-10-06:** everything on `@cap-js/agents` with `kind: anthropic`, as in the TM project; no `@anthropic-ai/sdk`. A2–A5 are internal CAP agents (`@requires: 'internal-user'`, read-only functions, called with `srv.chat`, template fallback). The Order Assistant is a read-only A2A agent with progress steps instead of token streaming. The plugin points this depends on are checked in the phase 6.0 and 7.0 spikes | Done (spikes in 6.0 and 7.0) |
| 2 | Persistence on trial: SQLite reseeded at every start (blueprint default, a restart resets the demo) or HANA Cloud trial as in the TM project (survives restarts, stops every night) | Phase 8 |
| 3 | Behaviour if a §4.2 API cannot be activated in the CAL system or has no usable data there. Default: that API stays mock-only on BTP and the Live data dialog shows the `mock` badge for it. (The Hub sandbox is not used: blueprint §4.3) | Phase 0.8 |
| 4 | Delivery priority keys for HIGH / MEDIUM / NORMAL (§10.2). Default `01` / `02` / `03`+blank | Phase 1 |
| 5 | Frozen horizon length and who may override it (§10.4). **Decided 2026-10-06** for the demo: 3 days, Production Planner (phase 2.0) | Done |
| 6 | Models and effort per agent (§10.7). Default `claude-opus-5-5`; cheaper options measured in phase 9 | Phase 6, 9 |
| 7 | Capacity load per day: §4.2 assumes no standard API, but `API_WORK_CENTERS` has the capacity evaluation `A_WorkCenterCapPerBucket` (load per work center and bucket, in time units). It can be tested in the CAL system (phase 0.8). Default: the demo keeps the local `CapacityLoad` mock (scripted §8 values in pieces per day) with field names that mirror the API; the pilot tries the API before building a custom CDS view (phase 10). Mentioning it in §4.2 needs a blueprint update first | Phase 10 |
| 8 | How BTP reaches the CAL system (blueprint §10.9): internet destination with basic auth if the Gateway port is reachable from outside, otherwise a Cloud Connector. Default: internet destination | Phase 0.8 |
| 9 | Create the §8 story in the CAL system too (blueprint §10.10), or use CAL only for live reads of its standard data. Default: live reads only; the scripted scenarios stay on mocks | Phase 9 |

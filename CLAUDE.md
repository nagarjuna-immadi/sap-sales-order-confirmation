# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

The project is being scaffolded (phase 0 of `development-plan/`). The source of truth is `blueprints/blueprint-without-aicore.md` (the BTP trial variant the demo is built on). `blueprints/blueprint-with-aicore.md` is the AI Core variant: it is the reference for a later move to AI Core and Joule, and it shares the process, agents, case apps, business rules and demo data. `blueprints/High_Priority_Sales_Order_Communication_Agent_Design.pdf` is an outdated draft: don't use it, and don't refer to it. Keep the commands below up to date as code is added.

## Commands

- `npm install`: install dependencies.
- `npm run watch`: local dev server (`cds watch`) on mock data and SQLite, at `http://localhost:4004`.
- `npm run watch-supply-workbench`: `cds watch` and opens the Supply Planning Workbench (`/order.conf.supplyworkbench/index.html`; sandbox launchpad at `/order.conf.supplyworkbench/test/flp.html`).
- `npm run watch-hybrid`: local server against bound BTP services (`cds watch --profile hybrid`; the Anthropic key from `.env` from phase 6, the CAL credentials and binding set up by the user in phase 8).
- `node scripts/gen-mock-data.js [--base YYYY-MM-DD]`: regenerate the S/4 mock CSVs in `srv/external/data/` (blueprint §8; dates relative to the base date, default today).
- `npm start`: production start (`cds-serve`), used by Cloud Foundry.
- `npm run lint`: ESLint, including the rule that forbids `@anthropic-ai/sdk` (all Claude calls go through `@cap-js/agents`).
- `npm run check:wording`: fails if "copilot" appears in `app/`, `srv/` or `db/`.

There is no CI: run `npm run check:wording` and `npm run lint` by hand before committing.

## What is being built

Sales-to-Planning order confirmation agents on **SAP BTP**. They replace phone and email between Sales, Supply Chain Planning and Production Planning with one shared **Order Feasibility Case** (`FC-nnnn`, child capacity requests `CR-nnnn`). The first deliverable is a **demo** with mock data. A pilot on real S/4HANA data comes later.

Landscape (blueprint §0): SAP S/4HANA **Private Cloud**. The demo takes the API metadata (EDMX) from SAP Business Accelerator Hub and does not use the Hub sandbox. **No Advanced ATP and no embedded PP/DS** (basic ATP, classic capacity planning). Lane priority comes from the item-level **delivery priority**, through a configurable mapping table.

Data adapters have two modes: `mock` (§8 demo data on the CDS model imported from the Hub EDMX; scripted scenarios, offline demo) and `s4` (BTP destination with a read-only technical user; for the demo this is an S/4HANA system in SAP Cloud Appliance Library (CAL), and for the pilot the customer's Private Cloud through Cloud Connector; never commit credentials). The CAL system has SAP's standard demo data, not the §8 story, so the scripted scenarios run in `mock` and CAL serves the "live data" view. S/4 events are simulated in the demo.

Planned stack (see blueprint §4–§5): SAP BTP trial, CAP (Node.js) on Cloud Foundry, SAP Fiori elements apps in SAP Build Work Zone, the Anthropic Claude API called from CAP through the CAP agent plugin `@cap-js/agents` (`kind: anthropic`, as in the TM project; no `@anthropic-ai/sdk`): A2–A5 are internal agents called from CAP code, the Order Assistant is served over A2A, and SQLite for the demo (SAP HANA Cloud optional). No SAP AI Core and no Joule: the **Order Assistant** chat app replaces Joule. Event Mesh is not on trial, so S/4 events are simulated.

## Rules that must hold in code

- Never run `cf`, `mbt` or `cds bind` commands, not even read-only ones, and never do BTP cockpit steps. Give the user the exact command, one step at a time, with what it does, why it is needed and what to look for in the output: the user runs it to learn BTP and Cloud Foundry.
- No unit tests: this is a demo. Don't add jest, `cds.test`, `*.test.js` or `.http` files. The user verifies by hand under `cds watch`, through the CAP server index page (`http://localhost:4004`, with its Fiori preview) and the apps.
- Five agents: A1 Case Orchestrator (deterministic, no LLM, the only writer of case status; also owns the append-only audit log and the case timeline), A2 Order Intake & Prioritization, A3 Supply & Inventory, A4 Capacity & Load Balancing, A5 Communication. All five live in `srv/agents/<name>/` (A1 in `feasibility-case-orchestrator/`); the Order Assistant, also a CAP agent, is in `srv/agents/order-assistant/`; shared code is in `srv/lib/`.
- Demo has exactly four Fiori apps: three case apps (Sales Order Feasibility, Supply Planning Workbench, Production Capacity Workbench) and the **Order Assistant** chat app (SAPUI5 freestyle, blueprint §6.2). No analytical apps, dashboards or KPI cockpit.
- The Order Assistant is read-only and not a sixth case agent: `OrderAssistantService` (`@agent` service in `srv/agents/order-assistant/`) has read-only projections and functions only, no actions, makes no recommendations and has no path to any action. When asked to act, it answers with a deep link to the case app. Token streaming stays off: the app shows progress steps, then the answer once the number check has passed.
- Never use the word "copilot" for these agents or the Order Assistant.
- Agents recommend. Humans confirm or reject through Fiori actions. Agents never change status, never send to customers and never write to S/4HANA directly.
- Numbers, dates and quantities come from deterministic tool functions, never from LLM text.
- Every action writes an audit row in the same transaction as the status change. Reject and frozen-horizon override require a reason.
- Data access goes through adapters (mock or S/4 API), so the demo and the pilot share the same agent logic.
- The demo data and scenarios in blueprint §8 must stay consistent across mock files.

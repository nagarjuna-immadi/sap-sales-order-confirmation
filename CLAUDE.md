# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

There is no code yet, so no build, lint or run commands exist. The source of truth is `blueprints/blueprint-without-aicore.md` (the BTP trial variant the demo is built on). `blueprints/blueprint-with-aicore.md` is the AI Core variant: it is the reference for a later move to AI Core and Joule, and it shares the process, agents, case apps, business rules and demo data. `blueprints/High_Priority_Sales_Order_Communication_Agent_Design.pdf` is an outdated draft: don't use it, and don't refer to it. When code is added, put its build and run commands here.

## What is being built

Sales-to-Planning order confirmation agents on **SAP BTP**. They replace phone and email between Sales, Supply Chain Planning and Production Planning with one shared **Order Feasibility Case** (`FC-nnnn`, child capacity requests `CR-nnnn`). The first deliverable is a **demo** with mock data. A pilot on real S/4HANA data comes later.

Landscape (blueprint §0): SAP S/4HANA **Private Cloud**. The demo uses the SAP Business Accelerator Hub **sandbox** APIs. **No Advanced ATP and no embedded PP/DS** (basic ATP, classic capacity planning). Lane priority comes from the item-level **delivery priority**, through a configurable mapping table.

Data adapters have three modes: `mock` (scripted demo data, offline demo), `sandbox` (sandbox.api.sap.com, `APIKey` header; never commit the key), and `s4` (destination + Cloud Connector). The sandbox is shared read-only data with no live events, so the demo scenarios run in `mock` and S/4 events are simulated in the demo.

Planned stack (see blueprint §4–§5): SAP BTP trial, CAP (Node.js) on Cloud Foundry, SAP Fiori elements apps in SAP Build Work Zone, the Anthropic Claude API called from CAP through one LLM client module (`@anthropic-ai/sdk`; agents never import the SDK directly), and SQLite for the demo (SAP HANA Cloud optional). No SAP AI Core and no Joule: the **Order Assistant** chat app replaces Joule. Event Mesh is not on trial, so S/4 events are simulated.

## Rules that must hold in code

- No unit tests: this is a demo. Don't add jest, `cds.test`, `*.test.js` or `.http` files. The user verifies by hand under `cds watch`, through the CAP server index page (`http://localhost:4004`, with its Fiori preview) and the apps.
- Five agents: A1 Case Orchestrator (deterministic, no LLM, the only writer of case status; also owns the append-only audit log and the case timeline), A2 Order Intake & Prioritization, A3 Supply & Inventory, A4 Capacity & Load Balancing, A5 Communication.
- Demo has exactly four Fiori apps: three case apps (Sales Order Feasibility, Supply Planning Workbench, Production Capacity Workbench) and the **Order Assistant** chat app (SAPUI5 freestyle, blueprint §6.2). No analytical apps, dashboards or KPI cockpit.
- The Order Assistant is read-only and not a sixth agent: `OrderAssistantService` calls Claude with read-only tools only, makes no recommendations and has no path to any action. When asked to act, it answers with a deep link to the case app.
- Never use the word "copilot" for these agents or the Order Assistant.
- Agents recommend. Humans confirm or reject through Fiori actions. Agents never change status, never send to customers and never write to S/4HANA directly.
- Numbers, dates and quantities come from deterministic tool functions, never from LLM text.
- Every action writes an audit row in the same transaction as the status change. Reject and frozen-horizon override require a reason.
- Data access goes through adapters (mock or S/4 API), so the demo and the pilot share the same agent logic.
- The demo data and scenarios in blueprint §8 must stay consistent across mock files.

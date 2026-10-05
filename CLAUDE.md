# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

There is no code yet, so no build, lint or test commands exist. The only source of truth is `High_Priority_Sales_Order_Communication_Agent_Design.pdf`, the demo design spec. Extract its text with `pdftotext -layout High_Priority_Sales_Order_Communication_Agent_Design.pdf -` (poppler's `pdftotext` is on PATH under Git Bash; `pdftoppm` is not installed, so the Read tool cannot render the PDF). `blueprint.md` breaks the spec into six agents (Orchestrator, Sales/Planning/Scheduler copilots, Notification, Audit & Timeline) and records demo-data choices and open questions. The spec does not choose a tech stack. When one is chosen, add its build, test and run commands here.

## What is being built

A demo orchestration agent for a human-in-the-loop approval chain on a high-priority sales order: **Sales → Planning → Production Scheduler → Planning → Sales**. The agent routes requests, sends notifications, enforces status transitions and keeps an audit trail. **It never makes business decisions itself.** Confirming the SO or rescheduling production is always an explicit Confirm/Reject action by a human role.

Out of scope: Company Planner, ATP engines, SAP integration, automatic rescheduling, optimization and real production transactions. All data (stock, orders, BOM, capacity) comes from mock JSON, an in-memory DB or demo tables. Keep data access behind a service layer so real APIs can replace it later without changing the approval flow.

## Connected demo data (must stay consistent)

`CUST-1001` (ABC Automotive) → `SO-005` (HIGH, FG-100, qty 100) → `FG-100` (stock 0) → `SFG-200` (stock 0) → `RAW-1` (stock 150, need 105) + `RAW-2` (stock 20, need 5).
`SO-004` (NORMAL, FG-100, qty 100) is the planned order that may be moved behind SO-005.
FG and SFG are short but both raw materials are available, so Planning does not reject. It asks the Production Scheduler whether SO-004 can be rescheduled.

## Request model

- Parent feasibility request `REQ-xxx`, owned by Sales.
- Child scheduling request `SCH-xxx`. It **must always reference its parent** (`parentRequestId`). Scheduler decisions update the parent's status.
- Every screen shows the same request ID and linkage, so the whole flow reads as one traceable business case.
- Payload shapes (feasibility request, planning stock result, scheduler request/decision, final planning response) are in spec §7. Use those field names (`requestId`, `scheduleRequestId`, `parentRequestId`, `planningAction: "REQUEST_PRODUCTION_CHECK"`, `decision: "CONFIRM"|...`, etc.).

## Status state machine (spec §6)

| Status | Waiting for | Allowed next |
|---|---|---|
| DRAFT | Sales | WAITING_FOR_PLANNING |
| WAITING_FOR_PLANNING | Planning | WAITING_FOR_PRODUCTION, REJECTED_BY_PLANNING |
| WAITING_FOR_PRODUCTION | Production Scheduler | PRODUCTION_CONFIRMED, REJECTED_BY_PRODUCTION |
| PRODUCTION_CONFIRMED | Planning | PLANNING_CONFIRMED, REJECTED_BY_PLANNING |
| PLANNING_CONFIRMED | Sales | COMPLETED |
| REJECTED_BY_PRODUCTION | Planning | REJECTED_BY_PLANNING, or resubmit scheduler request |
| REJECTED_BY_PLANNING | Sales | closed / new request |
| COMPLETED | none | final |

Business rules the agent must enforce (reject invalid transitions, don't just hide buttons):
- Sales "Confirm Sales Order" is allowed only when the request is `PLANNING_CONFIRMED`.
- Planning Confirm is blocked if a scheduler check was requested and the scheduler has not confirmed.
- Every Confirm/Reject records acting role/user, timestamp, comment and previous/new status in the audit log.
- Reject requires a reason. Confirm takes an optional comment. Rejections go back to the preceding team with the reason.

## Orchestration handlers (spec §10)

`onSalesSubmit` → `onPlanningStockCheck` (reject, or create SCH + parent → WAITING_FOR_PRODUCTION) → `onSchedulerDecision` (parent → PRODUCTION_CONFIRMED / REJECTED_BY_PRODUCTION, notify Planning) → `onPlanningDecision` → `onSalesConfirm` (→ COMPLETED, notify Planning + Scheduler, view-only). The notification recipients, content and available actions for each trigger are in spec §8.

## Suggested screens (spec §9)

Sales Worklist, Planning Inbox (with the FG→SFG→RAW material tree), Production Scheduler Inbox (with a resource/load panel), Request Timeline, and Notification Center (with deep links to the request). The acceptance criteria are in spec §11.

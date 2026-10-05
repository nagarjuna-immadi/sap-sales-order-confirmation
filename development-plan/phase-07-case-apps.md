# Phase 7 · Case apps (Fiori elements)

**Goal.** The three case apps, each built for one team, all showing the same case ID, the same timeline and "Suggested by agent" recommendations, with actions that call A1.

**Duration.** 6–8 days.

**Depends on.** Phase 1 (model). Finishing needs Phases 2, 5, 6.

**Blueprint.** §2.2 (worklist sort), §6.1, §8.3.

**Scope limit.** Exactly these three apps plus the Order Assistant (Phase 8). No analytical apps, dashboards or KPI cockpit.

---

## 1. Shared building blocks

| Item | Detail |
|---|---|
| Generator | SAP Fiori tools (BAS / VS Code), OData V4, Fiori elements; apps under `app/sales-feasibility`, `app/supply-workbench`, `app/production-workbench`. |
| Header | Case ID `FC-nnnn` and child `CR-nnnn`, lane badge (HIGH / MEDIUM / NORMAL with criticality colors), status, waiting-for role, penalty-risk flag. |
| Case Timeline section | Same reusable annotation on all three object pages, bound to `CaseTimeline` (Phase 2): step, actor, role, timestamp, duration, comment/reason, refused actions highlighted. |
| Recommendation section | Agent, recommended option, rationale, confidence, label **"Suggested by agent"**, plus "LLM unavailable" / "template text" indicator when `llmUsed = false`. |
| Notifications | Header button with a popover list of `Notification` rows for the user's role (A5), with deep links. |
| "Ask about this case" | Header button that navigates to the Order Assistant with `caseId` as a parameter (Phase 8). |
| Worklist sort | Default `PresentationVariant`: `laneRank` asc, `requestedDate` asc. |
| Actions | Bound actions with `@Core.OperationAvailable` driven by status and role (UX only; A1 enforces server-side). Reject and override use action parameter dialogs with **mandatory** `reason`. Optional `comment` on confirms. ETag + idempotency key sent on every action. |
| Data source badge | Shows `mock` / `sandbox` from the tool result `source` field. |
| i18n | All texts in `i18n.properties`. Never "copilot". |

## 2. Sales Order Feasibility (Sales)

- **List report**: my open orders grouped by sales order, one row per case item; columns: case ID, sales order/item, customer, material, qty, requested date, lane, status, waiting for, penalty risk, confirmed date. Includes `AUTO_CONFIRMED` items (scenario 3).
- **Object page**: header, A2 summary, agent recommendation, confirmed date/qty, **drafted customer confirmation text** (editable text area bound to `customerDraft`), Case Timeline.
- **Actions**: Check feasibility · Confirm to customer (only `SUPPLY_CONFIRMED`, sends the edited draft text into the audit payload; does not email anyone) · Close (`REJECTED` → `CLOSED`).
- Scenario 5 check: if Sales triggers *Confirm to customer* in `WITH_PRODUCTION` (e.g. via the Order Assistant link or a stale page), A1 refuses and the timeline shows the refused action.

## 3. Supply Planning Workbench (Supply Chain Planners)

- **List report** worklist: HIGH first, then MEDIUM, then by requested date; filters for plant, lane, status.
- **Object page**:
  - Material tree (tree table) FG → SFG → RAW with required / available, stock in other plants, open receipts, excess and slow-moving flags, from the `SupplyResult` snapshot.
  - A3 recommendation with all feasible options ranked 1–5, the excess-inventory warning, the drafted production-check question.
  - Capacity request sub-section (CR status, chosen option, reason) when present.
  - Case Timeline.
- **Actions**: Confirm from stock · Approve stock transfer · Approve reallocation · Request production check · Reject (reason) · Confirm date to Sales.
- Tree table: use a hierarchy annotation on a flattened `SupplyTreeNode` projection of the snapshot, or a custom section with `sap.ui.table.TreeTable` if the hierarchy annotation is not sufficient on the available UI5 version.

## 4. Production Capacity Workbench (Production Planners)

- **List report**: open capacity requests sorted by parent case lane, then need-by date.
- **Object page** for `CapacityRequest`:
  - Option table: option ID, feasible, score, needs override, finish date, moved orders.
  - **Custom section** (SAPUI5 fragment, `sap.viz` / `sap.suite.ui.microchart` or `sap.gantt`): load per work center per day **before vs after** for the selected option, frozen-horizon marker (D+0…D+3), 100% line.
  - Impact on other orders (moved orders with old/new date vs due date).
  - A4 comparison text, Case Timeline (of the parent case).
- **Actions**: Choose option (comment) · Choose override option (reason, only for `needsOverride`) · Reject (reason).

## 5. "Live data" view (§4.3)

A read-only tab or dialog in each app that calls the same tools in `sandbox` mode for a sandbox material/order and shows the raw result with the "sandbox" badge. Purpose: prove the adapters work against real S/4HANA API payloads. Not part of the scripted scenarios.

## 6. Navigation

- Semantic objects: `FeasibilityCase` (Sales / Supply actions per role), `CapacityRequest`, `OrderAssistant`. Defined in each app's `manifest.json` `crossNavigation` inbounds and wired in Work Zone (Phase 9).
- Links to standard S/4 apps (*Manage Sales Orders*, *Monitor Material Coverage*, *Manage Work Center Capacity*) are **placeholders** in the demo (disabled with a tooltip) and become intent-based navigation in the pilot.

## 7. Tests

- [ ] OPA5 / wdi5 smoke test per app: list loads sorted by lane, object page opens, timeline renders.
- [ ] Action dialogs: reject without reason can't be submitted; server 400 shown properly if bypassed.
- [ ] Stale ETag → user-friendly "case changed, refresh" message.
- [ ] Each app runs locally against `cds watch` with mocked users.

## Checklist (rules)

- [ ] Only three case apps; no charts other than the capacity before/after custom section.
- [ ] Buttons hidden by status are UX only; A1 still enforces.
- [ ] Every recommendation labelled "Suggested by agent".
- [ ] No "copilot" in any text.

## Exit criteria

- [ ] Scenarios 1, 2, 3, 4, 5 can be clicked through locally with the three mock users.

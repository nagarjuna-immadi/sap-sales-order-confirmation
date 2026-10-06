# Phase 4: Fiori app 2, Production Capacity Workbench

[← Development plan](README.md) · Previous: [Phase 3](phase-3-supply-workbench.md) · Next: [Phase 5](phase-5-sales-feasibility.md)

**Goal:** a production check requested by the supply planner shows up for the production planner and can be decided (§6.1).

- [x] Generate a Fiori elements V4 **List Report + Object Page** on `ProductionService.CapacityRequests` in `app/production-workbench/`. Done 2026-10-06: written by hand in the generator's layout, like phase 3; app ID `order.conf.productionworkbench`.
- [x] `app/production-workbench/annotations.cds`:
  - `LineItem`: CR ID, case ID, material, quantity, need-by date, lane of the parent case, status, recommended option. Sorted by lane, then need-by date.
  - `HeaderInfo` / `HeaderFacets`: the shared case header from `srv/common-annotations.cds` plus CR status and need-by date. The case header is reached through the CR's `parentCase` (`parentCase/@UI.DataPoint#lane`, `…#status`, `…/@UI.FieldGroup#CaseHeader`).
  - Facets:
    - **Options**: table with option ID, feasible, score, needs override, finish date, moved orders. The recommended option is highlighted and labelled **"Suggested by agent"**. `CapacityOptions` is a `@cds.persistence.skip` entity built from `CapacityRequest.options` and the latest `CAPACITY_OPTIONS` recommendation (`production-service.js`), best score first; row criticality green (recommended), orange (needs override), red (not feasible).
    - **Load before / after**: custom section (UI5 fragment with `sap.viz` or `sap.suite.ui.microchart`, or `sap.gantt`) showing the load per work center per day for the selected option, with the frozen-horizon marker (D+0 … D+3) and the 100% line. This is the only chart in the demo. Decided: a `sap.viz` column chart (before / after per work center and day) in `ext/fragment/LoadChart.fragment.xml`, a reference line at 100%, frozen days labelled "D+n frozen" on the day axis and a note with the horizon. An option picker above it starts on the recommended option. The rows come from `OptionLoad` (built like the options) and are read by an object page controller extension (`ext/controller/LoadChart.controller.ts`) into a JSON model.
    - **Impact on other orders**: moved orders with old and new date against their due date. `MovedOrders`, one row per option and moved order, "Still on time" with criticality.
    - **Comparison**: the A4 comparison text.
    - **Case Timeline** of the parent case.
    - Added: **Decision** (chosen option, override, decided by / at, reason), so the outcome shows on the CR.
  - Actions: *Choose option* (comment), *Choose override option* (mandatory reason, only for options with `needsOverride`), *Reject* (mandatory reason). The option is an action parameter with a value help on `CapacityOptions` (the options of the OPEN CRs) and a default: the recommended option for *Choose option*, the best option that needs an override for *Choose override option*. The buttons follow `can<Action>` flags (case status, CR `OPEN`, and an option with / without `needsOverride`). Option and reasons are mandatory only on the client (`webapp/annotations/annotation.xml`), as in phase 3, so the orchestrator's refusals stay audited: choosing O-MOVE with *Choose option* is refused with `OVERRIDE_NEEDS_REASON` and shows in the timeline.
  - `Common.SideEffects` on the actions. They include `in/status` (the CR status text) and `in/parentCase` (the header); the Supply Planning Workbench's actions got `in/status` too, as its status text stayed stale after an action.
- [x] Notifications and *Ask about this case* header buttons, reused from phase 3 (`ext/controller/CaseActions.ts`, a copy with this app's own intent).
- [x] `crossNavigation` inbound per app (lesson from the TM project: the generator can give two apps the same intent). Use `FeasibilityCase-plan` (Supply Planning Workbench) and `CapacityRequest-decide` (Production Capacity Workbench), and make the A5 deep links use the same intents. A5's `INTENTS` also has `FeasibilityCase-track` for phase 5. The closure notice to Production (`CONFIRMED_TO_CUSTOMER`) now links to its CR, as the production planner cannot open the Supply Planning Workbench.
- [x] `watch-production-workbench` npm script.

**Exit criteria:** the cross-user flow works in both apps: `supplychain_user` requests the production check, `production_user` sees CR-0001 with O-ALT and O-MOVE and the before/after load, choosing O-MOVE without a reason is refused, `production_user` chooses O-ALT, and `supplychain_user` sees `PRODUCTION_CONFIRMED` and confirms the date to Sales. Scenario 4 (`setScenario('sc4-assy02-down')`): `production_user` rejects with a reason and `supplychain_user` sees the earliest date D+7.

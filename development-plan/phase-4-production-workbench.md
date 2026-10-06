# Phase 4: Fiori app 2, Production Capacity Workbench

[← Development plan](README.md) · Previous: [Phase 3](phase-3-supply-workbench.md) · Next: [Phase 5](phase-5-sales-feasibility.md)

**Goal:** a production check requested by the supply planner shows up for the production planner and can be decided (§6.1).

- [ ] Generate a Fiori elements V4 **List Report + Object Page** on `ProductionService.CapacityRequests` in `app/production-workbench/`.
- [ ] `app/production-workbench/annotations.cds`:
  - `LineItem`: CR ID, case ID, material, quantity, need-by date, lane of the parent case, status, recommended option. Sorted by lane, then need-by date.
  - `HeaderInfo` / `HeaderFacets`: the shared case header from `srv/common-annotations.cds` plus CR status and need-by date.
  - Facets:
    - **Options**: table with option ID, feasible, score, needs override, finish date, moved orders. The recommended option is highlighted and labelled **"Suggested by agent"**.
    - **Load before / after**: custom section (UI5 fragment with `sap.viz` or `sap.suite.ui.microchart`, or `sap.gantt`) showing the load per work center per day for the selected option, with the frozen-horizon marker (D+0 … D+3) and the 100% line. This is the only chart in the demo.
    - **Impact on other orders**: moved orders with old and new date against their due date.
    - **Comparison**: the A4 comparison text.
    - **Case Timeline** of the parent case.
  - Actions: *Choose option* (comment), *Choose override option* (mandatory reason, only for options with `needsOverride`), *Reject* (mandatory reason).
  - `Common.SideEffects` on the actions.
- [ ] Notifications and *Ask about this case* header buttons, reused from phase 3.
- [ ] `crossNavigation` inbound per app (lesson from the TM project: the generator can give two apps the same intent). Use `FeasibilityCase-plan` (Supply Planning Workbench) and `CapacityRequest-decide` (Production Capacity Workbench), and make the A5 deep links use the same intents.
- [ ] `watch-production-workbench` npm script.

**Exit criteria:** the cross-user flow works in both apps: `supplychain_user` requests the production check, `production_user` sees CR-0001 with O-ALT and O-MOVE and the before/after load, choosing O-MOVE without a reason is refused, `production_user` chooses O-ALT, and `supplychain_user` sees `PRODUCTION_CONFIRMED` and confirms the date to Sales. Scenario 4 (`setScenario('sc4-assy02-down')`): `production_user` rejects with a reason and `supplychain_user` sees the earliest date D+7.

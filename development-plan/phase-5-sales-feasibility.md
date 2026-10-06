# Phase 5: Fiori app 3, Sales Order Feasibility

[← Development plan](README.md) · Previous: [Phase 4](phase-4-production-workbench.md) · Next: [Phase 6](phase-6-deployment.md)

**Goal:** Sales sees its orders and confirms to the customer; scenarios 1–5 work across all three apps locally (§6.1, §8.3).

- [ ] Generate a Fiori elements V4 **List Report + Object Page** on `SalesService.Cases` in `app/sales-feasibility/`.
- [ ] `app/sales-feasibility/annotations.cds`:
  - `SelectionFields`: sales order, customer, lane, status, penalty risk, requested date.
  - `LineItem`: sales order / item, customer, material, quantity, requested date, lane, status, waiting for, penalty risk, confirmed date. Grouped by sales order. Includes `AUTO_CONFIRMED` items (scenario 3).
  - `HeaderInfo` / `HeaderFacets`: the shared case header.
  - Facets:
    - **Summary**: the A2 case summary and the penalty rule and amount.
    - **Recommendation**: latest agent recommendation, labelled **"Suggested by agent"**.
    - **Customer confirmation**: the A5 draft in an editable text area bound to `customerDraft`, with the confirmed date and quantity.
    - **Case Timeline**, including refused actions.
  - Actions: *Check feasibility* (calls A2 for the order item), *Confirm to customer* (only `SUPPLY_CONFIRMED`; stores the edited draft in the audit payload and sends nothing), *Close* (`REJECTED` → `CLOSED`).
- [ ] A **Demo** panel in the header, visible only to the `demo_user` user: *Simulate new order* (SO-5005 / SO-5006 / SO-5007), *Simulate priority change*, *Scenario 4 on/off*, *Reset demo* (calls `DemoService`). It is part of this app, not a fifth app.
- [ ] Links to the standard S/4 apps (*Manage Sales Orders*, *Monitor Material Coverage*, *Manage Work Center Capacity*) are disabled placeholders with a tooltip; they become intent-based navigation only with a real S/4 (phase 10).
- [ ] `crossNavigation` inbound `FeasibilityCase-track`, and the `watch-sales-feasibility` npm script.

**Exit criteria:** locally, scenarios 1–5 can be clicked through with `sales_user` (Sales), `supplychain_user` (Supply) and `production_user` (Production): scenario 1 ends in `CONFIRMED_TO_CUSTOMER` with the draft, scenario 2 without production, scenario 3 is `AUTO_CONFIRMED` with no task for any team, scenario 4 ends in `CLOSED` with the delay draft, and scenario 5's refused *Confirm to customer* shows in the timeline.

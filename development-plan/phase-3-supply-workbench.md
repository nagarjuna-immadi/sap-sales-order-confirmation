# Phase 3: Fiori app 1, Supply Planning Workbench

[← Development plan](README.md) · Previous: [Phase 2](phase-2-tools-agent-logic.md) · Next: [Phase 4](phase-4-production-workbench.md)

**Goal:** the supply planner works the HIGH/MEDIUM worklist and decides in the UI (§6.1).

- [ ] Generate a Fiori elements V4 **List Report + Object Page** on `SupplyPlanningService.Cases` in `app/supply-workbench/` (Fiori tools generator, TypeScript like the TM project).
- [ ] `srv/common-annotations.cds`: value helps and texts for the code lists (`Common.Text`, `TextArrangement`), lane and status criticality, and the shared **case header** and **Case Timeline** annotations that all three apps reuse.
- [ ] `app/supply-workbench/annotations.cds`:
  - `SelectionFields`: plant, lane, status, material, requested date, penalty risk.
  - `LineItem`: case ID, sales order / item, customer, material, quantity, requested date, lane (criticality), status (criticality), waiting for, penalty risk. Default sort by `laneRank`, then `requestedDate` (`PresentationVariant`).
  - `HeaderInfo` / `HeaderFacets`: case ID, CR ID when present, lane, status, waiting for, penalty risk, requested and confirmed date.
  - Facets:
    - **Supply picture**: material tree FG → SFG → RAW with required / available, stock in other plants, open receipts, excess and slow-moving flags. Use a flattened `SupplyTreeNode` projection with a hierarchy annotation, or a custom section with `sap.ui.table.TreeTable` if the annotation is not enough on the UI5 version.
    - **Recommendation**: options ranked 1–5, recommended option, rationale, excess-inventory warning, drafted production-check question, labelled **"Suggested by agent"**.
    - **Capacity request**: CR status, chosen option, reason.
    - **Case Timeline**.
  - Actions as `DataFieldForAction`: *Confirm from stock*, *Approve stock transfer*, *Approve reallocation*, *Request production check*, *Reject*, *Confirm date to Sales*. Show each one only in the allowed status (`@Core.OperationAvailable`); A1 still checks on the server.
  - *Reject* opens a dialog with a mandatory `reason`; the confirms take an optional `comment`.
  - `Common.SideEffects` on the actions, so status, recommendation and timeline refresh.
- [ ] Header button **Notifications**: popover with the user's `Notification` rows and their deep links.
- [ ] Header button **Ask about this case**: placeholder until phase 8 (opens the Order Assistant with the case ID).
- [ ] A small **data source** badge (`mock` / `sandbox`) from the tool results' `source`.
- [ ] Root `server.js` that strips the `/<app-id>` prefix for local `cds watch` (as in the TM project), relative `dataSources` URIs (`odata/v4/...`), and a `watch-supply-workbench` npm script.
- [ ] Until phases 4 and 5 exist, run the production and sales steps through `test/http/scenarios.http`.

**Exit criteria:** locally, as `nag`, simulate SO-5005 and SO-5006, see FC-0001 (HIGH) above the MEDIUM case, request the production check on FC-0001 (CR-0001 appears), approve the stock transfer on SO-5006's case, and see status, recommendation and timeline update.

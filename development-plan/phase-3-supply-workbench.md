# Phase 3: Fiori app 1, Supply Planning Workbench

[← Development plan](README.md) · Previous: [Phase 2](phase-2-tools-agent-logic.md) · Next: [Phase 4](phase-4-production-workbench.md)

**Goal:** the supply planner works the HIGH/MEDIUM worklist and decides in the UI (§6.1).

- [x] Generate a Fiori elements V4 **List Report + Object Page** on `SupplyPlanningService.Cases` in `app/supply-workbench/` (Fiori tools generator, TypeScript like the TM project). Done 2026-10-06: written by hand in the generator's layout (same files as the TM `dispatch-cockpit`), app ID `order.conf.supplyworkbench`, inbound `FeasibilityCase-plan` (the Communication agent's deep links; `SupplyPlanningCase-display` until phase 4). `cds-plugin-ui5` and npm workspaces in the root `package.json`.
- [x] `srv/common-annotations.cds`: value helps and texts for the code lists (`Common.Text`, `TextArrangement`), lane and status criticality, and the shared **case header** and **Case Timeline** annotations that all three apps reuse.
- [x] `app/supply-workbench/annotations.cds`:
  - `SelectionFields`: plant, lane, status, material, requested date, penalty risk.
  - `LineItem`: case ID, sales order / item, customer, material, quantity, requested date, lane (criticality), status (criticality), waiting for, penalty risk. Default sort by `laneRank`, then `requestedDate` (`PresentationVariant`).
  - `HeaderInfo` / `HeaderFacets`: case ID, CR ID when present, lane, status, waiting for, penalty risk, requested and confirmed date.
  - Facets:
    - **Supply picture**: material tree FG → SFG → RAW with required / available, stock in other plants, open receipts, excess and slow-moving flags. Use a flattened `SupplyTreeNode` projection with a hierarchy annotation, or a custom section with `sap.ui.table.TreeTable` if the annotation is not enough on the UI5 version. Decided: neither. `SupplyTreeNodes` is a `@cds.persistence.skip` entity built from the latest `SupplyResult` JSON (`supply-service.js`), one row per node in depth-first order with the material indented by level. A tree of four rows needs no expand/collapse, and a hierarchy would need its own table written by A3.
    - **Recommendation**: options ranked 1–5, recommended option, rationale, excess-inventory warning, drafted production-check question, labelled **"Suggested by agent"**. The options are `SupplyOptions` (built like the tree, from the latest `SUPPLY_OPTIONS` recommendation); the other fields are virtual elements of `Cases`. The question is the `Production check question:` line of the template text until phase 6 returns it as a field of its own.
    - **Capacity request**: CR status, chosen option, reason.
    - **Case Timeline**.
  - Actions as `DataFieldForAction`: *Confirm from stock*, *Approve stock transfer*, *Approve reallocation*, *Request production check*, *Reject*, *Confirm date to Sales*. Show each one only in the allowed status (`@Core.OperationAvailable`); A1 still checks on the server. The `can<Action>` flags come from `case-rules.js` `TRANSITIONS` (`srv/lib/case-view.js`), and the buttons are also `@UI.Hidden` when their flag is false.
  - *Reject* opens a dialog with a mandatory `reason`; the confirms take an optional `comment`. Mandatory only on the client (`webapp/annotations/annotation.xml`): CAP enforces `@mandatory` on action parameters, and its 400 would skip the orchestrator's audited refusal.
  - `Common.SideEffects` on the actions, so status, recommendation and timeline refresh.
- [x] Header button **Notifications**: popover with the user's `Notification` rows and their deep links. Built as a dialog (an FE custom action has no button to anchor a popover to), on the object page header and in the worklist toolbar. A deep link goes through the launchpad's navigation service; without a launchpad (`index.html`) the app follows its own intent and names the link for other apps.
- [x] Header button **Ask about this case**: placeholder until phase 7 (opens the Order Assistant with the case ID).
- [x] A small **data source** badge (`mock` / `s4`) from the tool results' `source`. In the header, from the latest `SupplyResult.source` (else `atpResult.source`).
- [x] Root `server.js` that strips the `/<app-id>` prefix for local `cds watch` (as in the TM project), relative `dataSources` URIs (`odata/v4/...`), and a `watch-supply-workbench` npm script. The sandbox launchpad (`/order.conf.supplyworkbench/test/flp.html`) registers the app under `FeasibilityCase-plan` (`ui5.yaml`), so deep links and `?caseId=` start parameters open the case.
- [x] Until phases 4 and 5 exist, run the production and sales steps through the CAP index page (`http://localhost:4004`). `srv/preview-annotations.cds` keeps the preview for the Sales and Production services only.

**Exit criteria:** locally, as `supplychain_user`, simulate SO-5005 and SO-5006, see FC-0001 (HIGH) above the MEDIUM case, request the production check on FC-0001 (CR-0001 appears), approve the stock transfer on SO-5006's case, and see status, recommendation and timeline update.

# Phase 7: Order Assistant

[← Development plan](README.md) · Previous: [Phase 6](phase-6-llm-agents.md) · Next: [Phase 8](phase-8-deployment.md)

**Goal:** a read-only chat app that answers questions about cases with data cards and deep links, instead of a phone call to another team (§5.3, §6.2, scenario 6). It is **not a sixth agent**: it makes no recommendations and has **no path to any action**. Built and checked locally; phase 8 deploys it to Work Zone with the other apps.

Built like the TM Assistant in the TM project (`sap-cap-tm-dispatch-cockpit`: `srv/agents/dispatch/`, `app/assistant/`): a CAP service with `@agent` from `@cap-js/agents`, served over A2A, and a UI5 freestyle chat on an A2A client. Differences to the TM Assistant: **no actions and no approval cards**, **no token streaming** (progress steps only, the answer appears once it is checked), one assistant instead of one agent per role, and data cards built in CAP. The plugin itself, `cds.requires.llm`, masking and the number check are already set up for A2–A5 in phase 6.

## 7.0 Spike: what the plugin must do

Phase 6.0 already checked `srv.chat`, `emit_data_part`, masking and the middleware hook. These points matter only for a chat with users. Check each under `cds watch --profile hybrid` with a throwaway service and note the result here. If one fails, stop and decide with the user.

- [ ] `cds.agents.streaming: false`: no `thinking-*` or token artifacts, but the `status-update` progress texts still arrive, and the answer arrives as one `response` artifact.
- [ ] A middleware added with `srv.after('buildMiddleware', …)` on an AGENTS.md agent can replace the final answer text (`afterAgent` or `afterModel` on the last model turn), and the replaced text is what the `response` artifact carries.
- [ ] A function tool that returns `{"kind":"data","data":{…}}` in its result reaches the client as a `data-*` artifact.
- [ ] The query tool runs with the user's identity, so a `before READ` handler (or `@restrict … where`) on the projections filters what the assistant sees.
- [ ] Masking (checked in 6.0) also resolves the pseudonyms back in the answer the user sees.
- [ ] A conversation (`contextId`) of one user cannot be continued by another user.

## 7.1 `OrderAssistantService` (`srv/agents/order-assistant/`)

Folder `srv/agents/order-assistant/`, next to A1–A5: it is a CAP agent like A2–A5, but not a case agent. Pulled in by `using from './agents/order-assistant/order-assistant-service'` in `srv/agents.cds` (CAP loads only the `.cds` files directly in `srv/`, as `srv/agents.cds` in the TM project).

- [ ] Configuration: the phase 6 `cds.requires.llm` and `cds.agents` (`streaming: false`, `masking: true`). Add `recursionLimit` (about 6 tool calls per question) and per-user `quotas` (`maxTasksPerHour`, `maxConcurrentTasksPerUser`, `maxIncomingMessageLength`, `maxLLMCallTimeout`). A model of its own only through `cds.requires.llm-assistant` and `@agent.llm`, if phase 9 shows the need.
- [ ] `order-assistant-service.cds`: `@path: 'order-assistant'` (served at `/a2a/order-assistant`), `@requires: ['Sales', 'SupplyPlanner', 'ProductionPlanner']`, `@agent`, `@agent.connect: 'none'`. A doc comment on the service and on every element and function: that is what Claude reads. Notes for developers go in line comments.
- [ ] **No actions on the service**, so nothing can pause for approval and nothing can change. `srv/agents/order-assistant/` must not import anything from the other agent folders, in particular not A1's `orchestrator.js` (ESLint rule).
- [ ] Read-only projections for the query tool, with explicit columns, code lists flattened to their codes (the doc comments name the values) and `caseId` on every entity: `Cases`, `CapacityRequests`, `Recommendations`, `CaseTimeline`. No prices (`penaltyAmount`, order value): the plugin masks text fields only. `@PersonalData.IsPotentiallyPersonal` on customer name and ID.
- [ ] Every projection filtered by `canRead(user, case)` from `srv/lib/case-access.js` (rule 8): a case the user may not see is "not found".
- [ ] Functions (each also checks `canRead`), each returning the facts plus the cards and links as data parts:
  - `getCase(caseId)`: header, status, waiting for, latest recommendations and the decision trail from `AuditLog`
  - `getSupplyPicture(caseId)`: the stored A3 snapshot
  - `getCapacityOptions(crId)`: the stored A4 options, load before/after, scores, override flags
  - `getSalesOrder(so)`: through `srv/lib/s4/`
- [ ] **Cards and links are built in CAP from the tool results**, not from LLM text: case header card (ID, lane, status, waiting for, requested / confirmed date), table card (material tree or capacity options), deep links to the case app that fits the user's role ("Open FC-0001 in Supply Planning Workbench").
- [ ] Persona in `AGENTS.md` next to the `.cds` file (the plugin finds it there; if they are separated, the agent is built without the persona and no error is reported), plus `skills/` for case status questions and option comparisons. It states: read-only, numbers only from tool results, out-of-scope questions get *"I can only answer questions about order feasibility cases."*, action requests get the current status and the link to the case app.
- [ ] `order-assistant-service.js`: a middleware added with `srv.after('buildMiddleware', …)` for the **number check** (`srv/lib/number-check.js` from phase 6) on the final answer against this turn's tool results. On failure the answer becomes *"I couldn't verify this answer. See the data below."* Unlike A2–A5 there is no template to fall back to, so the check replaces the text before it is sent. A failed check is logged with `cds.log('order-assistant')`; the runs themselves are in `cap.agent.Tasks` (`agentService` = `OrderAssistantService`).
- [ ] LLM unavailable: the task fails; the app shows an error and, opened from a case, the link to that case app.
- [ ] In development (`llm-mock`) the assistant answers with the plugin's mock text and the tool result, which proves the wiring (A2–A5 skip the call in that mode and use their templates). Real answers need the key (`--profile hybrid`).
- [ ] Check by hand in the Order Assistant app: the three scenario 6 questions as `sales_user` and `production_user`, a question about a case the user may not see, and an action request.

## 7.2 Chat UI: Order Assistant (`app/order-assistant/`)

Start from a copy of the TM `app/assistant/` (`model/a2a.ts`, `model/markdown.ts` with vendored `marked`, the controller and view), then:

- [ ] Remove the agent picker and the approval card. One assistant, one conversation.
- [ ] No token bubbles: keep `onStatus` (progress steps in the status line under the conversation, e.g. *"Querying Cases…"*), drop `onStep`. The answer is rendered when the task completes. Keep Stop (cancels the task).
- [ ] Read the `data-*` artifacts in `a2a.ts` and render cards and deep-link buttons from them under the answer.
- [ ] Each answer is labelled **"Generated by AI, check the data cards"**. Answer text as sanitized Markdown (`sap.ui.core.HTML` with `sanitizeContent: true`).
- [ ] Suggested questions as chips when the conversation is empty, from the agent card's skill examples (*What's blocking FC-0001?*, *Show my HIGH cases waiting for me*, *Which cases have penalty risk this week?*).
- [ ] Opened with `?caseId=FC-0001` (from the *Ask about this case* button in the case apps), the case is shown as context at the top and its ID goes with each message.
- [ ] *New conversation* button (new `contextId`). Enter sends, Shift+Enter adds a line. Input locked while a task runs.
- [ ] The name is always **Order Assistant**. Never "copilot".
- [ ] Relative data source URI (`a2a/order-assistant/`), the `/<app-id>` prefix stripped by `server.js` locally, and a `watch-order-assistant` npm script.
- [ ] `manifest.json`: the inbound `OrderAssistant-ask` (title "Order Assistant").
- [ ] Wire the *Ask about this case* buttons in the three case apps to the inbound `OrderAssistant-ask` with the `caseId` parameter.

**Exit criteria:** locally under `cds watch --profile hybrid`, scenario 6 works in the Order Assistant app: *"What's blocking FC-0001?"* as Sales (progress steps, then: waiting for Production on CR-0001, two options, O-ALT recommended, case card, link), *"Compare the options for CR-0001"* as Production (table card, O-MOVE "needs override", link), and *"Confirm FC-0001 to the customer"* changes nothing (status and audit log unchanged). An answer with a number that is not in the tool results is never shown.

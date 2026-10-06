# Phase 6: A2–A5 as CAP agents

[← Development plan](README.md) · Previous: [Phase 5](phase-5-sales-feasibility.md) · Next: [Phase 7](phase-7-order-assistant.md)

**Goal:** A2–A5 become CAP agents on `@cap-js/agents`, as the agents in the TM project, and get their Claude steps (summaries, penalty extraction, explanations, drafts). The phase 2 template texts stay as the fallback. Built and checked locally; the cloud deployment follows in phase 8. Runs on BTP trial **without AI Core** (§4.4, §5.1, §5.2). There is no `@anthropic-ai/sdk` and no LLM client module of our own.

## 6.0 Decisions, prerequisites and spike

- [x] **Open decision 1** (decided 2026-10-06): all LLM work runs on `@cap-js/agents` with `kind: anthropic`: A2–A5 here, the Order Assistant in phase 7.
- [x] **LLM account:** API key from the project's Anthropic Console workspace, with a monthly spend limit (phase 0.7).
- [ ] **Models:** `claude-opus-5-5` by default (§4.4). For cheap local development, `claude-haiku-4-5-20251001` is a configuration change. The final choice per agent is measured in phase 9.
- [ ] **Spike** (`@cap-js/agents` 0.9.7 was read but not run for this design). Check each point under `cds watch --profile hybrid` with a throwaway agent and note the result here. If one fails, stop and decide with the user.
  - `srv.chat(query)` called from an event handler (outside a request) runs the agent as a privileged user and returns `{ text, status, toolCalls }`, with each tool call's arguments and result. It is documented as an evaluation helper, so also check it is not limited to tests.
  - The built-in `emit_data_part` tool, when the persona asks for it, shows up in `toolCalls` with its `data` object.
  - `@requires: 'internal-user'` keeps the agent's A2A endpoint closed to every business user, while `srv.chat` still works.
  - `cds.agents.masking: true` with `@PersonalData.IsPotentiallyPersonal` on customer name and ID pseudonymizes them in what Claude sees.
  - `cap.agent.Tasks` gets a row per `srv.chat` run with `agentService`, `state`, `usageLlmTokens` and `usageToolCalls`, and the run's task ID is available to store on the recommendation.
  - `@agent.llm: '<name>'` points one agent at its own `cds.requires.<name>` entry (another model), and `cds.agents.params` (`max_tokens`, `temperature`) reaches the Anthropic call.

## 6.1 Plugin setup and shared code

- [ ] `npm add @cap-js/agents`. Configuration in `package.json`, as in the TM project:
  - `cds.requires.llm`: `{ "kind": "llm-mock" }` in development, `{ "kind": "anthropic", "model": "claude-haiku-4-5-20251001" }` in `[hybrid]` (key from `ANTHROPIC_API_KEY` in the git-ignored `.env`), and in `[production]` the model from phase 9 with `"vcap": { "name": "sap-sales-order-confirmation-llm" }`. The key comes from a user-provided service (phase 8.3), never from the repo or the MTA. The S/4 APIs have no `[hybrid]` credentials until phase 8, so they stay mocked in hybrid mode for now.
  - `cds.agents`: `streaming: false` (no consumer of A2–A5 tokens, and the Order Assistant shows progress only, phase 7), `masking: true`, `connect: "none"`, `params.max_tokens`, `quotas`.
  - A different model for one agent: its own `cds.requires.llm-<agent>` entry and `@agent.llm` on that service, only if phase 9 shows the need.
- [ ] `srv/lib/agent-call.js`: `runAgent({ agent, caseId, query, schema, template })`, used by every A2–A5 trigger:
  1. `cds.requires.llm.kind` is `llm-mock` → return the template text, `llmUsed = false`, no call. So `cds watch` keeps the phase 2 behaviour without a key.
  2. Otherwise `srv.chat(query)` on the agent's service.
  3. Failed task, timeout or empty answer → template text, `fallbackReason = LLM_UNAVAILABLE`.
  4. Output: the `emit_data_part` data validated against the agent's JSON schema (ajv); invalid or missing → template text, `fallbackReason = SCHEMA`.
  5. **Number check** (`srv/lib/number-check.js`): every number, date and ID in the generated text must appear in the results of this run's tool calls; otherwise the template text, `fallbackReason = NUMBER_CHECK`. A pure function `(text, facts) → { ok, unknown[] }`; the Order Assistant uses it too (phase 7).
  6. Returns `{ output, text, llmUsed, fallbackReason, modelId, promptVersion, agentTaskId, toolCalls }`; all but `toolCalls` are stored on the recommendation, and the tool results become its `inputSnapshot`.
- [ ] **The case flow never waits on the LLM.** The trigger stores the template recommendation first (as in phase 2) and runs `runAgent` after the commit (`cds.spawn`). When it returns, the recommendation's rationale is replaced by the checked text (`llmUsed = true`). This is not a status change.
- [ ] No call log of our own: tokens, tool calls, state and timing per run are in the plugin's `cap.agent.Tasks` (kept 30 days, `cds.agents.retention`), linked through `Recommendation.agentTaskId`. Cost and cache reads per model are read from the Anthropic Console usage page of the project workspace.
- [ ] ESLint: `@anthropic-ai/sdk` is not allowed anywhere (phase 0 rule, changed 2026-10-06). All Claude calls go through the plugin.

## 6.2 The four agents: `srv/agents/<agent>/`

Each agent folder gets, next to its phase 2 trigger code:

- `<agent>-agent-service.cds`: `@agent`, `@requires: 'internal-user'`, `@agent.connect: 'none'`. Read-only functions only, which call `srv/lib/tools/` or read the stored snapshots. **No actions and no write tools.** A doc comment on the service and on every function and parameter: that is what Claude reads. No prices in any function result (the plugin masks text fields only); `@PersonalData.IsPotentiallyPersonal` on customer name and ID.
- `AGENTS.md` (persona, must sit next to the `.cds` file) and `skills/`. Front matter `version: <agent>-<step>.v1`, bumped on every text change and stored with each recommendation (§5.1). The persona says: the tool results are the only facts; never choose, reorder or score options; return the result with `emit_data_part` in the documented shape. User-entered text (comments, reasons, clause text) reaches Claude only as tool results, never in the persona.
- The trigger calls `runAgent()` with the case or CR ID as the query, e.g. *"Case FC-0001: explain the supply recommendation."*

Recommendations, rankings and scores still come from the tools:

- [ ] **A2** (`sales-order-intake`, `sales-order-intake-summary.v1`): functions `getOrderItem(caseId)`, `getContractClause(customerId)`. Output: a 2–3 line case summary for the planner and the penalty rule `{ rate, unit, basis }` from the clause text. The rate must literally appear in the clause, otherwise "no penalty rule verified". `calculatePenalty` (tool) computes the amount. No clause → "no penalty clause found".
- [ ] **A3** (`supply-inventory`, `supply-inventory-explain.v1`): function `getSupplyPicture(caseId)` with the ranked options. Output: why the recommended option ranks first, plus the draft message to Sales or the production-check question. The LLM never chooses or reorders options.
- [ ] **A4** (`production-capacity-balancing`, `production-capacity-balancing-compare.v1`): function `getCapacityOptions(crId)`. Output: the top options compared in 3–4 sentences and the planner's draft comment. Scores and the recommended option are inputs, never outputs.
- [ ] **A5** (`communication`, `communication-customer.v1`): functions `getCaseOutcome(caseId)`, `getCustomerPreferences(customerId)` (language and tone from `CustomerContract`). Output: `{ subject, body }` for the customer confirmation or delay draft, with dates, quantities, IDs and reasons checked after generation. Notification texts stay templates.
- [ ] UI: show "Suggested by agent" and, when `llmUsed = false`, a small "template text" indicator (phases 3–5 annotations).

## 6.3 Local verification

- [ ] `cds watch` (`llm-mock`) still serves everything with template texts, and no agent call is made.
- [ ] `cds watch --profile hybrid` with the key: scenario 1 produces the A2 summary, the A3 explanation, the A4 comparison and the A5 draft; each recommendation has `llmUsed = true` and an `agentTaskId` whose `cap.agent.Tasks` row shows tokens and tool calls.
- [ ] Force failures (wrong key, tiny `max_tokens`) and check that the case flow still completes with template texts.
- [ ] Check the guards by hand in hybrid mode: no customer name or price reaches Claude (masking, visible in the logged tool results), a persona tweaked to invent a date falls back with `NUMBER_CHECK`, and a business user gets 403 on `/a2a/<agent>`.

**Exit criteria:** under `cds watch --profile hybrid`, scenario 1 runs in the three case apps with Claude texts on all four agents, the number check and masking work (checked on the recommendations, `fallbackReason`, and the tool results in `inputSnapshot`), and under `cds watch` (no key) every scenario still completes with template texts.

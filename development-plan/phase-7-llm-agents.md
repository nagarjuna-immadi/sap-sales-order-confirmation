# Phase 7: LLM client and agent reasoning

[← Development plan](README.md) · Previous: [Phase 6](phase-6-deployment.md) · Next: [Phase 8](phase-8-order-assistant.md)

**Goal:** A2–A5 get their Claude steps (summaries, penalty extraction, explanations, drafts) through **one** LLM client module, with the phase 2 template texts as the fallback. Runs on BTP trial **without AI Core** (§4.4, §5.1, §5.2).

## 7.0 Decisions and prerequisites

- [ ] **Open decision 1:** confirm the blueprint's own LLM client on `@anthropic-ai/sdk` (this plan) against `@cap-js/agents` with `kind: anthropic` (TM project). If the plugin is chosen, update the blueprint §5.2 and §6.2 first.
- [ ] **LLM account:** API key from the project's Anthropic Console workspace, with a monthly spend limit (phase 0.7).
- [ ] **Models:** `claude-opus-5-5` by default (§4.4). For cheap local development, `claude-haiku-4-5` is a configuration change. The final choice per agent is measured in phase 9.
- [ ] **Trial quota:** check `cf org-quota` and `cf apps`, and raise the `-srv` memory if the SDK needs it.

## 7.1 LLM client: `srv/lib/llm/`

- [ ] `npm add @anthropic-ai/sdk`. The ESLint rule from phase 0.2 allows the import only in `srv/lib/llm/providers/anthropic.js`. Agents never import the SDK.
- [ ] Public API: `generate({ agent, caseId, promptId, facts, userText, schema, fallbackTemplate })` returns `{ output, text, llmUsed, fallbackReason, modelId, promptVersion }`. `runToolLoop(...)` is added in phase 8.
- [ ] Modes `anthropic` and `mock`. In `package.json` → `cds.requires.llm`:
  - `[development]`: `{ "mode": "mock" }`, so `cds watch` needs no key and returns the template texts.
  - `[hybrid]`: `{ "mode": "anthropic" }`, key from `ANTHROPIC_API_KEY` in the git-ignored `.env`.
  - `[test]`: `{ "mode": "mock" }`, so `npm test` never calls the API.
  - `[production]`: `{ "mode": "anthropic", "vcap": { "name": "sap-sales-order-confirmation-llm" } }`. The `apiKey` comes from a user-provided service (7.4), never from the repo or the MTA.
  - Per agent: `agents.A2 = { model, effort, maxTokens }` (A2 and A5 at `low` effort, A3 and A4 at `medium`).
- [ ] Request details (checked against the current Claude API):
  - SDK client with `timeout` in **milliseconds** (e.g. 60000) and `maxRetries` 2 (retries 408/409/429/5xx and connection errors).
  - `output_config.effort` set explicitly: the default on `claude-opus-5-5` is `medium`, and thinking cannot be turned off there. **`claude-haiku-4-5` does not accept `effort`**, so the provider leaves it out for that model.
  - `maxTokens` includes thinking tokens, so keep it generous (8000–16000). A cut-off answer means `stop_reason: max_tokens` and the template text.
  - Structured output with `client.messages.parse()` and `output_config.format` (JSON schema per prompt). `parsed_output` is `null` on a parse failure → template text. CAP validates the result again (ajv) before storing it.
  - Check `stop_reason` before reading the content: `refusal` or `max_tokens` → template text and a log entry.
  - Server-side fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) on models that support it. Try it together with structured output first; if they don't combine, rely on the template fallback.
  - Prompt caching: system prompt and schema fixed per prompt version (no timestamps or case IDs), case facts in the user message. Check `usage.cache_read_input_tokens` on repeated calls.
- [ ] Masking (`masking.js`): customer names, customer IDs and prices are replaced by tokens (`<CUSTOMER_1>`, `<PRICE_1>`) before the call and replaced back after it. Material, plant, order, case and CR IDs stay. The map never leaves the request.
- [ ] Number check (`number-check.js`): every number, date and ID in the generated text must appear in the facts snapshot; otherwise the template text is used (`fallbackReason = NUMBER_CHECK`).
- [ ] User-entered text (comments, reasons, clause text) goes into the user message as delimited data, never into the system prompt.
- [ ] LLM failure after retries → template text with `llmUsed = false` and the flag "LLM unavailable". The case flow never waits on the LLM.
- [ ] `LlmCallLog` per call: agent, case ID, model ID, prompt version, input / output / cache-read tokens, latency, stop reason, fallback used. Never the key or unmasked customer data.
- [ ] Prompt templates in `srv/lib/llm/prompts/<agent>-<name>.v1.js` with `{ id, version, system, buildUser, schema, fallbackTemplate }`. Bump the version on every text change; the version is stored with each recommendation (§5.1).
- [ ] `test/llm-guards.test.js`: masking round trip (no customer name or price in the outgoing request), number check catches an invented date and quantity, `refusal` / `max_tokens` / timeout / schema failure → template text, `effort` left out for Haiku.

## 7.2 Agent LLM steps

Swap the phase 2 template call for `llm.generate()`; the template stays as the fallback. Recommendations, rankings and scores still come from the tools.

- [ ] **A2** (`a2-intake.v1`): 2–3 line case summary for the planner, and the penalty rule `{ rate, unit, basis }` extracted from the clause text. The rate must literally appear in the clause, otherwise "no penalty rule verified". `calculatePenalty` (tool) computes the amount. No clause → "no penalty clause found".
- [ ] **A3** (`a3-explain.v1`): why the recommended option ranks first, plus the draft message to Sales or the production-check question. The LLM never chooses or reorders options.
- [ ] **A4** (`a4-compare.v1`): compare the top options in 3–4 sentences and draft the planner's comment. Scores and the recommended option are inputs, never outputs.
- [ ] **A5** (`a5-customer.v1`): customer confirmation or delay draft in the customer's language and tone from `CustomerContract`, with dates, quantities, IDs and reasons checked after generation. Notification texts stay templates.
- [ ] UI: show "Suggested by agent" and, when `llmUsed = false`, a small "template text" indicator (phases 3–5 annotations).

## 7.3 Local verification

- [ ] `cds watch` (mock mode) still serves everything with template texts, and `npm test` is green.
- [ ] `cds watch --profile hybrid` with the key: scenario 1 produces the A2 summary, the A3 explanation, the A4 comparison and the A5 draft; `LlmCallLog` shows tokens and cache reads.
- [ ] Force failures (wrong key, tiny `maxTokens`) and check that the case flow still completes with template texts.

## 7.4 Deployment (commands run by the user)

- [ ] `mta.yaml`: add the resource `sap-sales-order-confirmation-llm` (`org.cloudfoundry.existing-service`) and require it in `-srv`.
- [ ] Commands for the user, in order:
  1. `cf create-user-provided-service sap-sales-order-confirmation-llm -p '{"apiKey":"<anthropic key>"}'`: creates the key holder once. It survives redeploys and is never in git. To rotate: `cf update-user-provided-service …` and `cf restage`.
  2. `mbt build`
  3. `cf deploy mta_archives/sap-sales-order-confirmation_<version>.mtar`

**Exit criteria:** scenario 1 runs in the Work Zone site with Claude texts on all four agents, the number check and masking work (checked in `LlmCallLog` and the outgoing request in hybrid mode), the app still completes every scenario with the key removed, and `npm test` is green.

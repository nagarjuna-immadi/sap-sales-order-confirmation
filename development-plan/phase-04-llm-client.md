# Phase 4 · LLM client layer

**Goal.** One small module that is the only place the Anthropic SDK is used. It provides `anthropic` and `mock` modes, per-agent model config, structured output, masking, safety handling, number checks, retries and usage logging. It replaces the Generative AI Hub orchestration of the AI Core variant.

**Duration.** 3–4 days.

**Depends on.** Phase 1. Runs in parallel with Phases 2 and 3.

**Blueprint.** §4.4, §5.1, §5.2, §6.2 (tool use for the Order Assistant).

---

## 1. Module structure

```
srv/llm/
├── index.js            # public API: generate(), runToolLoop()
├── config.js           # reads cds.requires.llm (mode, per-agent model/effort/maxTokens)
├── providers/
│   ├── anthropic.js    # the ONLY file that imports @anthropic-ai/sdk
│   └── mock.js         # deterministic template text, no network
├── masking.js          # mask / unmask customer names, IDs, prices
├── number-check.js     # every number/date/ID in text must be in the tool snapshot
├── schema.js           # JSON schema validation (ajv) of parsed output
├── prompts/            # versioned templates: a2-summary.v1.js, a3-explain.v1.js, ...
└── usage-log.js        # writes LlmCallLog
```

Public API used by agents and the assistant:

```js
generate({ agent, caseId, promptId, facts, userText, schema, fallbackTemplate })
  → { output, text, llmUsed, fallbackReason, modelId, promptVersion }

runToolLoop({ agent: 'ASSISTANT', system, messages, tools, maxToolCalls })
  → { finalText, toolCalls[], toolResults[], modelId, usage }
```

## 2. Configuration (`cds.requires.llm`)

```json
"llm": {
  "mode": "mock",
  "defaultModel": "claude-opus-5-5",
  "timeoutMs": 60000,
  "maxRetries": 2,
  "agents": {
    "A2": { "effort": "low",    "maxTokens": 8000 },
    "A3": { "effort": "medium", "maxTokens": 16000 },
    "A4": { "effort": "medium", "maxTokens": 16000 },
    "A5": { "effort": "low",    "maxTokens": 8000 },
    "ASSISTANT": { "effort": "medium", "maxTokens": 16000, "maxToolCalls": 6 }
  }
}
```

- `[development]` and CI: `mode: "mock"`. `[demo-live]` and CF: `mode: "anthropic"`.
- API key: local from `.env` (`ANTHROPIC_API_KEY`); on CF from the user-provided service `anthropic-api` (read via `xsenv`/`VCAP_SERVICES` at start). Never in `mta.yaml`, `manifest.yml` or logs.
- `maxTokens` includes thinking tokens (thinking is always on for `claude-opus-5-5`), so don't set it low: a cut-off answer means `stop_reason: max_tokens` and template text.
- Model per agent is a config change (§4.4). Default `claude-opus-5-5`; candidates after measurement in Phase 10: `claude-sonnet-5-5`, `claude-haiku-4-5`.

## 3. Request shape (anthropic provider)

Verified against the current Claude API (October 2026):

| Concern | Implementation |
|---|---|
| SDK | `@anthropic-ai/sdk`, `new Anthropic({ apiKey, timeout: cfg.timeoutMs, maxRetries: cfg.maxRetries })`. TypeScript SDK timeouts are in **milliseconds**. SDK retries 408/409/429/5xx and connection errors. |
| Effort | `output_config: { effort }`. On `claude-opus-5-5` the default is `medium` and thinking cannot be disabled, so always send effort explicitly. **`claude-haiku-4-5` does not accept `effort`.** The provider omits it when the configured model doesn't support it. |
| Structured output | `client.messages.parse({ ..., output_config: { format: <json schema format> } })`; `parsed_output` is `null` on parse failure → template text. CAP re-validates with ajv before storing (§5.2). |
| Tools (assistant) | Read-only tools with `strict: true` and `additionalProperties: false`. `tool_choice: auto` (forced `any`/`tool` returns 400 on Opus 5.5 / Sonnet 5.5). Manual loop in CAP so the per-question tool cap, authorization and logging stay under our control. Parallel tool results go back in **one** user message. |
| Stop reason | Check `stop_reason` before reading content. `refusal` or `max_tokens` → template text + log (§5.2). `stop_details` is only present on `refusal`. |
| Server-side fallback | On models that support it (Opus 5.5, Sonnet 5.5): beta `server-side-fallback-2026-07-01` with `fallbacks: "default"` via `client.beta.messages.*`. Spike in this phase: confirm it combines with structured output and tools; if not, keep the template fallback only. |
| Prompt caching | Order: tools → system → messages. System prompt and tool definitions are fixed per prompt version (no timestamps, no case IDs). Volatile facts go in the user message. Verify with `usage.cache_read_input_tokens > 0` on repeated calls. |
| No prefill | Assistant prefill returns 400 on current models; format comes from structured output and the system prompt. |
| Streaming | Not needed: visible outputs are short and `maxTokens` stays ≤ 16000, within non-streaming timeouts. Use non-streaming calls. |

Record the exact SDK version in `package.json` and re-verify these parameters when upgrading.

## 4. Masking (§5.2)

- Before the call: replace customer names, customer IDs and prices/order values with tokens (`<CUSTOMER_1>`, `<PRICE_1>`). Keep material, plant, order, case and CR IDs.
- After the call: replace tokens back. The masking map lives only in memory for that request.
- Masking applies to facts, user text (comments, reasons, chat questions) and tool results sent back in the assistant loop.
- Tests: no customer name or price string appears in any outgoing request body (assert on the mocked SDK).

## 5. Output guards

| Guard | Rule |
|---|---|
| Schema | Parsed output must pass ajv validation; otherwise template. |
| Number check | Every number, date and ID in generated text must appear in the facts snapshot (after normalizing formats like `D+5` vs dates, `100` vs `100.0`). Failure → template, `fallbackReason = NUMBER_CHECK`. |
| Prompt injection | User-entered text goes into the user turn inside clearly delimited data tags, never into the system prompt. No write tools exist anywhere. |
| LLM unavailable | Timeout / error after retries → return template text with `llmUsed = false`, `fallbackReason = LLM_UNAVAILABLE`. Never throw into the case flow. |

## 6. Mock provider

- Returns deterministic text built from the same templates used as fallbacks, filled from the facts.
- For `runToolLoop`, a scripted planner: maps known question patterns (scenario 6 questions) to tool call sequences, so the Order Assistant is testable offline.
- Used by all unit tests and the offline demo.

## 7. Logging (§5.2)

Per call → `LlmCallLog`: agent, caseId, modelId, promptVersion, input/output/cache-read tokens, latency, stop reason, fallback used. Never the API key, never unmasked customer data, no full prompt text in production logs.

## 8. Prompt templates

- One file per prompt, exporting `{ id, version, system, buildUser(facts, userText), schema, fallbackTemplate(facts) }`.
- Version bump on any text change; `promptVersion` stored with every recommendation (§5.1).
- Prompts state that the provided facts are the only source of numbers and that the model must not invent quantities or dates.

## Tests

- [ ] Mode switch: `mock` makes zero network calls (nock / SDK mock asserts).
- [ ] Masking round-trip; no sensitive strings in outgoing requests.
- [ ] Number check: catches an invented date and an invented quantity.
- [ ] `refusal`, `max_tokens`, timeout, 429-after-retries → template text, logged.
- [ ] Schema-invalid output → template text.
- [ ] `effort` omitted for models that don't support it.
- [ ] Tool loop stops at `maxToolCalls`.
- [ ] ESLint rule: `@anthropic-ai/sdk` imported only in `srv/llm/providers/anthropic.js`.

## Exit criteria

- [ ] All tests green in `mock` mode.
- [ ] One live smoke test (manual, `[demo-live]`) produces a structured A2 summary with cache stats logged.
- [ ] Fallback spike result documented in this file.

# Phase 10 · Demo hardening and rehearsal

**Goal.** All six §8.3 scenarios run reliably on the trial, are covered by automated tests, can be reset in one click, and the model choice per agent is measured, not guessed. Ends with a rehearsed demo for the business.

**Duration.** 3–4 days.

**Depends on.** Phase 9.

**Blueprint.** §8.3, §4.4 (models), §5.2, §9 (phase 1 outcome), §10.

---

## 1. Automated scenario tests (`test/scenarios/`)

One test per scenario, driving OData calls with the three mock users, in `mock` LLM mode (CI) and optionally in `anthropic` mode (manual, nightly at most, to control spend).

| Scenario | Asserts |
|---|---|
| 1 HIGH, production, load balancing | FC-0001 HIGH at top of SCP worklist; A3 → production check; CR-0001; O-ALT recommended with §8.3 numbers; O-MOVE needs override; final `CONFIRMED_TO_CUSTOMER`; timeline has all five steps |
| 2 MEDIUM, excess stock | Stock transfer 30 from plant 1100 recommended; no CR created; confirmed to customer |
| 3 NORMAL, no human step | `AUTO_CONFIRMED`; no notifications; visible only in Sales list |
| 4 Rejection loop | `sc4-assy02-down`; Production rejects with reason; A3 proposes D+7; SCP rejects to Sales; A5 delay draft with D+7; `CLOSED` |
| 5 Guardrail | Confirm to customer in `WITH_PRODUCTION` refused; refused row in timeline; status unchanged |
| 6 Order Assistant | Three questions from §8.3 with expected cards/links; action request changes nothing |

Plus a **cross-scenario consistency test**: §8 facts are identical in mock files, seed CSVs and expected values.

## 2. Demo controls (`DemoService`, demo users only)

- `resetDemo()` → reseed database, clear chat history, reset IDs to FC-0001 / CR-0001, reset demo clock to "today".
- `simulateS4Event(payload)` buttons for SO-5005, SO-5006, SO-5007 and the priority *Changed* event.
- `setScenario('sc4-assy02-down' | 'default')`.
- `setLlmMode('mock' | 'anthropic')` at runtime, as a fallback if the network or API fails during a live demo.
- Exposed as a small "Demo" panel in the Sales app header (visible only with a demo flag), not as a fifth app.

## 3. Model and effort measurement (§4.4, §10.7)

- Run each agent prompt on the scenario inputs with `claude-opus-5-5`, `claude-sonnet-5-5` and `claude-haiku-4-5` (Haiku without `effort`).
- Measure per agent: schema-valid rate, number-check pass rate, fallback rate, latency, tokens and cost per case (from `LlmCallLog`), plus a human rating of text quality (simple 1–5 rubric by the team).
- Decide model and effort per agent; record the decision and numbers in `blueprints/` follow-up notes and update `cds.requires.llm`.
- Check prompt caching works (`cache_read_input_tokens > 0` on repeated calls).
- Get approval for the measurement budget before running; total spend stays inside the workspace limit.

## 4. Robustness

- [ ] Claude API down → every scenario still completes with template texts and "LLM unavailable" flags.
- [ ] Sandbox down → scripted scenarios unaffected (they run in `mock`); "live data" view shows a clear error.
- [ ] Double-click on actions → idempotency key prevents duplicate transitions.
- [ ] Two browsers on the same case → ETag conflict message.
- [ ] Trial CF app restarted → demo reset, still works.
- [ ] HANA Cloud (if used) stopped → documented restart step.

## 5. Security and compliance review

- [ ] No API keys in Git history (`git log -p | grep` / secret scanner).
- [ ] No unmasked customer names or prices in outgoing LLM requests (log sample check).
- [ ] No "copilot" in code, UI texts, i18n or the runbook (CI grep check from Phase 1).
- [ ] Role checks: each action tested with the wrong role on CF.
- [ ] Audit log: no UPDATE/DELETE path.

## 6. Runbook and rehearsal

- `docs/demo-runbook.md`: URLs, users and roles, reset steps, click path per scenario with expected screens, fallback moves (switch to mock LLM), known trial limits.
- Two full dry runs with the business presenter; time each scenario.
- Prepare the **baseline questions** for the pilot (§9): current confirmation lead time per priority, penalty cost per quarter, excess-stock value, work center overload days.
- Close the open business decisions from §10 that block the pilot, or list them with owners.

## Exit criteria

- [ ] All scenario tests green in CI (`mock`) and once live on CF.
- [ ] Model/effort decision per agent recorded with measurements.
- [ ] Runbook done; two rehearsals completed.
- [ ] Demo delivered: **clickable end-to-end demo for the business** (§9 phase 1 outcome).

# Phase 9: Demo readiness

[← Development plan](README.md) · Previous: [Phase 8](phase-8-order-assistant.md) · Next: [Phase 10](phase-10-extras.md)

**Goal:** all six §8.3 scenarios run in the cloud, with a demo reset, a measured model choice and a runbook.

## 9.1 Scenarios in the cloud

- [ ] Scenario 1: SO-5005 → FC-0001 HIGH at the top of the supply worklist → production check → CR-0001 → O-ALT → `SUPPLY_CONFIRMED` with draft → `CONFIRMED_TO_CUSTOMER`. Timeline shows all five steps.
- [ ] Scenario 2: SO-5006 → stock transfer of 30 from plant 1100, no CR → confirmed to customer.
- [ ] Scenario 3: SO-5007 → `AUTO_CONFIRMED`, no notification, visible only in Sales Order Feasibility.
- [ ] Scenario 4: WC-ASSY-02 down → production rejected with reason → D+7 → rejected to Sales → delay draft → `CLOSED`.
- [ ] Scenario 5: *Confirm to customer* in `WITH_PRODUCTION` is refused and shown in the timeline.
- [ ] Scenario 6: the three Order Assistant questions.
- [ ] Priority change: a `Changed` event from `02` to `01` moves a case into the HIGH lane.

## 9.2 Robustness

- [ ] Anthropic key removed or API down: every scenario still completes with template texts and the "LLM unavailable" flag.
- [ ] CAL system suspended or down: the scripted scenarios are unaffected (mocks); the Live data dialog shows a clear error.
- [ ] Double click on an action: the idempotency key prevents a second transition.
- [ ] Two browsers on the same case: the stale one gets a "case changed, refresh" message (412).
- [ ] App restart: the demo data is reset (SQLite) or still there (HANA); the runbook says which.

## 9.3 Model and effort per agent (open decision 6)

- [ ] Agree the measurement budget with the user first; every run is billed.
- [ ] Run the scenario inputs for each agent prompt with `claude-opus-5-5`, `claude-sonnet-5-5` and `claude-haiku-4-5` (Haiku without `effort`).
- [ ] Compare from `LlmCallLog`: schema-valid rate, number-check pass rate, fallback rate, latency, tokens and cost per case, plus a 1–5 team rating of the texts.
- [ ] Set model and effort per agent in `cds.requires.llm` and record the result in the blueprint (§4.4, §10.7).

## 9.4 Security check

- [ ] No keys in the git history (secret scan).
- [ ] No unmasked customer names or prices in outgoing LLM requests (check a sample in hybrid mode).
- [ ] No "copilot" in `app/`, `srv/`, `db/` (`npm run check:wording` from phase 0).
- [ ] Each action refused with the wrong role on the deployed app.
- [ ] `AuditLog` has no UPDATE or DELETE path.

## 9.5 Runbook and rehearsal

- [ ] `docs/demo-runbook.md`: site URL, users and role collections, reset steps, the click path for each scenario with the expected screens, fallback moves (LLM mock mode, restart), trial limits (HANA stops at night, trial expiry).
- [ ] Two full dry runs with the presenter; note the time per scenario.
- [ ] List the open business decisions from §10 that are still open, with owners.

**Exit criteria:** all six scenarios run in the Work Zone site with Claude texts and again with the key removed, the model choice is recorded, and the runbook is done.

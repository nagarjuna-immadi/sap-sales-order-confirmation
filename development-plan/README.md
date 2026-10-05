# Development plan

Detailed build plan for the Sales-to-Planning Order Confirmation Agents, derived from [`blueprints/blueprint-without-aicore.md`](../blueprints/blueprint-without-aicore.md) (the BTP trial variant). The blueprint is the source of truth. If this plan and the blueprint disagree, the blueprint wins and this plan gets fixed.

Section references like "§7 A3" point to the blueprint.

## Phases

| # | Phase | Blueprint roadmap phase | Est. duration | Output |
|---|---|---|---|---|
| 0 | [Prerequisites and environment](phase-00-prerequisites.md) | 0 · Prerequisites | 1 wk | Trial account, keys, BAS, repo ready |
| 1 | [Project foundation and domain model](phase-01-foundation-domain-model.md) | 1 · Demo | 3–4 days | CAP project, CDS model, §8 seed data, test harness |
| 2 | [A1 Case Orchestrator](phase-02-a1-case-orchestrator.md) | 1 · Demo | 4–5 days | State machine, rules, audit log, timeline, authorization |
| 3 | [Adapters and tool layer](phase-03-adapters-tool-layer.md) | 1 · Demo | 5–6 days | `mock` + `sandbox` adapters, all deterministic tools |
| 4 | [LLM client layer](phase-04-llm-client.md) | 1 · Demo | 3–4 days | One LLM module: `anthropic` + `mock`, masking, checks, logging |
| 5 | [A2 Order Intake and A3 Supply & Inventory](phase-05-agents-a2-a3.md) | 1 · Demo | 4–5 days | Intake, lanes, penalty extraction, supply decision ladder |
| 6 | [A4 Capacity and A5 Communication](phase-06-agents-a4-a5.md) | 1 · Demo | 4–5 days | Options, simulate/score, frozen horizon, notifications, drafts |
| 7 | [Case apps (Fiori elements)](phase-07-case-apps.md) | 1 · Demo | 6–8 days | Three case apps with actions, timeline, capacity chart |
| 8 | [Order Assistant](phase-08-order-assistant.md) | 1 · Demo | 4–5 days | `OrderAssistantService` + SAPUI5 chat app |
| 9 | [Deployment and Work Zone](phase-09-deployment-work-zone.md) | 1 · Demo | 3–4 days | MTA on CF trial, XSUAA, Work Zone site |
| 10 | [Demo hardening and rehearsal](phase-10-demo-hardening.md) | 1 · Demo | 3–4 days | Scenarios 1–6 scripted and tested, model choice measured |
| 11 | [Pilot](phase-11-pilot.md) | 2 · Pilot | 6–8 wks | Real S/4 read-only, one plant, HIGH lane |
| 12 | [Rollout](phase-12-rollout.md) | 3 · Rollout | open | All lanes and plants, controlled write-back |

Phases 1–10 together are the blueprint's **Demo** phase (4–6 weeks). The day estimates assume one or two developers and add up to roughly 6 weeks for one developer. With two, run the parallel tracks below.

## Dependencies and parallel tracks

```
P0 ─▶ P1 ─▶ P2 ──────────────┐
         └▶ P3 ─┐            ├─▶ P5 ─▶ P6 ─▶ P7 ─▶ P9 ─▶ P10
         └▶ P4 ─┴────────────┘            └▶ P8 ─┘
```

- P2 (A1), P3 (tools) and P4 (LLM client) depend only on P1 and can be built in parallel.
- Agents (P5, P6) need A1, tools and the LLM client.
- Fiori work (P7) can start on the CDS model from P1 with mock services, but needs P2 actions and P5/P6 recommendations to finish.
- The Order Assistant (P8) needs A1 read access (P2) and the tool results (P3, P5, P6).
- Deploy a first skeleton to CF early (end of P2) so trial quota and approuter issues surface early, not in P9.

## Rules every phase must respect

These come from the blueprint and `CLAUDE.md`. Each phase has a checklist that repeats the ones relevant to it.

1. Five agents only: A1 Case Orchestrator (deterministic, no LLM, the only writer of case status, owns audit log and timeline), A2, A3, A4, A5.
2. Exactly four Fiori apps: Sales Order Feasibility, Supply Planning Workbench, Production Capacity Workbench, Order Assistant. No analytical apps, dashboards or KPI cockpit.
3. The Order Assistant is read-only, not a sixth agent, makes no recommendations, and answers action requests with a deep link.
4. Never use the word "copilot" in UI, texts or code.
5. Agents recommend; humans confirm or reject in Fiori. Agents never change status, never send to customers, never write to S/4HANA.
6. Numbers, dates and quantities come from deterministic tool functions, never from LLM text.
7. Every action writes an audit row in the same transaction as the status change. Reject and frozen-horizon override require a reason.
8. All data access goes through adapters (`mock` | `sandbox` | `s4`).
9. The §8 demo data stays consistent across all mock files.
10. Agents never import `@anthropic-ai/sdk`; only the LLM client module does.
11. API keys (Anthropic, Business Accelerator Hub) are never committed.

## Definition of done (every phase)

- Code merged to `main` through a reviewed pull request.
- Unit tests for new logic pass in CI with `LLM mode = mock` and `adapter mode = mock` (no network, no key needed).
- No new lint errors.
- `CLAUDE.md` updated when build, test or run commands change.
- The phase's exit criteria (listed in each file) are demonstrated.

# Phase 11 · Pilot (real S/4HANA data, read-only)

**Goal.** Run the same agents and apps on real S/4HANA Private Cloud data for one plant and the HIGH lane only, and measure lead time against the baseline.

**Duration.** 6–8 weeks.

**Depends on.** Phase 10 delivered; pilot decisions from §10 closed.

**Blueprint.** §4.1 (pilot column), §4.2, §4.3 (`s4` mode, Enterprise Event Enablement), §5.2 (AI Core switch), §9 phase 2, §10.

This phase is planned at a coarser level. Detail it after the demo, when the §10 answers are known.

---

## 1. Entry gates (must be closed before start)

| Gate | Blueprint |
|---|---|
| S/4HANA release confirmed → API versions and Fiori app availability | §10.1 |
| Delivery priority values and lane mapping confirmed; data quality checked | §10.2, §10.3 |
| Frozen horizon per plant and override owner | §10.4 |
| Source of penalty terms | §10.5 |
| **Data-privacy approval** for sending masked S/4 data to the Claude API, or decision to use SAP AI Core | §10.6 |
| Paid BTP subaccount and entitlements (HANA Cloud, Event Mesh, optional AI Core) | §10.8 |
| Baseline numbers captured | §9 |

## 2. Workstreams

| # | Workstream | Tasks |
|---|---|---|
| 1 | BTP landscape | Paid subaccount (trial is not for productive data); CF space; HANA Cloud instance; XSUAA; Work Zone; transport of the MTA. |
| 2 | Connectivity | Cloud Connector install and mapping to S/4HANA Private Cloud; destination `S4_PRIVATE_CLOUD` with principal propagation or technical user. |
| 3 | S/4 services | Activate the OData services from §4.2 in S/4; authorizations for the technical / propagated users. |
| 4 | Capacity load API | Custom CDS view + RAP/OData service for load per work center per day (§4.2). Implement `capacity-load/s4.js`. |
| 5 | Adapters | Complete all `s4.js` adapters (same mapping as `sandbox.js`, different destination); integration tests against the pilot system. |
| 6 | Events | Enterprise Event Enablement: channel to SAP Event Mesh (`/IWXBE/CONFIG`), sales order Created/Changed topics; CAP subscribes; the payload format is the one already used by `simulateS4Event`. |
| 7 | Persistence | Switch to HANA Cloud (`@cap-js/hana`); real retention for audit log and cases; chat retention policy agreed. |
| 8 | LLM | Claude API after privacy approval (production workspace, spend limit, key rotation process), **or** add the `aicore` mode to the LLM client (SAP Cloud SDK for AI); agents, prompts, schemas and checks unchanged. |
| 9 | Scope restriction | One plant (XSUAA `plant` attribute filter), HIGH lane only; MEDIUM/NORMAL items ignored or shown read-only. |
| 10 | Navigation | Intent-based navigation to the standard S/4 apps (*Manage Sales Orders*, *Monitor Material Coverage*, *Manage Work Center Capacity*). |
| 11 | Operations | Monitoring (application logs, alert on LLM fallback rate, failed events), support contacts, user training for the three teams. |
| 12 | Measurement | Lead time per step from the audit log vs baseline; acceptance rate of agent recommendations; penalties avoided; frozen-horizon overrides. Reported from the audit data (no dashboard app; export or a query is enough). |

## 3. Rules that still hold

- Read-only to S/4 (`s4` adapters read only). No write-back in the pilot.
- Agents recommend, humans decide; A1 the only status writer; audit in the same transaction.
- Masking before every LLM call; no unmasked customer data in logs.
- Four apps only; no dashboards.

## Exit criteria

- [ ] HIGH cases for the pilot plant flow from real S/4 events to customer confirmation.
- [ ] Measured lead time vs baseline reported to the business (§9 phase 2 outcome).
- [ ] Go / no-go decision for rollout.

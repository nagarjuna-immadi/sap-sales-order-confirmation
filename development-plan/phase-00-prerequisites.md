# Phase 0 · Prerequisites and environment

**Goal.** Everything the developers need exists and works before the first line of code: BTP trial, keys, tooling, repository conventions and the open customizing answers that affect the demo.

**Duration.** 1 week (mostly waiting on accounts and answers; can overlap with Phase 1 scaffolding).

**Blueprint.** §0, §4.1, §4.4, §9 (phase 0), §10.

---

## 1. SAP BTP trial

| Task | Detail | Owner |
|---|---|---|
| Create / renew the BTP trial account | Cloud Foundry environment, note region and expiry date. Check current trial terms (duration, memory quota, services) in the cockpit (§4.1). | Dev lead |
| Create CF space | e.g. `dev`. Record org/space names in the team wiki, not in the repo. | Dev lead |
| Check entitlements | CF runtime memory, Destination, XSUAA, HTML5 Application Repository, SAP Build Work Zone standard edition. Optional: SAP HANA Cloud trial. | Dev lead |
| Subscribe to SAP Build Work Zone, standard edition | Assign `Launchpad_Admin` role collection to the developers. | Dev lead |
| Subscribe to SAP Business Application Studio | Create a "Full Stack Cloud Application" dev space. Local VS Code with `@sap/cds-dk` is an equal alternative. | Each dev |
| Plan role collections | Create later via `xs-security.json` (Phase 1/9). Record the target names now: `OrderConf_Sales`, `OrderConf_SupplyPlanner`, `OrderConf_ProductionPlanner`. | Dev lead |
| Create demo users | Three trial users (or one user with role collections switched) for Sales, Supply Chain Planner, Production Planner. Needed for scenario rehearsals. | Dev lead |

## 2. Anthropic Claude API

| Task | Detail |
|---|---|
| Anthropic Console account | Decide who owns the account and key (open decision §10.7). |
| Dedicated workspace | One workspace only for this demo, with a **monthly spend limit** (§4.4). |
| API key | Created in that workspace. Stored in the team password manager. Never in Git, `mta.yaml` or `manifest.yml`. |
| Smoke test | One `messages.create` call with `claude-opus-5-5` from a dev machine to confirm the key, network egress and the spend limit. |
| Data-privacy note | Record in the team wiki: only demo data on trial; real S/4 data needs the data-privacy officer's approval (§4.4, §10.6). |

## 3. SAP Business Accelerator Hub sandbox

| Task | Detail |
|---|---|
| api.sap.com login and API key | Key from "Show API Key". Stored in the password manager. |
| Confirm sandbox base URLs | For each API in §4.2: `API_SALES_ORDER_SRV`, `API_PRODUCT_AVAILY_INFO_BASIC`, `API_MATERIAL_STOCK_SRV`, `API_BILL_OF_MATERIAL_SRV`, `API_PRODUCT_SRV`, `API_PLANNED_ORDERS`, `API_PRODUCTION_ORDER_2_SRV`, `API_WORK_CENTERS`. Record the base URL from each *Try out* page. |
| Download `$metadata` | Save EDMX for each API into `srv/external/` during Phase 1 (`cds import`). Note the exact delivery priority property name on the sales order item (§7 A2). |
| Sandbox destination | Create BTP destination `S4_SANDBOX` (URL `https://sandbox.api.sap.com/...`, authentication `NoAuthentication`, additional property `URL.headers.APIKey = <key>`). |
| Check capacity load | Confirm that capacity load per day is **not** available in the sandbox (§4.2), so A4 load stays `mock`. |

## 4. Repository and team conventions

| Task | Detail |
|---|---|
| Repo layout | Keep `blueprints/` and `development-plan/`. Code goes in the CAP standard layout (`app/`, `srv/`, `db/`, `test/`) created in Phase 1. |
| `.gitignore` | Add before any code: `.env`, `default-env.json`, `.cdsrc-private.json`, `node_modules/`, `gen/`, `mta_archives/`, `*.mtar`, `*.sqlite`. |
| Branching | `main` protected; feature branches per phase task; PRs reviewed. |
| CI | GitHub Actions (or equivalent): `npm ci`, lint, unit tests in `mock` mode. No secrets needed in CI. |
| Node.js version | Pin the Node LTS that the CF Node.js buildpack supports (check `cf buildpacks`); record it in `package.json` `engines`. |

## 5. Business answers needed before the demo is final

From §10. The demo can start with placeholders, but these must be closed before Phase 10.

| # | Question | Default used until answered |
|---|---|---|
| 10.2 | Delivery priority keys meaning HIGH / MEDIUM / NORMAL | `01` HIGH, `02` MEDIUM, `03+`/blank NORMAL |
| 10.4 | Frozen horizon length and who may override | 3 days, Production Planner |
| 10.5 | Where penalty terms live | Clause text on `CustomerContract` in CAP |
| 10.7 | Models and monthly budget | `claude-opus-5-5` for all agents; spend limit set in Console |

## Exit criteria

- [ ] Trial account, CF space, Work Zone and BAS working for every developer.
- [ ] Anthropic key works from a dev machine; workspace spend limit set.
- [ ] Sandbox key works; `S4_SANDBOX` destination created; base URLs and `$metadata` collected.
- [ ] `.gitignore` committed; CI pipeline skeleton runs.
- [ ] Open business questions logged with owners and the defaults above.

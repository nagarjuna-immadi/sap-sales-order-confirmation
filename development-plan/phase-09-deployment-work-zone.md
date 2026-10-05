# Phase 9 · Deployment on BTP trial and Work Zone

**Goal.** The whole demo runs on the BTP trial: CAP on Cloud Foundry, four apps in the HTML5 Application Repository behind the managed approuter, XSUAA role collections, the Claude API key from a user-provided service, and a Work Zone site with role-based spaces.

**Duration.** 3–4 days (less if the skeleton was deployed in Phase 1/2).

**Depends on.** Phases 7 and 8 (apps), Phase 4 (LLM config).

**Blueprint.** §4, §4.1, §4.4.

---

## 1. MTA (`mta.yaml`)

| Module / resource | Type | Notes |
|---|---|---|
| `order-conf-srv` | `nodejs` | CAP service. Memory sized for trial quota (e.g. 256–512 MB; measure). Requires `order-conf-uaa`, `order-conf-destination`, `anthropic-api`. |
| `order-conf-db-deployer` | `hdb` | **Only if HANA Cloud is used.** Default is SQLite in the app, reseeded at start. |
| `order-conf-app-content` | `com.sap.application.content` | Deploys the four zipped UI5 apps to the HTML5 repo. |
| `order-conf-destination-content` | `com.sap.application.content` | Destination `order-conf-srv-api` for the managed approuter + Work Zone (`HTML5.DynamicDestination`, `forwardAuthToken`). |
| `order-conf-uaa` | `org.cloudfoundry.managed-service` `xsuaa` | From `xs-security.json`, with `role-collections` and `oauth2-configuration.redirect-uris` for Work Zone. |
| `order-conf-destination` | `destination` (lite) | Also holds `S4_SANDBOX`. |
| `order-conf-html5-host` | `html5-apps-repo` `app-host` | |
| `anthropic-api` | `org.cloudfoundry.existing-service` | Created manually; **not** defined with the key in `mta.yaml`. |

## 2. Secrets

```sh
cf create-user-provided-service anthropic-api -p '{"apiKey":"<key>"}'
# rotate: cf update-user-provided-service anthropic-api -p '{"apiKey":"<new>"}' && cf restage order-conf-srv
```

- The LLM client reads `apiKey` from `VCAP_SERVICES` at start (Phase 4).
- The sandbox `APIKey` stays in the `S4_SANDBOX` destination (additional header), created in the cockpit, not in the MTA.
- Check: `cf env order-conf-srv` output is never pasted into tickets or chats.

## 3. SQLite on CF

- The app recreates and seeds the SQLite database at every start (§4.1). Acceptable for the demo: restarts reset the demo.
- Document the effect: data is lost on restage/restart (also good as a "demo reset").
- Optional HANA Cloud trial: note that the instance stops every night and must be restarted before a demo.

## 4. Role collections

| Role collection | Role template | Demo user |
|---|---|---|
| `OrderConf_Sales` | `Sales` | Sales rep |
| `OrderConf_SupplyPlanner` | `SupplyPlanner` | Supply Chain Planner |
| `OrderConf_ProductionPlanner` | `ProductionPlanner` | Production Planner |

Assign in the BTP cockpit to the trial users. Keep a short "who has which role" table in the runbook (Phase 10).

## 5. Work Zone site

- Content Manager → Channel Manager: refresh the HTML5 apps content provider.
- Add the four apps; create groups/spaces:
  - **Sales**: Sales Order Feasibility, Order Assistant.
  - **Supply Planning**: Supply Planning Workbench, Order Assistant.
  - **Production**: Production Capacity Workbench, Order Assistant.
- Map Work Zone roles to the role collections.
- Verify cross-app navigation (semantic objects from Phase 7) and A5 deep links resolve inside the site.
- Optional: Work Zone notifications for A5 events if they can be set up on trial; otherwise the in-app notification list is the channel.

## 6. Pipeline

- `mbt build` + `cf deploy` scripted (`npm run deploy`); document in `CLAUDE.md`.
- Optional: SAP Continuous Integration and Delivery or GitHub Actions deploy job (needs CF credentials as CI secrets; the Anthropic key is **not** needed in CI because it lives in the user-provided service).

## 7. Smoke tests on CF

- [ ] Each role sees only its spaces and can't call other roles' actions (403).
- [ ] Scenario 1 clicks through in Work Zone with live Claude calls.
- [ ] `LlmCallLog` rows written; no key or customer names in `cf logs`.
- [ ] Restart resets the demo data.
- [ ] Sandbox "live data" view works through the destination.

## Exit criteria

- [ ] Demo reachable through the Work Zone site URL for the three demo users.
- [ ] Deployment and key rotation documented.

# Phase 6: Hybrid mode and BTP deployment

[← Development plan](README.md) · Previous: [Phase 5](phase-5-sales-feasibility.md) · Next: [Phase 7](phase-7-llm-agents.md)

**Goal:** the apps run on BTP trial in Work Zone, and the Live data dialog reads the S/4HANA CAL system for every S/4 API that is active there (§4.1, §4.3). Needs [phase 0.8](phase-0-setup.md#08-s4hana-cal-system-manual-from-about-2026-10-0809).

Claude prepares the config. The user runs every `cf`, `mbt`, `cds bind` and cockpit step.

## 6.1 Hybrid

- [ ] Put `[hybrid]` credentials in `package.json` for each S/4 API that phase 0.8 marked "Yes" in the "Active in CAL" column: the CAL Gateway URL plus the service path (`/sap/opu/odata/sap/<API>`) and the client. User and password of the technical user come from a git-ignored `.env`, scoped to the profile (`cds.requires.<API>.[hybrid].credentials.username=…` / `password=…`), so that `cds watch` without a profile keeps mocking. `cds bind` to the `S4_CAL` destination is the alternative. If the CAL system is only reachable through a Cloud Connector (open decision 8), local hybrid cannot reach it; test against CAL from the deployed app instead.
- [ ] Run `cds watch --profile hybrid`. Compare the CAL payloads with the mocks, then fix the field mappings in `srv/lib/s4/`, the `$select` lists and date handling (OData V2 dates).
- [ ] Add a read-only **Live data** dialog to each case app: it calls the same tools for a CAL sales order item, material or work center (the ones noted in phase 0.8) and shows the result with the `s4` badge (§4.3). Capacity load per day has no standard API and keeps the `mock` badge (open decision 7). The scripted scenarios keep running on mocks, because the CAL system has SAP's standard demo data, not the §8 story (open decision 9).

## 6.2 Production configuration

- [ ] Decide open decision 2 (SQLite or HANA Cloud). Default: SQLite inside the app, reseeded at every start (§4.1); then skip `cds add hana`. With HANA: `cds add hana`, and the HANA trial must be started before each test (it stops every night).
- [ ] Run `cds add mta xsuaa destination html5-repo approuter`.
- [ ] Add `[production]` credentials for each S/4 API active in CAL: `destination: S4_CAL` plus the path. APIs that are not active in CAL are **not** remote dependencies in production; they stay mocked through the local mock path from phase 2 (open decision 3).
- [ ] In `mta.yaml`, set about 256M memory per module (raise `-srv` in phase 7 if needed). The destination resource only binds the destination service and does **not** define `S4_CAL`. With a Cloud Connector (open decision 8), also bind the connectivity service.
- [ ] Set up `app/router/xs-app.json` routes for the three OData services, `DemoService` and the HTML5 repo.

## 6.3 Deploy

- [ ] In the BTP cockpit, create `S4_CAL` manually: URL = CAL Gateway host and port from phase 0.8, `BasicAuthentication` with the technical user, `ProxyType: Internet` (or `OnPremise` with a Cloud Connector), additional property `sap-client` = the CAL client.
- [ ] Run `mbt build`, `cf login`, then `cf deploy mta_archives/sap-sales-order-confirmation_<version>.mtar`.

## 6.4 Work Zone

- [ ] Run `cds add workzone-standard`. Change the destinations module's `content.instance` to `content.subaccount`, because Work Zone's HTML5 Apps provider only reads subaccount destinations (lesson from the TM project). `S4_CAL` is not touched.
- [ ] Each app has its own `crossNavigation` inbound with a title, subtitle (`flpSubtitle` in i18n) and icon (phases 3–5).
- [ ] Keep the `dataSources` URIs relative (`odata/v4/...`) so they resolve under the managed approuter.
- [ ] Redeploy, then check that all three apps are listed under **HTML5 → Application Repository** in the BTP cockpit.
- [ ] In Work Zone, open **Channel Manager** and refresh the **HTML5 Apps** provider.
- [ ] In **Content Manager → Content Explorer → HTML5 Apps**, add the three apps.
- [ ] In **My Content**, create the groups *Sales* (Sales Order Feasibility), *Supply Planning* (Supply Planning Workbench) and *Production* (Production Capacity Workbench), and assign the apps to the **Everyone** role. That role only controls tile visibility; data access is enforced by `@requires` / `@restrict` and the role collections.
- [ ] In the **Site Directory**, create the site `Order Confirmation` and open it.
- [ ] Assign the role collections `OrderConf_Sales`, `OrderConf_SupplyPlanner` and `OrderConf_ProductionPlanner` to the trial users. Log out and back in after changing roles.
- [ ] Check that the A5 deep links and the cross-app navigation resolve inside the site.

**Exit criteria:** all three apps run through the approuter in the Work Zone site, the Live data dialog shows CAL data with the `s4` badge, each user is refused on the other roles' services (403), and scenario 1 works in the cloud with template texts.

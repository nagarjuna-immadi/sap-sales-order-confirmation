# Phase 6: Hybrid mode and BTP deployment

[← Development plan](README.md) · Previous: [Phase 5](phase-5-sales-feasibility.md) · Next: [Phase 7](phase-7-llm-agents.md)

**Goal:** the apps run on BTP trial in Work Zone, against the real sandbox for every S/4 API that has one (§4.1, §4.3).

Claude prepares the config. The user runs every `cf`, `mbt`, `cds bind` and cockpit step.

## 6.1 Hybrid

- [ ] Put `[hybrid]` credentials in `package.json` for each S/4 API that phase 0 marked "Yes": the sandbox base URL plus the path. The `APIKey` header comes from a git-ignored `.env`, one line per service and scoped to the profile (`cds.requires.<API>.[hybrid].credentials.headers.APIKey=…`), so that `cds watch` without a profile keeps mocking. `cds bind` to the destination is the alternative.
- [ ] Run `cds watch --profile hybrid`. Compare real payloads with the mocks, then fix the field mappings in `srv/lib/s4/`, the `$select` lists and date handling (OData V2 dates).
- [ ] Add a read-only **Live data** dialog to each case app: it calls the same tools for a sandbox material or order and shows the result with the `sandbox` badge (§4.3). The scripted scenarios keep running on mocks, because the sandbox does not contain the §8 story.

## 6.2 Production configuration

- [ ] Decide open decision 2 (SQLite or HANA Cloud). Default: SQLite inside the app, reseeded at every start (§4.1); then skip `cds add hana`. With HANA: `cds add hana`, and the HANA trial must be started before each test (it stops every night).
- [ ] Run `cds add mta xsuaa destination html5-repo approuter`.
- [ ] Add `[production]` credentials for each available S/4 API: `destination: S4_SANDBOX` plus the path. APIs without a working sandbox are **not** remote dependencies in production; they stay mocked through the local mock path from phase 2.
- [ ] In `mta.yaml`, set about 256M memory per module (raise `-srv` in phase 7 if needed). The destination resource only binds the destination service and does **not** define `S4_SANDBOX`.
- [ ] Set up `app/router/xs-app.json` routes for the three OData services, `DemoService` and the HTML5 repo.

## 6.3 Deploy

- [ ] In the BTP cockpit, create `S4_SANDBOX` manually (URL = sandbox base from phase 0.1, `NoAuthentication`, additional property `URL.headers.APIKey`).
- [ ] Run `mbt build`, `cf login`, then `cf deploy mta_archives/sap-sales-order-confirmation_<version>.mtar`.

## 6.4 Work Zone

- [ ] Run `cds add workzone-standard`. Change the destinations module's `content.instance` to `content.subaccount`, because Work Zone's HTML5 Apps provider only reads subaccount destinations (lesson from the TM project). `S4_SANDBOX` is not touched.
- [ ] Each app has its own `crossNavigation` inbound with a title, subtitle (`flpSubtitle` in i18n) and icon (phases 3–5).
- [ ] Keep the `dataSources` URIs relative (`odata/v4/...`) so they resolve under the managed approuter.
- [ ] Redeploy, then check that all three apps are listed under **HTML5 → Application Repository** in the BTP cockpit.
- [ ] In Work Zone, open **Channel Manager** and refresh the **HTML5 Apps** provider.
- [ ] In **Content Manager → Content Explorer → HTML5 Apps**, add the three apps.
- [ ] In **My Content**, create the groups *Sales* (Sales Order Feasibility), *Supply Planning* (Supply Planning Workbench) and *Production* (Production Capacity Workbench), and assign the apps to the **Everyone** role. That role only controls tile visibility; data access is enforced by `@requires` / `@restrict` and the role collections.
- [ ] In the **Site Directory**, create the site `Order Confirmation` and open it.
- [ ] Assign the role collections `OrderConf_Sales`, `OrderConf_SupplyPlanner` and `OrderConf_ProductionPlanner` to the trial users. Log out and back in after changing roles.
- [ ] Check that the A5 deep links and the cross-app navigation resolve inside the site.

**Exit criteria:** all three apps run through the approuter in the Work Zone site, the Live data dialog shows sandbox data, each user is refused on the other roles' services (403), and scenario 1 works in the cloud with template texts.

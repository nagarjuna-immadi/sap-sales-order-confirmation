# Phase 9: Hybrid mode and BTP deployment

[← Development plan](README.md) · Previous: [Phase 8](phase-8-cal-setup.md) · Next: [Phase 10](phase-10-demo-readiness.md)

**Goal:** all four apps run on BTP trial in Work Zone, with Claude texts from A2–A5 and the Order Assistant, and the Live data dialog reads the S/4HANA CAL system for every S/4 API that is active there (§4.1, §4.3). Needs [phase 8](phase-8-cal-setup.md).

Claude prepares the config. The user runs every `cf`, `mbt`, `cds bind` and cockpit step.

## 9.1 Hybrid

- [ ] Put `[hybrid]` credentials in `package.json` for each S/4 API that phase 8.3 marks as active in CAL: the CAL Gateway URL plus the service path (`/sap/opu/odata/sap/<API>`) and the client. User and password of the technical user come from the git-ignored `.env` (which already holds the Anthropic key from phase 6), scoped to the profile (`cds.requires.<API>.[hybrid].credentials.username=…` / `password=…`), so that `cds watch` without a profile keeps mocking. `cds bind` to the `S4_CAL` destination is the alternative. If the CAL system is only reachable through a Cloud Connector (open decision 8), local hybrid cannot reach it; test against CAL from the deployed app instead.
- [ ] Run `cds watch --profile hybrid`. Compare the CAL payloads with the mocks, then fix the field mappings in `srv/lib/s4/`, the `$select` lists and date handling (OData V2 dates).
- [ ] Add a read-only **Live data** dialog to each case app: it calls the same tools for a CAL sales order item, material or work center (the ones noted in phase 8.6) and shows the result with the `s4` badge (§4.3). Capacity load per day has no standard API and keeps the `mock` badge (open decision 7). The scripted scenarios keep running on mocks, because the CAL system has SAP's standard demo data, not the §8 story (open decision 9).

## 9.2 Production configuration

- [ ] Decide open decision 2 (SQLite or HANA Cloud). Default: SQLite inside the app, reseeded at every start (§4.1); then skip `cds add hana`. With HANA: `cds add hana`, and the HANA trial must be started before each test (it stops every night).
- [ ] Run `cds add mta xsuaa destination html5-repo approuter`.
- [ ] Add `[production]` credentials for each S/4 API active in CAL: `destination: S4_CAL` plus the path. APIs that are not active in CAL are **not** remote dependencies in production; they stay mocked through the local mock path from phase 2 (open decision 3).
- [ ] **Trial quota:** the user runs `cf org-quota` and `cf apps`. In `mta.yaml`, set about 256M memory per module and more for `-srv`, because `@cap-js/agents` brings LangChain / LangGraph (check the memory use after the first deploy). The destination resource only binds the destination service and does **not** define `S4_CAL`. With a Cloud Connector (open decision 8), also bind the connectivity service.
- [ ] `mta.yaml`: add the resource `sap-sales-order-confirmation-llm` (`org.cloudfoundry.existing-service`) and require it in `-srv` (phase 6 reads it through `"vcap": { "name": "sap-sales-order-confirmation-llm" }`).
- [ ] `mta.yaml`: the `order-assistant` html5 module and its zip in the app deployer, next to the three case apps. The Order Assistant's `manifest.json` gets `sap.cloud.service`.
- [ ] Set up `app/router/xs-app.json` routes for the three OData services, `DemoService` and the HTML5 repo, plus `^/?a2a/(.*)$` to `srv-api` with `csrfProtection: true` in the router and in the Order Assistant's own `xs-app.json` (the A2A client fetches the token with the agent card).

## 9.3 Deploy

- [ ] In the BTP cockpit, create `S4_CAL` manually: URL = CAL Gateway host and port from phase 8.1, `BasicAuthentication` with the technical user, `ProxyType: Internet` (or `OnPremise` with a Cloud Connector), additional property `sap-client` = the CAL client.
- [ ] Commands for the user, in order:
  1. `cf login`
  2. `cf create-user-provided-service sap-sales-order-confirmation-llm -p '{"apiKey":"<anthropic key>"}'`: creates the key holder once. It survives redeploys and is never in git. To rotate: `cf update-user-provided-service …` and `cf restage`. Use the credential name that the phase 6.0 spike found for the plugin's `vcap` lookup, and adjust the `-p` JSON.
  3. `mbt build`
  4. `cf deploy mta_archives/sap-sales-order-confirmation_<version>.mtar`

## 9.4 Work Zone

- [ ] Run `cds add workzone-standard`. Change the destinations module's `content.instance` to `content.subaccount`, because Work Zone's HTML5 Apps provider only reads subaccount destinations (lesson from the TM project). `S4_CAL` is not touched.
- [ ] Each app has its own `crossNavigation` inbound with a title, subtitle (`flpSubtitle` in i18n) and icon (phases 3–5 and 7).
- [ ] Keep the `dataSources` URIs relative (`odata/v4/...`, `a2a/order-assistant/`) so they resolve under the managed approuter.
- [ ] Redeploy, then check that all four apps are listed under **HTML5 → Application Repository** in the BTP cockpit.
- [ ] In Work Zone, open **Channel Manager** and refresh the **HTML5 Apps** provider.
- [ ] In **Content Manager → Content Explorer → HTML5 Apps**, add the four apps.
- [ ] In **My Content**, create the groups *Sales* (Sales Order Feasibility), *Supply Planning* (Supply Planning Workbench) and *Production* (Production Capacity Workbench), add **Order Assistant** to all three groups, and assign the apps to the **Everyone** role. That role only controls tile visibility; data access is enforced by `@requires` / `@restrict` and the role collections.
- [ ] In the **Site Directory**, create the site `Order Confirmation` and open it.
- [ ] Assign the role collections `OrderConf_Sales`, `OrderConf_SupplyPlanner` and `OrderConf_ProductionPlanner` to the trial users. Log out and back in after changing roles.
- [ ] Check that the A5 deep links, the cross-app navigation and the *Ask about this case* buttons resolve inside the site.

**Exit criteria:** all four apps run through the approuter in the Work Zone site, the Live data dialog shows CAL data with the `s4` badge, each user is refused on the other roles' services (403), scenario 1 works in the cloud with Claude texts on all four agents, and scenario 6 works in the Order Assistant in the site.

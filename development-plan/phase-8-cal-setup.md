# Phase 8: S/4HANA CAL system

[← Development plan](README.md) · Previous: [Phase 7](phase-7-order-assistant.md) · Next: [Phase 9](phase-9-deployment.md)

**Goal:** the S/4HANA CAL system is ready for the live reads of phase 9: the eight OData services from [phase 0.1](phase-0-setup.md#01-download-the-api-metadata-from-the-hub-manual) are active, a display-only technical user can read them, their `$metadata` matches the Hub EDMX, and open decisions 3 and 8 are decided (§4.3, §10.9).

All steps are manual: the user works in SAP GUI and the CAL console, and Claude gives the steps and records the results in this file. No code changes; phases 1–7 keep running on mocks. Never write passwords into this file or anywhere else in git.

## 8.1 CAL instance

- [x] The CAL instance (fully-activated appliance) is running, and SAP GUI logon works (2026-10-06).
- [ ] Note the host, the HTTPS port of the SAP Gateway, the business client and the release in the table below.
- [ ] Suspend the instance when nobody is working on it (it is billed while it runs).

| Item | Value |
| --- | --- |
| Host | open |
| Gateway HTTPS port | open |
| Business client | open (usually `100`) |
| S/4HANA release | open |
| Admin user | `BPINST` |

## 8.2 Logon

Users and Gateway registrations exist per client, so all steps below run in the business client.

- [ ] Log on to the business client and check it with **System → Status** (*Client*). `DDIC` exists in every client; use it only to unlock or set up the admin user, not for Gateway work.
- [ ] `BPINST` was locked on the first logon (2026-10-06). Unlock it as `DDIC` in the same client: `SU01` → user `BPINST` → **Lock/Unlock** (Ctrl+F5) → **Unlock**. If the password is unknown, reset it: **Change** → tab **Logon Data** → new initial password, save; SAP asks for a new one at the next logon.
- [ ] Log on as `BPINST` in the business client.

## 8.3 Activate the OData services

In `/IWFND/MAINT_SERVICE` (**Service Catalog**), for each service in the table:

1. **Filter** → *External Service Name* (wildcards work, e.g. `*SALES_ORDER*`). The catalog shows the technical name with a `Z` prefix (e.g. `ZAPI_SALES_ORDER_SRV`); the URL uses the external name. If a row appears, the service is registered: select it and check **ICF Nodes** (lower left). Green means active; otherwise **ICF Node → Activate**.
2. Not in the catalog: **Add Service** → *System Alias* `LOCAL` → *Technical Service Name* → **Get Services** → select the row (BOM: version `0002`) → **Add Selected Services** → keep the proposed names, **Local Object** (`$TMP`), ICF node **None** (the services run through the generic node `/sap/opu/odata`, shown as `ODATA`), no default client → OK. A newly added service shows a grey status (`○○○`) on `ODATA`: select the row → **ICF Node → Activate** until it shows green (`○○■`). *"Backend Services are already registered for System Alias 'LOCAL'"* means step 1 applies: the service is already in the catalog.
3. Test: select the service → **SAP Gateway Client** (lower right, or `/IWFND/GW_CLIENT`) → GET `<path>/$metadata` must return HTTP 200 with XML. Then one data read, e.g. `<path>/A_SalesOrderItem?$top=3&$format=json`.

If a test fails: `/IWFND/ERROR_LOG` shows the error (double-click the entry); `SU53` shows a missing authorization; after a metadata change, run `/IWFND/CACHE_CLEANUP` and `/IWBEP/CACHE_CLEANUP`.

| Service | Version | Gateway path | Registered | ICF active | `$metadata` 200 |
| --- | --- | --- | --- | --- | --- |
| `API_SALES_ORDER_SRV` | 0001 | `/sap/opu/odata/sap/API_SALES_ORDER_SRV` | Yes (2026-10-06) | Yes (2026-10-06) | open |
| `API_PRODUCT_AVAILY_INFO_BASIC` | 0001 | `/sap/opu/odata/sap/API_PRODUCT_AVAILY_INFO_BASIC` | Yes (2026-10-06) | Yes (2026-10-06) | open |
| `API_MATERIAL_STOCK_SRV` | 0001 | `/sap/opu/odata/sap/API_MATERIAL_STOCK_SRV` | Yes (2026-10-06) | Yes (2026-10-06) | open |
| `API_BILL_OF_MATERIAL_SRV` | **0002** | `/sap/opu/odata/sap/API_BILL_OF_MATERIAL_SRV;v=0002` | Yes (2026-10-06) | Yes (2026-10-06) | open |
| `API_PRODUCT_SRV` | 0001 | `/sap/opu/odata/sap/API_PRODUCT_SRV` | Yes (2026-10-06) | Yes (2026-10-06) | open |
| `API_PLANNED_ORDERS` | 0001 | `/sap/opu/odata/sap/API_PLANNED_ORDERS` | Yes (2026-10-06) | Yes (2026-10-06) | open |
| `API_PRODUCTION_ORDER_2_SRV` | 0001 | `/sap/opu/odata/sap/API_PRODUCTION_ORDER_2_SRV` | Yes (2026-10-06) | Yes (2026-10-06) | open |
| `API_WORK_CENTERS` | 0001 | `/sap/opu/odata/sap/API_WORK_CENTERS` | Yes (2026-10-06) | Yes (2026-10-06) | open |

A service counts as **active in CAL** when all three columns say Yes. Phase 9 adds `[hybrid]` and `[production]` credentials only for those; the others stay mocked ([open decision 3](README.md#open-decisions)).

## 8.4 Technical user

- [ ] In `SU01`, create a user of type **System** (no dialog logon, but HTTP basic auth works), e.g. `ORDERCONF_RO`. Its password goes into the password manager, the git-ignored `.env` (phase 9.1) and the BTP destination (phase 9.3), never into git.
- [ ] In `PFCG`, create a single role (e.g. `ZORDERCONF_API_DISPLAY`) and assign it to the user:
  - **Menu → Authorization Default**: add the eight Gateway services (the F4 help lists them). This generates the `S_SERVICE` authorizations.
  - **Authorizations**: display only (activity `03`) for the business objects behind the services (sales orders, materials, stock, BOMs, planned and production orders, work centers). No create, change or delete activities.
  - Generate the profile and save.
- [ ] Log on as that user to each `$metadata` URL from 8.3 (browser, basic auth). Fill missing display authorizations from `SU53` / `/IWFND/ERROR_LOG` until every read in 8.6 works. A write must fail.

## 8.5 Compare the metadata

- [ ] Open each `https://<host>:<port><path>/$metadata?sap-client=<client>` and compare it with the Hub EDMX in `srv/external/`: the version, `DeliveryPriority` on `A_SalesOrderItem`, and the fields in [the real names table](phase-0-setup.md#real-s4-names).
- [ ] If a service differs: download its `$metadata` from the CAL system, replace `srv/external/<API>.edmx` and re-import it ([phase 0.3](phase-0-setup.md)). Note the differences here.

## 8.6 Sample data for the Live data dialog

The appliance has SAP's standard demo data, not the §8 story ([open decision 9](README.md#open-decisions)).

- [ ] Read a few rows of each entity set we use (see the [real names table](phase-0-setup.md#real-s4-names)), and note the keys the phase 9 Live data dialog will use:

| Live data input | Value |
| --- | --- |
| Sales order + item (with a delivery priority, if any is set) | open |
| Material + plant (with stock and a BOM) | open |
| Work center + plant | open |

- [ ] Call `DetermineAvailabilityOf` for that material and plant (`GET …/API_PRODUCT_AVAILY_INFO_BASIC/DetermineAvailabilityOf?Material='…'&SupplyingPlant='…'&ATPCheckingRule='A'&RequestedQuantityInBaseUnit=…`) and note whether checking rule `A` works there.

## 8.7 Capacity load per bucket (open decision 7)

- [ ] Read `A_WorkCenterCapPerBucket(P_CapEvalStartDate=datetime'<YYYY-MM-DD>T00:00:00',P_CapEvalEndDate=datetime'<YYYY-MM-DD>T00:00:00',P_CapEvalBucketType='<type>')/Set?$filter=WorkCenter eq '<work center>'` for the work center from 8.6, with daily buckets (the bucket type is a 1-character code; find the code for days in the F4 help or the API documentation). Note here whether it returns available capacity, requirement and utilization per day. The decision itself stays in phase 11.

## 8.8 How BTP reaches the system (open decision 8)

- [ ] From a browser **outside** the CAL instance (your own PC), open `https://<host>:<port>/sap/opu/odata/sap/API_SALES_ORDER_SRV/$metadata?sap-client=<client>`. If the port is closed, check the instance's access points / firewall rules in the CAL console.
- [ ] Reachable: internet destination (`ProxyType: Internet`, `BasicAuthentication`). The appliance usually has a self-signed certificate; note whether the destination needs `TrustAll` (demo only). Not reachable: Cloud Connector (`ProxyType: OnPremise`), and local hybrid cannot reach CAL (phase 9.1).
- [ ] Record the decision in the [README](README.md#open-decisions).

**Exit criteria:** the table in 8.3 is filled in, every service marked active returns its `$metadata` and the 8.6 reads as the technical user, a write as that user fails, the keys in 8.6 are noted, and open decisions 3 and 8 are recorded.

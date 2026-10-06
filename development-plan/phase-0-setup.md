# Phase 0: Setup and API verification

[← Development plan](README.md) · Next: [Phase 1](phase-1-core-model.md)

**Goal:** a CAP project that starts with mocked S/4 services and returns the §8 demo orders.

## 0.1 Download the API metadata from the Hub (manual)

For each API in §4.2: `API_SALES_ORDER_SRV`, `API_PRODUCT_AVAILY_INFO_BASIC`, `API_MATERIAL_STOCK_SRV`, `API_BILL_OF_MATERIAL_SRV`, `API_PRODUCT_SRV`, `API_PLANNED_ORDERS`, `API_PRODUCTION_ORDER_2_SRV`, `API_WORK_CENTERS` (all from the S/4HANA **private cloud / on-premise** package). The Hub supplies the EDMX only; its sandbox (*Try Out*) is not used (blueprint §4.3), because it is not offered for `API_SALES_ORDER_SRV` (0001, checked 2026-10-06) or `API_WORK_CENTERS` (2025FPS01). Live reads come from the S/4HANA CAL system ([0.8](#08-s4hana-cal-system-manual-from-about-2026-10-0809)). The EDMX results are in the [EDMX check](#edmx-check-done-2026-10-06) table below.

- [x] Note the OData version: all eight are **V2** (`Edmx Version="1.0"`, `DataServiceVersion="2.0"`, checked in the EDMX files).
- [x] Confirm the state on api.sap.com (the EDMX does not carry it): all eight are **ACTIVE** (checked 2026-10-06).
- [x] Download the EDMX to `srv/external/` (all 8, see the table below).
- [x] Rename each file to its EDMX namespace (`OP_API_SALES_ORDER_SRV_0001.edmx` → `API_SALES_ORDER_SRV.edmx`) **before** `cds import`, so that the `.cds` file, the service name, the `cds.requires` key and the CSV file prefix are all the same name. The Hub adds the `OP_` prefix and the `_000n` version suffix; drop both. Note that the planned orders namespace has no `_SRV`. Done 2026-10-06: `srv/external/` now holds `<namespace>.edmx`.
- [x] **Capacity load per day:** the plan assumed there is no API for it (§4.2), but `API_WORK_CENTERS` has the capacity evaluation `A_WorkCenterCapPerBucket` (available capacity, requirement, remaining capacity and utilization per work center and bucket). It can be tried in the CAL system (0.8). Until then, capacity load stays mock-only, and the API is a pilot candidate (phase 10). See [open decision 7](README.md#open-decisions).
- [x] Note the sales order business event specification (*SalesOrder Created / Changed*) payload, for the "Simulate S/4 event" button in phase 2. Done 2026-10-06, see [Sales order event check](#sales-order-event-check-done-2026-10-06).

### Sales order event check (done 2026-10-06)

Hub event object *Sales Order Events* 1.0.0 (not *Sales Order Without Charge Events*), downloaded as AsyncAPI 2.0.0 JSON to `srv/external/SalesOrderEvents.asyncapi.json`. It holds 23 event types; the demo uses two:

| Event type (CloudEvents `type`) | Payload fields (all strings, none marked required) |
|---|---|
| `sap.s4.beh.salesorder.v1.SalesOrder.Created.v1` | `SalesOrder` (10), `SalesOrderType` (4), `SalesOrganization` (4), `DistributionChannel` (2), `OrganizationDivision` (2), `SoldToParty` (10), `EventRaisedDateTime` (date-time) |
| `sap.s4.beh.salesorder.v1.SalesOrder.Changed.v1` | same as Created |

- **Envelope:** CloudEvents 1.0. Required: `id`, `specversion` (`"1.0"`), `source`, `type`; optional: `subject`, `time`, `datacontenttype` (`application/json`). The payload above is the `data` part.
- **Notification only:** the payload has no items, quantities, dates or `DeliveryPriority`. The handler reads the full order through the sales order adapter (`A_SalesOrder`, `A_SalesOrderItem`, `A_SalesOrderScheduleLine`), in `mock` and in `s4` mode alike.
- Item-level events (`ItemCreated` / `ItemChanged`) add only `SalesOrderItem`, `SalesOrderItemCategory` and `Product`, still without quantity or priority. Not used in the demo; `Deleted` is not used either.

### EDMX check (done 2026-10-06)

All eight files are OData **V2** (`edmx:Edmx Version="1.0"`), so every service is `kind: odata-v2`.

| Downloaded from the Hub as | Namespace (= file name in `srv/external/`) | Hub version | Entity sets we read | Function imports | Active in CAL |
| --- | --- | --- | --- | --- | --- |
| `OP_API_SALES_ORDER_SRV_0001.edmx` | `API_SALES_ORDER_SRV` | 0001 | `A_SalesOrder`, `A_SalesOrderItem`, `A_SalesOrderScheduleLine` | 2 write (approval release / reject) | open |
| `OP_API_PRODUCT_AVAILY_INFO_BASIC_0001.edmx` | `API_PRODUCT_AVAILY_INFO_BASIC` | 0001 | none (functions only) | 3 **read** (GET): `DetermineAvailabilityOf`, `DetermineAvailabilityAt`, `CalculateAvailabilityTimeseries` | open |
| `OP_API_MATERIAL_STOCK_SRV.edmx` | `API_MATERIAL_STOCK_SRV` | – | `A_MatlStkInAcctMod` (`A_MaterialStock` is only material + unit) | none | open |
| `OP_API_BILL_OF_MATERIAL_SRV_0002.edmx` | `API_BILL_OF_MATERIAL_SRV` | 0002 | `MaterialBOM`, `MaterialBOMItem` (no `A_` prefix) | 1 read (GET): `ExplodeBOM`; 5 write | open |
| `OP_API_PRODUCT_SRV_0001.edmx` | `API_PRODUCT_SRV` | 0001 | `A_Product`, `A_ProductDescription`, `A_ProductPlant`, `A_ProductSupplyPlanning` | none | open |
| `OP_API_PLANNED_ORDERS_SRV_0001.edmx` | `API_PLANNED_ORDERS` | 0001 | `A_PlannedOrder`, `A_PlannedOrderCapacity` | 2 write (scheduling) | open |
| `OP_API_PRODUCTION_ORDER_2_SRV_0001.edmx` | `API_PRODUCTION_ORDER_2_SRV` | 0001 | `A_ProductionOrder_2`, `A_ProductionOrderOperation_2` | 11 write (release, convert, close, …) | open |
| `OP_API_WORK_CENTERS_0001.edmx` | `API_WORK_CENTERS` | 0001 | `A_WorkCenters`, `A_WorkCenterCapacity`, `A_WorkCenterCapacityInterval`, `A_WorkCenterCapPerBucket` (parameterized) | none | open |

**Gateway service name and path:** the namespace is also the Gateway service name in S/4 (the CAL system and the Private Cloud), and every EDMX holds its own path: `/sap/opu/odata/sap/<namespace>`. The Hub only adds `OP_` (on-premise package) and the version to the file name. One exception: the BOM service is version 2, so its path is `/sap/opu/odata/sap/API_BILL_OF_MATERIAL_SRV;v=0002` (without `;v=0002` the Gateway serves version 1). Phase 8 uses these paths in the credentials.

The only function imports the app may call are the GET ones (ATP, `ExplodeBOM`). The write function imports stay in the imported model but are never called (S/4 stays read-only).

## 0.2 Scaffold the project

- [x] Add `.gitignore` first: `.env`, `default-env.json`, `.cdsrc-private.json`, `node_modules/`, `gen/`, `mta_archives/`, `*.mtar`, `*.sqlite`.
- [x] Run `cds init` in place, as an ES module (`"type": "module"`), then add `@sap/cds`, `@cap-js/sqlite`, `@sap/xssec`, and (dev) `@sap/cds-dk`.
- [x] `package.json` scripts: `start`, `watch` (`cds watch`), `watch-hybrid` (`cds watch --profile hybrid`).
- [x] Add an ESLint rule (`no-restricted-imports`) for `@anthropic-ai/sdk`. Changed 2026-10-06: the SDK is not allowed anywhere, because all Claude calls go through `@cap-js/agents` (phase 6).
- [x] Add a grep check that fails on the word "copilot" in `app/`, `srv/` and `db/` (`npm run check:wording`; run by hand, no CI).
- [x] Put the run commands into `CLAUDE.md`.

## 0.3 Import the S/4 services

- [x] Run `cds import srv/external/<API>.edmx --as cds` for each API from 0.1 (after the renaming). Done 2026-10-06 with `@sap/cds-dk` 10.1: `srv/external/<namespace>.cds` next to each EDMX. `API_PRODUCT_AVAILY_INFO_BASIC` reports "There are no entities in the OData model", which is expected (functions only).
- [x] In `package.json` → `cds.requires`, add each API (`kind: odata-v2`, `model: srv/external/<API>`). No credentials yet; the `[hybrid]` and `[production]` entries come in phase 8. `cds import` wrote all eight entries itself.
- [x] Check how the importer maps the V2 dates: `Edm.DateTime` with `sap:display-format="Date"` (requested and confirmed delivery dates, order dates) should become `Date`, the rest `DateTime`. Phase 8 compares this against real payloads from the CAL system. Result: as expected. All `display-format="Date"` properties became `Date` (e.g. `RequestedDeliveryDate`, `ConfirmedDeliveryDate`, `SalesOrderDate`, `PlndOrderPlannedStartDate`); the ATP result's `PeriodStartUTCDateTime` / `PeriodEndUTCDateTime` (no display format) became `DateTime`; `Edm.Time` became `Time`; `Edm.DateTimeOffset` became `Timestamp` (or `DateTime` at precision 0, as in planned orders). The production order's `LastChangeDateTime` is `String(14)` already in SAP's EDMX. We read none of the change stamps.
- [x] Check what the importer makes of the parameterized `A_WorkCenterCapPerBucket` / `A_WorkCenterCapOrderPerBucket` (a `…Parameters` entity with a `Set` navigation). The generic CSV mock cannot serve it; see 0.4. Result: two plain entities, no CDS parameters. `A_WorkCenterCapPerBucket` has the three parameters (`P_CapEvalStartDate`, `P_CapEvalEndDate`, `P_CapEvalBucketType`) as keys and a `Set` association; `A_WorkCenterCapPerBucketSet` repeats them as keys (9 keys in all) with a `Parameters` association back. Both associations have no ON condition, so the mock cannot navigate `…(…)/Set`; it could only list the `…Set` entity flat. Same for `A_WorkCenterCapOrderPerBucket`. Capacity load stays in the local mock (phase 1).
- [x] Set `max_get_url_length: 8192` on each service (lesson from the TM project: CAP's default turns long GETs into `POST $batch`, which the S/4 gateway rejects with `403 x-csrf-token: Required` unless a CSRF token is fetched first). Set in each `cds.requires` entry (CAP's default is 1028); `cds env requires` shows it on all eight.
- [x] Fix any import errors the compiler reports (as with `not null default null` in the TM project). Note the fix here, so it can be redone after every re-import. Result: none. All eight compile, deploy to SQLite and are mocked by `cds serve all --with-mocks --in-memory` without errors, so nothing needs redoing after a re-import.
- [x] Write down the real entity set, key and field names in the table [below](#real-s4-names). Most important: the **delivery priority** property on the sales order item (§7 A2). Re-checked against the imported model on 2026-10-06: every entity, key and field in the table exists as written; `A_SalesOrderItem.DeliveryPriority` is `String(2)`.

## 0.4 Mock data (`srv/external/data/`)

Generated by `node scripts/gen-mock-data.js [--base YYYY-MM-DD]`. Dates are relative to the base date (default: today), so re-run it when the dates get stale. All values come from §8 and must stay consistent across files.

- [x] Sales orders and items: `SO-5001` and `SO-5004` (NORMAL, 100 × FG-100, due D+9), `SO-5005` (C-1001, 100 × FG-100, priority `01`, requested D+5), `SO-5006` (C-1002, 50 × FG-300, priority `02`, requested D+6), `SO-5007` (C-1003, 10 × FG-300, priority `03`).
- [x] Products: FG-100 Gearbox Assembly, SFG-200 Gear Housing, RAW-1 Aluminium Casting, RAW-2 Bearing Set, FG-300 Pump Unit, with MRP lot-size data (FG-100 exact lot size).
- [x] BOM: FG-100 → 1 SFG-200; SFG-200 → 1.05 RAW-1 + 0.05 RAW-2.
- [x] Stock plant 1000: FG-100 0, SFG-200 0, RAW-1 150, RAW-2 20, FG-300 20. Plant 1100: FG-300 200.
- [x] Work centers plant 1000: WC-MACH-01 200/day, WC-ASSY-01 100/day (primary for FG-100), WC-ASSY-02 80/day (alternative production version).
- [x] Planned / production orders: SO-5001 on WC-ASSY-01 D+1, SO-5004 on WC-ASSY-01 D+2. No open receipts for FG-100.
- [x] Data that has no standard S/4 API goes into local mock entities in phase 1 (not in the generator) (capacity load per day, last movement and monthly demand for slow movers, customers with penalty clause).
- [x] CSV file names must match the imported namespace and entity (`<namespace>-<Entity>.csv`, for example `API_SALES_ORDER_SRV-A_SalesOrderItem.csv`). CAP reads an empty cell as `NULL`, so a `not null` string that should be empty is written as a quoted `""`.
- [x] **Composite keys:** every key field needs a value. `A_MatlStkInAcctMod` has 11 key fields (Batch, Supplier, Customer, WBS element, SD document and item, special stock type are `""` for plain plant stock; `InventoryStockType` `01` = unrestricted). `MaterialBOM` has 7 and `MaterialBOMItem` 8 (category `M`, variant `1`, version and change document `""`). `A_WorkCenters` is keyed by `WorkCenterInternalID` + `WorkCenterTypeCode` (`A`); the readable name `WC-ASSY-01` is the non-key `WorkCenter` field.
- [x] **Order ↔ work center:** planned and production order headers carry no work center. SO-5001 / SO-5004 need a row in `A_PlannedOrderCapacity` (planned order) or `A_ProductionOrderOperation_2` (production order) with `WorkCenter = WC-ASSY-01`.
- [x] **ATP:** `API_PRODUCT_AVAILY_INFO_BASIC` has only function imports, which CAP's generic mock does not compute. Phase 2 handles it with a mock handler that calculates from the stock CSV and returns the `AvailabilityRecord` shape (`AvailableQuantityInBaseUnit`, period start / end).
- [x] **BOM explosion:** `ExplodeBOM` is a function import too. A3 explodes level by level over `MaterialBOMItem` in every profile, so no mock handler is needed.
- [x] **Capacity units:** S/4 capacity is in time units (`WorkCenterCapacityUnit`, usually hours); §8 uses pieces per day (200/day, 100/day, 80/day). The local `CapacityLoad` mock keeps pieces per day; an `s4` reader would convert with the operation's standard value. Recorded under the consequences below.

### Mock data result (done 2026-10-06)

`scripts/gen-mock-data.js` writes 15 CSV files (base date 2026-10-06 in the committed files). Under `cds watch` the mocks serve them at `/odata/v4/api-sales-order-srv/…` and so on; SO-5005 item `10` has `DeliveryPriority` `01`, and quoted `""` keys come back as empty strings. Choices that §8 leaves open:

- **Order keys:** `SalesOrder` is the §8 name itself (`SO-5005`), item `10`, schedule line `1`; all orders are in plant `1000` (`ProductionPlant`).
- **SO-5001 / SO-5004:** customer C-1002, priority `03`, already confirmed for D+9 (confirmed quantity 100). SO-5005, SO-5006 and SO-5007 are new: confirmed quantity 0, no confirmed date. **SO-5007** is requested for D+7.
- **Prices** (EUR per piece, for `NetAmount` and the penalty): FG-100 1,250, FG-300 480. SO-5005 is worth 125,000 EUR, so 2%/day late is 2,500 EUR per day.
- **SO-5001 / SO-5004** are production orders (`1000001` released, `1000002` created), each with one operation `0010` on WC-ASSY-01 on D+1 / D+2. There are no planned orders.
- **Lot size:** `EX` for every product and plant. Procurement: FG and SFG in-house (`E`), RAW external (`F`, 10 and 7 days delivery).
- **Stock:** one row per material and plant in storage location `0001`, including the 0 rows for FG-100 and SFG-200, so the starting position shows on the index page.
- **Work centers:** `A_WorkCenters` + `A_WorkCenterCapacity` (capacity in hours, `H`). `A_WorkCenterCapacityInterval` is not filled. The §8 names (`WC-ASSY-01`) are 10 characters, while S/4 `WorkCenter` is `String(8)`; SQLite does not check the length, and the CAL system has its own names (phase 8 maps them).
- **No `$expand`:** the imported associations (`to_Item`, `to_ScheduleLine`, `to_ProductionOrderOperation`, `to_BillOfMaterialItem`, …) have no ON condition, like the capacity bucket ones in 0.3. Against the mocks, adapters read each entity flat and filter by the parent key; `$expand` is only possible against the real S/4 service.

## 0.5 Local users

- [x] In `.cdsrc.json`, use `auth: mocked` with users `supplychain_user` (SupplyPlanner), `production_user` (ProductionPlanner) and `sales_user` (Sales). Add one `demo_user` user with all three roles for walking through scenarios.

The users are under the `[development]` profile, so `cds watch` and `npm run watch-hybrid` use them and production uses XSUAA. CAP's sample users (`alice`, `bob`, …) and the `*` wildcard are switched off, so any other user name gets 401. In the browser login, enter the user name and leave the password empty.

## 0.6 Smoke check

- [x] Under `cds watch`, open the CAP index page (`http://localhost:4004`) and read the mocked sales orders from `API_SALES_ORDER_SRV` (no extra service needed: `cds watch` serves the mocks). Check that SO-5005 item `10` in `A_SalesOrderItem` has delivery priority `01` (the field is on the item, not on `A_SalesOrder`). Done 2026-10-06.

## 0.7 Accounts and keys (manual)

- [x] BTP trial account with Cloud Foundry, BAS (or local VS Code with `@sap/cds-dk`), and the SAP Build Work Zone, standard edition subscription.
- [x] api.sap.com login (for the EDMX downloads; no API key needed).
- [x] Anthropic Console account, a workspace only for this project with a monthly spend limit, and an API key (§4.4). Needed from phase 6.

## 0.8 S/4HANA CAL system (manual, from about 2026-10-08/09)

Not part of the phase 0 exit criteria: phases 1–7 run on mocks. Finish it before phase 8.

- [ ] The CAL instance (fully-activated appliance) is running. Note the host, the HTTPS port of the SAP Gateway, the client number and the release. Suspend the instance when nobody is working on it (it is billed while it runs).
- [ ] Activate the eight OData services from 0.1 in `/IWFND/MAINT_SERVICE` (search for the namespace name from the table below; for the BOM service activate version `0002`; system alias `LOCAL`). Record the result in the "Active in CAL" column (Yes / No).
- [ ] Create a technical user with display authorizations only for these services. Its password goes into the password manager, a git-ignored `.env` or the BTP destination, never into git.
- [ ] Open `…/sap/opu/odata/sap/API_SALES_ORDER_SRV/$metadata?sap-client=<client>` in the browser as that user. Compare each service's `$metadata` with the Hub EDMX (version, `DeliveryPriority` on `A_SalesOrderItem`, the fields in [the real names table](#real-s4-names)). If they differ, download `$metadata` from the CAL system and re-import it (0.3).
- [ ] Read a few rows of each entity set we use, and note one sales order item, one material + plant and one work center from the appliance's standard data for the phase 8 Live data dialog.
- [ ] Try `A_WorkCenterCapPerBucket` with daily buckets on that work center (open decision 7).
- [ ] Decide how BTP reaches the system ([open decision 8](README.md#open-decisions), blueprint §10.9): directly over the internet (destination `ProxyType: Internet`, basic auth) if the Gateway port is reachable from outside, otherwise through a Cloud Connector (`ProxyType: OnPremise`).

**Exit criteria:** `cds watch` serves the mocked sales orders and SO-5005 shows delivery priority `01`.

## Real S/4 names

Read from the downloaded EDMX files on 2026-10-06 and re-checked against the `cds import` result (0.3) the same day: all names match.

| Real S/4 names | Entity set | Key | Notes |
| --- | --- | --- | --- |
| Sales order header | `A_SalesOrder` | `SalesOrder` | Customer `SoldToParty`; `RequestedDeliveryDate` (header level); `TransactionCurrency`, `TotalNetAmount`. Items via `to_Item` |
| Sales order item (incl. **delivery priority**, requested date) | `A_SalesOrderItem` | `SalesOrder`, `SalesOrderItem` | **`DeliveryPriority`** (`String(2)`, e.g. `01`); `Material`, `RequestedQuantity` + `RequestedQuantityUnit`, `ProductionPlant` (the plant), `NetAmount` (for the penalty), `ConfdDelivQtyInOrderQtyUnit`. The item has **no** requested date: take it from the schedule line, fall back to the header |
| Schedule line | `A_SalesOrderScheduleLine` | `SalesOrder`, `SalesOrderItem`, `ScheduleLine` | `RequestedDeliveryDate`, `ConfirmedDeliveryDate`, `ScheduleLineOrderQuantity`, `ConfdOrderQtyByMatlAvailCheck` |
| Product availability (function and result) | functions `DetermineAvailabilityOf` (qty → date), `DetermineAvailabilityAt` (date → qty), `CalculateAvailabilityTimeseries` | – | Parameters `Material`, `SupplyingPlant`, `ATPCheckingRule`, plus `RequestedQuantityInBaseUnit` or `RequestedUTCDateTime`. Result `AvailabilityRecord`: `AvailableQuantityInBaseUnit`, `BaseUnit`, `PeriodStartUTCDateTime`, `PeriodEndUTCDateTime` |
| Material stock | `A_MatlStkInAcctMod` | 11 fields: `Material`, `Plant`, `StorageLocation`, `Batch`, `Supplier`, `Customer`, `WBSElementInternalID`, `SDDocument`, `SDDocumentItem`, `InventorySpecialStockType`, `InventoryStockType` | Quantity `MatlWrhsStkQtyInMatlBaseUnit`; unrestricted = `InventoryStockType` `01`. Sum over storage locations per plant |
| BOM header / item | `MaterialBOM` / `MaterialBOMItem` | Header: `BillOfMaterial`, `BillOfMaterialCategory`, `BillOfMaterialVariant`, `BillOfMaterialVersion`, `EngineeringChangeDocument`, `Material`, `Plant`. Item: the same without `EngineeringChangeDocument`, plus `HeaderChangeDocument` and `BillOfMaterialItemNodeNumber` | Component `BillOfMaterialComponent`, quantity `BillOfMaterialItemQuantity` per `BOMHeaderQuantityInBaseUnit`, unit `BillOfMaterialItemUnit`, `ComponentScrapInPercent`. Items via `to_BillOfMaterialItem` |
| Product + MRP data (lot size) | `A_Product`, `A_ProductDescription`, `A_ProductSupplyPlanning` | `Product`; description `Product` + `Language`; supply planning `Product` + `Plant` | `ProductType`, `BaseUnit`; `ProductDescription`. Supply planning: **`LotSizingProcedure`** (`EX` = exact lot size for FG-100), `FixedLotSizeQuantity`, `MinimumLotSizeQuantity`, `MaximumLotSizeQuantity`, `LotSizeRoundingQuantity`, `ProcurementType` (`E` in-house / `F` external), `InHouseProductionTime`, `PlannedDeliveryDurationInDays`, `SafetyStockQuantity`. `A_ProductPlant` repeats some of these; read `A_ProductSupplyPlanning` |
| Planned order | `A_PlannedOrder` (+ `A_PlannedOrderCapacity`) | `PlannedOrder` | `Material`, `ProductionPlant`, `ProductionVersion`, `TotalQuantity`, `PlndOrderPlannedStartDate` / `EndDate`, `SalesOrder`, `SalesOrderItem`, `PlannedOrderIsFirm`. Work center only on `A_PlannedOrderCapacity.WorkCenter` (`to_PlannedOrderCapacity`) |
| Production order | `A_ProductionOrder_2` (+ `A_ProductionOrderOperation_2`) | `ManufacturingOrder` | `Material`, `ProductionPlant`, `ProductionVersion`, `TotalQuantity`, `MfgOrderScheduledStartDate` / `EndDate`, `SalesOrder`, `SalesOrderItem`, `OrderIsReleased`. Work center only on the operation (`WorkCenter`, `OpErlstSchedldExecStrtDte`; `to_ProductionOrderOperation`) |
| Work center + capacity | `A_WorkCenters`, `A_WorkCenterCapacity`, `A_WorkCenterCapacityInterval` | `WorkCenterInternalID`, `WorkCenterTypeCode`; capacity by `CapacityInternalID` | Readable ID `WorkCenter`, `Plant`, `WorkCenterDesc`, `CapacityInternalID`. Capacity: `CapacityPlanUtilizationPercent`, `CapOverloadThresholdInPercent`, `CapacityQuantityUnit`; available time per interval in `AvailableCapacityIntervalDurn` |
| Capacity load per bucket | `A_WorkCenterCapPerBucket(P_CapEvalStartDate, P_CapEvalEndDate, P_CapEvalBucketType)/Set` | 9 fields (parameters, `Plant`, `WorkCenter`, `CapacityInternalID`, `ShiftName`, `CapacityEvaluationTimePeriod`, `CapEvalBucketType`) | `WorkCenterAvailableCapacity`, `WorkCenterCapRqmtInCapUnit`, `WrkCtrRmngCapInCapUnit`, `WorkCenterTotUtilznInTmePerd`, `WorkCenterCapacityUnit`. Per order and operation: `A_WorkCenterCapOrderPerBucket(…)/Set`. Check it in the CAL system (0.8) |

**Consequences for later phases:**

- All services are `odata-v2`: phase 2 and phase 8 handle V2 dates (`/Date(…)/`) and V2 function import calls (`GET …/DetermineAvailabilityOf?Material='FG-100'&…`).
- One case per sales order item fits the key `SalesOrder` + `SalesOrderItem`. `DeliveryPriority` is a 2-character code, which matches open decision 4 (`01` / `02` / `03` + blank).
- The requested date lives on the schedule line (and the header), not on the item. `sales-order.js` reads the item, then its schedule lines (flat, filtered by order and item: the mocks cannot `$expand`, see 0.4), and takes the first schedule line's `RequestedDeliveryDate`.
- Plant is `ProductionPlant` on the item; ATP is called with `SupplyingPlant` = that plant.
- Stock and BOM have wide composite keys. Mock CSVs fill every key field, and `stock.js` / `bom.js` filter by material + plant and never read by key.
- "SO-5001 on WC-ASSY-01" means a planned-order capacity row or a production-order operation, not a header field. `orders.js` reads the header and then the capacity or operation rows (flat, filtered by order: no `$expand` against the mocks).
- `API_WORK_CENTERS` is read from the CAL system in `[hybrid]` / `[production]` like the other APIs (phase 8). `capacity-load.js` reads the local mock in every profile up to phase 9. Capacity load per day may later come from `A_WorkCenterCapPerBucket` instead of a custom API (open decision 7, phase 10). The phase 1 `CapacityLoad` mock mirrors its field names (available, requirement, remaining, utilization per work center and day), so that reader can be swapped in without changing A4.
- Lot size comes from `A_ProductSupplyPlanning.LotSizingProcedure` (+ the lot-size quantities) per product and plant, which is what `simulateLeftover(material, need, lotSizePolicy)` in phase 2 needs. The mock sets FG-100 to `EX`.

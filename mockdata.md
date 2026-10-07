# Mock data for the Fiori apps

Under `npm run watch` the database is in-memory SQLite. The master data (customers, lanes, work centers, the S/4 mock orders) loads from the CSV files, but **there are no cases at startup**: a case only exists after a sales order event. `resetDemo` also leaves 0 cases. After each restart of `cds watch` (including a reload on a file change), create the cases again.

## Demo orders

| Case | Order | Customer | Requested delivery | Lane | Status after intake |
|---|---|---|---|---|---|
| FC-0001 | SO-5005 | C-1001 | 2026-10-11 | HIGH | With Supply Planning |
| FC-0002 | SO-5006 | C-1002 | 2026-10-12 | MEDIUM | With Supply Planning |
| FC-0003 | SO-5007 | C-1003 | 2026-10-13 | NORMAL | Auto-confirmed |

Case IDs are assigned in the order the events arrive, from FC-0001 on.

## Create the cases

Run this once per order (server on `http://localhost:4004`, user `demo_user` with an empty password):

```sh
for so in SO-5005 SO-5006 SO-5007; do
  curl -s -u demo_user: -X POST -H "Content-Type: application/json" \
    -d "{\"salesOrder\":\"$so\"}" \
    http://localhost:4004/odata/v4/demo/simulateNewOrder
  echo
done
```

Each call returns the intake result, for example:

```json
{"value":[{"caseId":"FC-0001","salesOrder":"SO-5005","item":"10","created":true,"lane":"HIGH","status":"WITH_SUPPLY_PLANNING","laneChanged":false}]}
```

Check the count:

```sh
curl -s -u demo_user: "http://localhost:4004/odata/v4/sales/Cases?\$count=true&\$top=0"
```

Reset to an empty demo (scenario `default`, IDs from FC-0001 / CR-0001 again):

```sh
curl -s -u demo_user: -X POST -H "Content-Type: application/json" -d '{}' \
  http://localhost:4004/odata/v4/demo/resetDemo
```

The Demo panel in Sales Order Feasibility (log in as `demo_user`) does the same: simulated orders, priority change, scenario 4 and reset.

## Open the apps

Log in as `demo_user` (all three case roles).

- Sales Order Feasibility: `http://localhost:4004/order.conf.salesfeasibility/index.html`
- Supply Planning Workbench: `http://localhost:4004/order.conf.supplyworkbench/index.html`. FC-0001 and FC-0002 are waiting here.
- Production Capacity Workbench: `http://localhost:4004/order.conf.productionworkbench/index.html`. It stays empty until a supply planner requests a production check on FC-0001 or FC-0002, which creates a CR-nnnn capacity request.
- Order Assistant: `http://localhost:4004/order.conf.orderassistant/index.html?caseId=FC-0001`. Under plain `cds watch` it gives the `llm-mock` text; real answers need `npm run watch-hybrid`.

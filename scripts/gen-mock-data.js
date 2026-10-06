// Generates the mock CSV files for the imported S/4 services (blueprint §8).
//
//   node scripts/gen-mock-data.js [--base YYYY-MM-DD]
//
// Dates are relative to the base date (default: today). Re-run it when the
// dates get stale. Files are named <namespace>-<Entity>.csv, so CAP loads them
// into the mocked services. An empty cell is NULL; a quoted "" is an empty
// string (needed for the empty key fields of stock and BOM rows).
//
// Data without a standard S/4 API (capacity load per day, slow-mover movement
// and demand, customers with a penalty clause) is not here: it lives in the
// local mock entities of phase 1.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'srv', 'external', 'data')

const baseArg = process.argv.indexOf('--base')
const base = baseArg > 0 ? process.argv[baseArg + 1] : new Date().toISOString().slice(0, 10)
if (!/^\d{4}-\d{2}-\d{2}$/.test(base ?? '')) {
  console.error('Usage: node scripts/gen-mock-data.js [--base YYYY-MM-DD]')
  process.exit(1)
}

// D+n as YYYY-MM-DD (calendar days, as in §8)
const D = n => {
  const d = new Date(`${base}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// --- §8.1 master data ---------------------------------------------------------

const PRODUCTS = [
  // product, description, type, procurement, in-house days, planned delivery days
  { id: 'FG-100', text: 'Gearbox Assembly', type: 'FERT', proc: 'E', inHouse: 2, delivery: 0 },
  { id: 'SFG-200', text: 'Gear Housing', type: 'HALB', proc: 'E', inHouse: 1, delivery: 0 },
  { id: 'RAW-1', text: 'Aluminium Casting', type: 'ROH', proc: 'F', inHouse: 0, delivery: 10 },
  { id: 'RAW-2', text: 'Bearing Set', type: 'ROH', proc: 'F', inHouse: 0, delivery: 7 },
  { id: 'FG-300', text: 'Pump Unit', type: 'FERT', proc: 'E', inHouse: 2, delivery: 0 },
]

// Product per plant: plant 1000 has all five, plant 1100 only FG-300.
// Lot size: EX = exact lot size (FG-100: no leftover after producing 100).
const PRODUCT_PLANTS = [
  ...PRODUCTS.map(p => ({ product: p.id, plant: '1000' })),
  { product: 'FG-300', plant: '1100' },
]

const BOMS = [
  // header material → components per 1 piece
  { bom: '00000001', material: 'FG-100', text: 'Gearbox Assembly', items: [['SFG-200', 1]] },
  { bom: '00000002', material: 'SFG-200', text: 'Gear Housing', items: [['RAW-1', 1.05], ['RAW-2', 0.05]] },
]

const STOCK = [
  { material: 'FG-100', plant: '1000', qty: 0 },
  { material: 'SFG-200', plant: '1000', qty: 0 },
  { material: 'RAW-1', plant: '1000', qty: 150 },
  { material: 'RAW-2', plant: '1000', qty: 20 },
  { material: 'FG-300', plant: '1000', qty: 20 },
  { material: 'FG-300', plant: '1100', qty: 200 },
]

// Readable names as in §8. S/4 limits WorkCenter to 8 characters; SQLite does
// not enforce it, and the CAL system has its own (shorter) names.
// Pieces per day (200 / 100 / 80) live in the phase 1 CapacityLoad mock; S/4
// keeps capacity in hours.
const WORK_CENTERS = [
  { id: '10000001', wc: 'WC-MACH-01', desc: 'Machining', cap: '20000001' },
  { id: '10000002', wc: 'WC-ASSY-01', desc: 'Assembly line 1 (primary for FG-100)', cap: '20000002' },
  { id: '10000003', wc: 'WC-ASSY-02', desc: 'Assembly line 2 (alternative version)', cap: '20000003' },
]

// --- §8.2 / §8.3 sales orders -----------------------------------------------

const PRICE = { 'FG-100': 1250, 'FG-300': 480 } // EUR per piece

const SALES_ORDERS = [
  // SO-5001 / SO-5004: NORMAL orders already in production on WC-ASSY-01 (§8.2)
  { so: 'SO-5001', customer: 'C-1002', material: 'FG-100', qty: 100, prio: '03', ordered: D(-14), requested: D(9), confirmed: true },
  { so: 'SO-5004', customer: 'C-1002', material: 'FG-100', qty: 100, prio: '03', ordered: D(-7), requested: D(9), confirmed: true },
  // Scenarios 1–3: new orders, not confirmed yet
  { so: 'SO-5005', customer: 'C-1001', material: 'FG-100', qty: 100, prio: '01', ordered: D(0), requested: D(5), confirmed: false },
  { so: 'SO-5006', customer: 'C-1002', material: 'FG-300', qty: 50, prio: '02', ordered: D(0), requested: D(6), confirmed: false },
  { so: 'SO-5007', customer: 'C-1003', material: 'FG-300', qty: 10, prio: '03', ordered: D(0), requested: D(7), confirmed: false },
]

// Production orders for SO-5001 (D+1) and SO-5004 (D+2), both inside the
// frozen horizon. The header has no work center: it is on the operation.
// No other receipts for FG-100, and no planned orders.
const PRODUCTION_ORDERS = [
  { order: '1000001', so: 'SO-5001', day: 1, released: true },
  { order: '1000002', so: 'SO-5004', day: 2, released: false },
]

// --- CSV writing ----------------------------------------------------------------

const cell = v => {
  if (v === null || v === undefined) return ''
  if (v === '') return '""'
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

const files = {}
const write = (name, rows) => {
  const cols = Object.keys(rows[0])
  const lines = [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))]
  files[name] = rows.length
  writeFileSync(join(OUT, `${name}.csv`), lines.join('\n') + '\n')
}

mkdirSync(OUT, { recursive: true })

const product = id => PRODUCTS.find(p => p.id === id)

// API_SALES_ORDER_SRV

write('API_SALES_ORDER_SRV-A_SalesOrder', SALES_ORDERS.map(o => ({
  SalesOrder: o.so,
  SalesOrderType: 'OR',
  SalesOrganization: '1000',
  DistributionChannel: '10',
  OrganizationDivision: '00',
  SoldToParty: o.customer,
  SalesOrderDate: o.ordered,
  CreationDate: o.ordered,
  PurchaseOrderByCustomer: `PO-${o.so.slice(3)}`,
  RequestedDeliveryDate: o.requested,
  TransactionCurrency: 'EUR',
  TotalNetAmount: o.qty * PRICE[o.material],
  OverallSDProcessStatus: 'A',
})))

write('API_SALES_ORDER_SRV-A_SalesOrderItem', SALES_ORDERS.map(o => ({
  SalesOrder: o.so,
  SalesOrderItem: '10',
  SalesOrderItemCategory: 'TAN',
  SalesOrderItemText: product(o.material).text,
  Material: o.material,
  RequestedQuantity: o.qty,
  RequestedQuantityUnit: 'PC',
  OrderQuantityUnit: 'PC',
  TransactionCurrency: 'EUR',
  NetAmount: o.qty * PRICE[o.material],
  ProductionPlant: '1000',
  DeliveryPriority: o.prio,
  ConfdDelivQtyInOrderQtyUnit: o.confirmed ? o.qty : 0,
})))

write('API_SALES_ORDER_SRV-A_SalesOrderScheduleLine', SALES_ORDERS.map(o => ({
  SalesOrder: o.so,
  SalesOrderItem: '10',
  ScheduleLine: '1',
  RequestedDeliveryDate: o.requested,
  ConfirmedDeliveryDate: o.confirmed ? o.requested : null,
  OrderQuantityUnit: 'PC',
  ScheduleLineOrderQuantity: o.qty,
  ConfdOrderQtyByMatlAvailCheck: o.confirmed ? o.qty : 0,
  OpenConfdDelivQtyInOrdQtyUnit: o.confirmed ? o.qty : 0,
})))

// API_PRODUCT_SRV

write('API_PRODUCT_SRV-A_Product', PRODUCTS.map(p => ({
  Product: p.id,
  ProductType: p.type,
  BaseUnit: 'PC',
  IndustrySector: 'M',
  CreationDate: D(-365),
})))

write('API_PRODUCT_SRV-A_ProductDescription', PRODUCTS.map(p => ({
  Product: p.id,
  Language: 'EN',
  ProductDescription: p.text,
})))

write('API_PRODUCT_SRV-A_ProductPlant', PRODUCT_PLANTS.map(({ product: id, plant }) => ({
  Product: id,
  Plant: plant,
  MRPType: 'PD',
  MRPResponsible: '001',
  ProcurementType: product(id).proc,
  AvailabilityCheckType: '02',
  BaseUnit: 'PC',
})))

write('API_PRODUCT_SRV-A_ProductSupplyPlanning', PRODUCT_PLANTS.map(({ product: id, plant }) => ({
  Product: id,
  Plant: plant,
  MRPType: 'PD',
  MRPResponsible: '001',
  LotSizingProcedure: 'EX',
  FixedLotSizeQuantity: 0,
  MinimumLotSizeQuantity: 0,
  MaximumLotSizeQuantity: 0,
  LotSizeRoundingQuantity: 0,
  ProcurementType: product(id).proc,
  InHouseProductionTime: product(id).inHouse,
  PlannedDeliveryDurationInDays: product(id).delivery,
  SafetyStockQuantity: 0,
  AvailabilityCheckType: '02',
  BaseUnit: 'PC',
})))

// API_BILL_OF_MATERIAL_SRV (category M = material BOM, variant 1, usage 1 = production)

const bomKey = b => ({
  BillOfMaterial: b.bom,
  BillOfMaterialCategory: 'M',
  BillOfMaterialVariant: '1',
  BillOfMaterialVersion: '',
})

write('API_BILL_OF_MATERIAL_SRV-MaterialBOM', BOMS.map(b => ({
  ...bomKey(b),
  EngineeringChangeDocument: '',
  Material: b.material,
  Plant: '1000',
  BillOfMaterialVariantUsage: '1',
  BOMHeaderText: b.text,
  BillOfMaterialStatus: '01',
  IsMarkedForDeletion: false,
  BOMHeaderBaseUnit: 'PC',
  BOMHeaderQuantityInBaseUnit: 1,
})))

write('API_BILL_OF_MATERIAL_SRV-MaterialBOMItem', BOMS.flatMap(b => b.items.map(([component, qty], i) => ({
  ...bomKey(b),
  BillOfMaterialItemNodeNumber: String(i + 1),
  HeaderChangeDocument: '',
  Material: b.material,
  Plant: '1000',
  BillOfMaterialComponent: component,
  ComponentDescription: product(component).text,
  BillOfMaterialItemCategory: 'L',
  BillOfMaterialItemNumber: String((i + 1) * 10).padStart(4, '0'),
  BillOfMaterialItemQuantity: qty,
  BillOfMaterialItemUnit: 'PC',
  ComponentScrapInPercent: 0,
  ValidityStartDate: D(-365),
  ValidityEndDate: '9999-12-31',
}))))

// API_MATERIAL_STOCK_SRV (plain unrestricted plant stock, storage location 0001)

write('API_MATERIAL_STOCK_SRV-A_MaterialStock', PRODUCTS.map(p => ({
  Material: p.id,
  MaterialBaseUnit: 'PC',
})))

write('API_MATERIAL_STOCK_SRV-A_MatlStkInAcctMod', STOCK.map(s => ({
  Material: s.material,
  Plant: s.plant,
  StorageLocation: '0001',
  Batch: '',
  Supplier: '',
  Customer: '',
  WBSElementInternalID: '',
  SDDocument: '',
  SDDocumentItem: '',
  InventorySpecialStockType: '',
  InventoryStockType: '01',
  MaterialBaseUnit: 'PC',
  MatlWrhsStkQtyInMatlBaseUnit: s.qty,
})))

// API_WORK_CENTERS (plant 1000, type A = work center, two 8-hour shifts)

write('API_WORK_CENTERS-A_WorkCenters', WORK_CENTERS.map(w => ({
  WorkCenterInternalID: w.id,
  WorkCenterTypeCode: 'A',
  WorkCenter: w.wc,
  WorkCenterDesc: w.desc,
  Plant: '1000',
  WorkCenterCategoryCode: '0001',
  WorkCenterUsage: '009',
  CapacityInternalID: w.cap,
  ValidityStartDate: D(-365),
  ValidityEndDate: '9999-12-31',
})))

write('API_WORK_CENTERS-A_WorkCenterCapacity', WORK_CENTERS.map(w => ({
  CapacityInternalID: w.cap,
  Capacity: w.wc,
  CapacityCategoryCode: '001',
  CapacityActiveVersion: '01',
  CapacityIsFinite: false,
  CapacityNumberOfCapacities: 1,
  CapacityPlanUtilizationPercent: '100',
  CapOverloadThresholdInPercent: '100',
  Plant: '1000',
  FactoryCalendar: '01',
  CapacityStartTime: 6 * 3600,
  CapacityEndTime: 22 * 3600,
  CapacityQuantityUnit: 'H',
})))

// API_PRODUCTION_ORDER_2_SRV

const soOf = so => SALES_ORDERS.find(o => o.so === so)

write('API_PRODUCTION_ORDER_2_SRV-A_ProductionOrder_2', PRODUCTION_ORDERS.map(p => ({
  ManufacturingOrder: p.order,
  ManufacturingOrderCategory: '10',
  ManufacturingOrderType: 'PP01',
  OrderIsCreated: 'X',
  OrderIsReleased: p.released ? 'X' : '',
  MfgOrderCreationDate: soOf(p.so).ordered,
  Material: soOf(p.so).material,
  OrderInternalBillOfOperations: p.order,
  ProductionPlant: '1000',
  Plant: '1000',
  MRPController: '001',
  ProductionVersion: '0001',
  SalesOrder: p.so,
  SalesOrderItem: '10',
  MfgOrderPlannedStartDate: D(p.day),
  MfgOrderPlannedEndDate: D(p.day),
  MfgOrderScheduledStartDate: D(p.day),
  MfgOrderScheduledEndDate: D(p.day),
  ProductionUnit: 'PC',
  TotalQuantity: soOf(p.so).qty,
})))

const wcOf = name => WORK_CENTERS.find(w => w.wc === name)

write('API_PRODUCTION_ORDER_2_SRV-A_ProductionOrderOperation_2', PRODUCTION_ORDERS.map(p => ({
  OrderInternalBillOfOperations: p.order,
  OrderIntBillOfOperationsItem: '1',
  ManufacturingOrder: p.order,
  ManufacturingOrderSequence: '0',
  ManufacturingOrderOperation: '0010',
  MfgOrderOperationText: 'Final assembly',
  OperationIsReleased: p.released ? 'X' : '',
  ProductionPlant: '1000',
  WorkCenterInternalID: wcOf('WC-ASSY-01').id,
  WorkCenterTypeCode: 'A',
  WorkCenter: 'WC-ASSY-01',
  OperationControlProfile: 'PP01',
  OpErlstSchedldExecStrtDte: D(p.day),
  OpErlstSchedldExecEndDte: D(p.day),
  ErlstSchedldExecDurnInWorkdays: 1,
  OperationUnit: 'PC',
  OpPlannedTotalQuantity: soOf(p.so).qty,
})))

console.log(`Base date ${base}: wrote ${Object.keys(files).length} files to srv/external/data/`)
for (const [name, n] of Object.entries(files)) console.log(`  ${name}.csv (${n} rows)`)

// Planned and production order adapter: API_PLANNED_ORDERS and
// API_PRODUCTION_ORDER_2_SRV (blueprint §4.2, development plan 2.1).
//
// Headers carry no work center: it is on the planned-order capacity rows and
// the production-order operations (phase 0). Both are read flat and joined
// here, because the mock cannot $expand. A receipt with a sales order is
// pegged to it and is not free supply (plan 2.2).

import cds from '@sap/cds'
import { connect, sourceOf, isoDate, num, flag } from './connection.js'

const { SELECT } = cds.ql

const PLANNED = 'API_PLANNED_ORDERS'
const PRODUCTION = 'API_PRODUCTION_ORDER_2_SRV'

const PLANNED_HEADER = [
  'PlannedOrder',
  'Material',
  'ProductionPlant',
  'ProductionVersion',
  'TotalQuantity',
  'GoodsReceiptQty',
  'BaseUnit',
  'PlndOrderPlannedStartDate',
  'PlndOrderPlannedEndDate',
  'SalesOrder',
  'SalesOrderItem',
  'PlannedOrderIsFirm',
]
const PRODUCTION_HEADER = [
  'ManufacturingOrder',
  'Material',
  'ProductionPlant',
  'ProductionVersion',
  'TotalQuantity',
  'ProductionUnit',
  'MfgOrderPlannedStartDate',
  'MfgOrderPlannedEndDate',
  'MfgOrderScheduledStartDate',
  'MfgOrderScheduledEndDate',
  'SalesOrder',
  'SalesOrderItem',
  'OrderIsReleased',
  'OrderIsDeleted',
  'OrderIsMarkedForDeletion',
  'OrderIsTechnicallyCompleted',
  'OrderIsClosed',
]

// Flags are filtered here, not in the query: the mock has them as null.
const isOpen = order =>
  !flag(order.OrderIsDeleted) && !flag(order.OrderIsMarkedForDeletion) && !flag(order.OrderIsTechnicallyCompleted) && !flag(order.OrderIsClosed)

const inRange = (date, from, to) => date && (!from || date >= from) && (!to || date <= to)

/**
 * { order, type: PLANNED | PRODUCTION, material, plant, productionVersion, qty, unit,
 *   startDate, endDate, salesOrder, salesOrderItem, pegged, fixed, source }
 * fixed = firm planned order or released production order.
 */
const fromPlanned = (o, source) => ({
  order: o.PlannedOrder,
  type: 'PLANNED',
  material: o.Material,
  plant: o.ProductionPlant,
  productionVersion: o.ProductionVersion,
  qty: (num(o.TotalQuantity) ?? 0) - (num(o.GoodsReceiptQty) ?? 0),
  unit: o.BaseUnit,
  startDate: isoDate(o.PlndOrderPlannedStartDate),
  endDate: isoDate(o.PlndOrderPlannedEndDate),
  salesOrder: o.SalesOrder || null,
  salesOrderItem: o.SalesOrderItem || null,
  pegged: !!o.SalesOrder,
  fixed: !!o.PlannedOrderIsFirm,
  source,
})

const fromProduction = (o, source) => ({
  order: o.ManufacturingOrder,
  type: 'PRODUCTION',
  material: o.Material,
  plant: o.ProductionPlant,
  productionVersion: o.ProductionVersion,
  qty: num(o.TotalQuantity) ?? 0, // goods receipts are already in stock; the pilot subtracts them
  unit: o.ProductionUnit,
  startDate: isoDate(o.MfgOrderScheduledStartDate) ?? isoDate(o.MfgOrderPlannedStartDate),
  endDate: isoDate(o.MfgOrderScheduledEndDate) ?? isoDate(o.MfgOrderPlannedEndDate),
  salesOrder: o.SalesOrder || null,
  salesOrderItem: o.SalesOrderItem || null,
  pegged: !!o.SalesOrder,
  fixed: flag(o.OrderIsReleased),
  source,
})

/** Open planned and production orders (receipts) of a material in a plant, by end date. */
export async function getReceipts(material, plant) {
  const planned = await connect(PLANNED)
  const production = await connect(PRODUCTION)
  const plannedOrders = await planned.run(
    SELECT.from(planned.entities.A_PlannedOrder).columns(PLANNED_HEADER).where({ Material: material, ProductionPlant: plant }),
  )
  const productionOrders = await production.run(
    SELECT.from(production.entities.A_ProductionOrder_2).columns(PRODUCTION_HEADER).where({ Material: material, ProductionPlant: plant }),
  )
  return [
    ...plannedOrders.map(o => fromPlanned(o, sourceOf(PLANNED))),
    ...productionOrders.filter(isOpen).map(o => fromProduction(o, sourceOf(PRODUCTION))),
  ]
    .filter(r => r.qty > 0)
    .sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)))
}

/**
 * Orders scheduled on a work center between two dates (YYYY-MM-DD, inclusive):
 * [{ ...receipt, operation, operationText, workCenter, operationDate, operationQty }], by date.
 */
export async function getScheduledOrders(workCenter, plant, from, to) {
  const planned = await connect(PLANNED)
  const production = await connect(PRODUCTION)
  const { A_PlannedOrderCapacity, A_PlannedOrder } = planned.entities
  const { A_ProductionOrderOperation_2, A_ProductionOrder_2 } = production.entities

  const operations = await production.run(
    SELECT.from(A_ProductionOrderOperation_2)
      .columns('ManufacturingOrder', 'ManufacturingOrderOperation', 'MfgOrderOperationText', 'WorkCenter', 'ProductionPlant', 'OpErlstSchedldExecStrtDte', 'OpPlannedTotalQuantity')
      .where({ WorkCenter: workCenter, ProductionPlant: plant }),
  )
  const capacities = await planned.run(
    SELECT.from(A_PlannedOrderCapacity)
      .columns('PlannedOrder', 'Operation', 'OperationText', 'WorkCenter', 'MRPPlant', 'OperationEarliestStartDate')
      .where({ WorkCenter: workCenter, MRPPlant: plant }),
  )

  const productionOps = operations.filter(op => inRange(isoDate(op.OpErlstSchedldExecStrtDte), from, to))
  const plannedOps = capacities.filter(op => inRange(isoDate(op.OperationEarliestStartDate), from, to))

  const productionHeaders = productionOps.length
    ? await production.run(
        SELECT.from(A_ProductionOrder_2)
          .columns(PRODUCTION_HEADER)
          .where({ ManufacturingOrder: { in: [...new Set(productionOps.map(op => op.ManufacturingOrder))] } }),
      )
    : []
  const plannedHeaders = plannedOps.length
    ? await planned.run(
        SELECT.from(A_PlannedOrder)
          .columns(PLANNED_HEADER)
          .where({ PlannedOrder: { in: [...new Set(plannedOps.map(op => op.PlannedOrder))] } }),
      )
    : []

  const result = []
  for (const op of productionOps) {
    const header = productionHeaders.find(h => h.ManufacturingOrder === op.ManufacturingOrder)
    if (!header || !isOpen(header)) continue
    const receipt = fromProduction(header, sourceOf(PRODUCTION))
    result.push({
      ...receipt,
      operation: op.ManufacturingOrderOperation,
      operationText: op.MfgOrderOperationText,
      workCenter: op.WorkCenter,
      operationDate: isoDate(op.OpErlstSchedldExecStrtDte),
      operationQty: num(op.OpPlannedTotalQuantity) ?? receipt.qty,
    })
  }
  for (const op of plannedOps) {
    const header = plannedHeaders.find(h => h.PlannedOrder === op.PlannedOrder)
    if (!header) continue
    const receipt = fromPlanned(header, sourceOf(PLANNED))
    result.push({
      ...receipt,
      operation: op.Operation,
      operationText: op.OperationText,
      workCenter: op.WorkCenter,
      operationDate: isoDate(op.OperationEarliestStartDate),
      operationQty: receipt.qty,
    })
  }
  return result.sort((a, b) => a.operationDate.localeCompare(b.operationDate))
}

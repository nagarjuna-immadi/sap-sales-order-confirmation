// Sales order adapter: API_SALES_ORDER_SRV (blueprint §4.2, development plan 2.1).
//
// One domain object per item. The requested date lives on the schedule line,
// not on the item: take the first schedule line, fall back to the header
// (phase 0). Header, items and schedule lines are read flat and joined here,
// because the mock cannot $expand.

import cds from '@sap/cds'
import { connect, sourceOf, isoDate, num } from './connection.js'

const { SELECT } = cds.ql

const SERVICE = 'API_SALES_ORDER_SRV'

const HEADER = ['SalesOrder', 'SoldToParty', 'RequestedDeliveryDate', 'TransactionCurrency']
const ITEM = [
  'SalesOrder',
  'SalesOrderItem',
  'Material',
  'ProductionPlant',
  'RequestedQuantity',
  'RequestedQuantityUnit',
  'NetAmount',
  'TransactionCurrency',
  'DeliveryPriority',
  'ConfdDelivQtyInOrderQtyUnit',
]
const SCHEDULE_LINE = [
  'SalesOrder',
  'SalesOrderItem',
  'ScheduleLine',
  'RequestedDeliveryDate',
  'ConfirmedDeliveryDate',
  'ConfdOrderQtyByMatlAvailCheck',
]

/**
 * {
 *   salesOrder, item, customer, material, plant, quantity, quantityUnit,
 *   requestedDate, confirmedDate, confirmedQty, deliveryPriority,
 *   netAmount, currency, source
 * }
 */
const toItem = (header, item, lines, source) => {
  const first = lines[0]
  const confirmed = lines.find(l => num(l.ConfdOrderQtyByMatlAvailCheck) > 0)
  return {
    salesOrder: item.SalesOrder,
    item: item.SalesOrderItem,
    customer: header.SoldToParty,
    material: item.Material,
    plant: item.ProductionPlant,
    quantity: num(item.RequestedQuantity),
    quantityUnit: item.RequestedQuantityUnit,
    requestedDate: isoDate(first?.RequestedDeliveryDate) ?? isoDate(header.RequestedDeliveryDate),
    confirmedDate: isoDate(confirmed?.ConfirmedDeliveryDate),
    confirmedQty: num(item.ConfdDelivQtyInOrderQtyUnit) ?? 0,
    deliveryPriority: item.DeliveryPriority ?? '',
    netAmount: num(item.NetAmount),
    currency: item.TransactionCurrency ?? header.TransactionCurrency,
    source,
  }
}

const linesOf = (lines, item) =>
  lines
    .filter(l => l.SalesOrder === item.SalesOrder && l.SalesOrderItem === item.SalesOrderItem)
    .sort((a, b) => Number(a.ScheduleLine) - Number(b.ScheduleLine))

/** All items of a sales order, or [] when the order does not exist. */
export async function getSalesOrderItems(salesOrder) {
  const s4 = await connect(SERVICE)
  const { A_SalesOrder, A_SalesOrderItem, A_SalesOrderScheduleLine } = s4.entities
  const header = await s4.run(SELECT.one.from(A_SalesOrder).columns(HEADER).where({ SalesOrder: salesOrder }))
  if (!header) return []
  const items = await s4.run(SELECT.from(A_SalesOrderItem).columns(ITEM).where({ SalesOrder: salesOrder }))
  const lines = await s4.run(SELECT.from(A_SalesOrderScheduleLine).columns(SCHEDULE_LINE).where({ SalesOrder: salesOrder }))
  const source = sourceOf(SERVICE)
  return items
    .sort((a, b) => Number(a.SalesOrderItem) - Number(b.SalesOrderItem))
    .map(item => toItem(header, item, linesOf(lines, item), source))
}

/** One sales order item, or null. */
export async function getSalesOrderItem(salesOrder, item) {
  const items = await getSalesOrderItems(salesOrder)
  return items.find(i => i.item === item) ?? null
}

/**
 * Items of other orders for a material in a plant, e.g. to find lower-priority
 * orders whose confirmed stock could be reallocated (§7 A3).
 */
export async function getItemsForMaterial(material, plant) {
  const s4 = await connect(SERVICE)
  const { A_SalesOrder, A_SalesOrderItem, A_SalesOrderScheduleLine } = s4.entities
  const items = await s4.run(SELECT.from(A_SalesOrderItem).columns(ITEM).where({ Material: material, ProductionPlant: plant }))
  if (!items.length) return []
  const orders = [...new Set(items.map(i => i.SalesOrder))]
  const headers = await s4.run(SELECT.from(A_SalesOrder).columns(HEADER).where({ SalesOrder: { in: orders } }))
  const lines = await s4.run(SELECT.from(A_SalesOrderScheduleLine).columns(SCHEDULE_LINE).where({ SalesOrder: { in: orders } }))
  const source = sourceOf(SERVICE)
  return items
    .map(item => {
      const header = headers.find(h => h.SalesOrder === item.SalesOrder)
      return header && toItem(header, item, linesOf(lines, item), source)
    })
    .filter(Boolean)
}

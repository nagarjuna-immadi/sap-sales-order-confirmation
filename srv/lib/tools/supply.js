// Tools of the Supply & Inventory agent (A3; blueprint §7 A3, development plan 2.2).
// Read-only or pure. The ranking is deterministic and never decided by an LLM.
//
// Dates: a case's need-by date is requestedDate − shippingLeadDays; supply
// that is there by then meets the date. Stock transfers are counted as there
// on time (no transport lead time in the demo).

import { explodeBom as readBom, getBomItems } from '../s4/bom.js'
import { getStock as readStock } from '../s4/stock.js'
import { getReceipts } from '../s4/orders.js'
import { getSupplyPlanning } from '../s4/product.js'
import { getItemsForMaterial } from '../s4/sales-order.js'
import { getMovementStats } from '../s4/movement-stats.js'
import { qty } from '../s4/connection.js'
import { getPlanningParameters, laneOf, laneRanks } from './config.js'
import { earliestProductionFinish } from './capacity.js'
import { dateOf, offsetOf, today } from '../demo-clock.js'

const DAYS_PER_MONTH = 30
const round1 = value => (value == null ? null : Math.round(value * 10) / 10)
const sum = (rows, field) => qty(rows.reduce((total, row) => total + (row[field] ?? 0), 0))

// The Supply Planning action that carries out each ladder option (plan 1.4).
const ACTION = {
  LOCAL: 'confirmFromStock',
  TRANSFER: 'approveStockTransfer',
  REALLOCATE: 'approveReallocation',
  PRODUCE: 'requestProductionCheck',
  REJECT: 'reject',
}

// --- Read tools ---------------------------------------------------------------------

/** Gross multi-level requirements (BOM adapter): [{ material, parent, level, requiredQty, unit }]. */
export function explodeBom(material, plant, quantity) {
  return readBom(material, plant, quantity)
}

/** Unrestricted stock of a material in every plant: [{ material, plant, unrestrictedQty, unit, source }]. */
export function getStock(material) {
  return readStock(material)
}

/** Open receipts not pegged to a sales order: [{ order, type, material, plant, qty, date, source }]. */
export async function getOpenReceipts(material, plant) {
  const receipts = await getReceipts(material, plant)
  return receipts
    .filter(r => !r.pegged)
    .map(r => ({ order: r.order, type: r.type, material: r.material, plant: r.plant, qty: r.qty, date: r.endDate, source: r.source }))
}

/**
 * Slow movers and excess per plant (§7 A3), with the thresholds of `params`:
 * [{ material, plant, unrestrictedQty, daysSinceMovement, monthlyDemand, monthsOfSupply, daysOfSupply, slowMoving, excess }].
 * Only plants with stock and a movement history.
 */
export async function getSlowMovers(material, params) {
  const [stock, stats] = await Promise.all([readStock(material), getMovementStats(material)])
  return stats
    .map(s => {
      const onHand = stock.find(st => st.plant === s.plant)?.unrestrictedQty ?? 0
      const monthsOfSupply = s.monthlyDemand > 0 ? onHand / s.monthlyDemand : null
      const daysOfSupply = monthsOfSupply == null ? null : monthsOfSupply * DAYS_PER_MONTH
      return {
        material,
        plant: s.plant,
        unrestrictedQty: onHand,
        daysSinceMovement: s.daysSinceMovement,
        monthlyDemand: s.monthlyDemand,
        monthsOfSupply: round1(monthsOfSupply),
        daysOfSupply: round1(daysOfSupply),
        slowMoving: s.daysSinceMovement >= params.slowMovingAfterDays,
        excess: daysOfSupply != null && daysOfSupply > params.excessThresholdDays,
      }
    })
    .filter(s => s.unrestrictedQty > 0)
}

/**
 * Lot size and leftover when producing `need` (pure):
 * { lotQty, leftoverQty }. EXACT → the need; FIXED → whole fixed lots;
 * OTHER → at least the minimum lot, rounded up to the rounding quantity.
 */
export function simulateLeftover(material, need, lotSizePolicy) {
  const lot = lotSizePolicy ?? { policy: 'EXACT' }
  let lotQty = need
  if (need > 0 && lot.policy === 'FIXED' && lot.fixedQty > 0) lotQty = Math.ceil(need / lot.fixedQty) * lot.fixedQty
  if (need > 0 && lot.policy === 'OTHER') {
    lotQty = Math.max(need, lot.minimumQty ?? 0)
    if (lot.roundingQty > 0) lotQty = Math.ceil(lotQty / lot.roundingQty) * lot.roundingQty
  }
  return { material, lotQty: qty(lotQty), leftoverQty: qty(lotQty - need) }
}

/**
 * Supply held for orders of a lower lane that could go to this case (§7 A3
 * rank 3): stock confirmed to them, or receipts pegged to them that are there
 * by needDate. Only if that order stays covered by its own date from the
 * remaining unpegged stock and receipts, without new production.
 * c: { material, plant, quantity, needByDate, lane, salesOrder }
 * Returns [{ salesOrder, item, lane, qty, from: STOCK | RECEIPT, receipt, dueDate }].
 */
export async function findReallocationCandidates(c) {
  const [items, receipts, stock, ranks, params] = await Promise.all([
    getItemsForMaterial(c.material, c.plant),
    getReceipts(c.material, c.plant),
    readStock(c.material, [c.plant]),
    laneRanks(),
    getPlanningParameters(c.plant),
  ])
  const ownRank = ranks[c.lane] ?? ranks.NORMAL
  const localStock = stock[0]?.unrestrictedQty ?? 0
  const unpegged = receipts.filter(r => !r.pegged)
  const candidates = []
  for (const item of items) {
    if (item.salesOrder === c.salesOrder) continue
    const lane = await laneOf(item.deliveryPriority)
    if ((ranks[lane] ?? ranks.NORMAL) <= ownRank) continue

    const pegged = receipts.filter(r => r.salesOrder === item.salesOrder && r.salesOrderItem === item.item && r.endDate && r.endDate <= c.needByDate)
    const fromReceipts = sum(pegged, 'qty')
    const fromStock = fromReceipts > 0 ? 0 : Math.min(item.confirmedQty ?? 0, localStock)
    if (fromReceipts + fromStock <= 0) continue

    const dueDate = item.confirmedDate ?? item.requestedDate
    const itemShipBy = dueDate ? dateOf(offsetOf(dueDate) - params.shippingLeadDays) : null
    const remainingStock = Math.max(0, localStock - Math.min(localStock, c.quantity) - fromStock)
    const unpeggedByDue = sum(unpegged.filter(r => itemShipBy && r.endDate <= itemShipBy), 'qty')
    if (remainingStock + unpeggedByDue < item.quantity) continue // its own date would not hold

    candidates.push({
      salesOrder: item.salesOrder,
      item: item.item,
      lane,
      qty: fromReceipts || fromStock,
      from: fromReceipts ? 'RECEIPT' : 'STOCK',
      receipt: pegged[0]?.order ?? null,
      dueDate,
    })
  }
  return candidates
}

// --- Material tree --------------------------------------------------------------------

/**
 * Netted tree in the case plant: a component is needed only for the parent's
 * shortfall. [{ material, parent, level, requiredQty, availableQty, shortfallQty, unit, hasBom }]
 * FG-100 × 100 → FG 0/100, SFG-200 0/100, RAW-1 150/105, RAW-2 20/5 (§8.3).
 */
async function materialTree(material, plant, quantity) {
  const stockOf = async m => (await readStock(m, [plant]))[0]?.unrestrictedQty ?? 0
  const tree = []
  let level = [{ material, parent: null, requiredQty: qty(quantity), unit: null }]
  for (let depth = 0; level.length && depth <= 10; depth++) {
    const next = []
    for (const node of level) {
      const availableQty = await stockOf(node.material)
      const items = await getBomItems(node.material, plant)
      const shortfallQty = qty(Math.max(0, node.requiredQty - availableQty))
      tree.push({ ...node, level: depth, availableQty, shortfallQty, hasBom: items.length > 0 })
      if (shortfallQty <= 0) continue
      for (const item of items) {
        next.push({ material: item.component, parent: node.material, requiredQty: qty(shortfallQty * item.quantityPerPiece), unit: item.unit })
      }
    }
    level = next
  }
  return tree
}

// --- Earliest date and supply picture ---------------------------------------------------

/**
 * Earliest delivery date for the case (§7 A3 rank 5): stock and unpegged
 * receipts first, the rest from production on free capacity only (no order
 * moved), plus shippingLeadDays. opts.load replaces the stored capacity load.
 * Returns { date, offset, productionFinishDate, productionVersion, reason }; date null when nothing fits.
 */
export async function earliestDeliveryDate(c, { load } = {}) {
  const params = await getPlanningParameters(c.plant)
  const tree = c.tree ?? (await materialTree(c.material, c.plant, c.quantity))
  const receipts = c.openReceipts ?? (await getOpenReceipts(c.material, c.plant))
  const root = tree[0]
  const toProduce = qty(Math.max(0, root.shortfallQty - sum(receipts.filter(r => r.material === c.material), 'qty')))
  const lastReceipt = receipts.filter(r => r.material === c.material).map(r => offsetOf(r.date)).sort((a, b) => b - a)[0]
  const fromSupply = Math.max(0, lastReceipt ?? 0)
  if (toProduce <= 0) {
    const offset = fromSupply + params.shippingLeadDays
    return { date: dateOf(offset), offset, productionFinishDate: null, productionVersion: null, reason: null }
  }
  if (!root.hasBom || tree.some(n => !n.hasBom && n.shortfallQty > 0)) {
    return { date: null, offset: null, productionFinishDate: null, productionVersion: null, reason: 'Components are missing, so it cannot be produced from stock' }
  }
  const finish = await earliestProductionFinish({ material: c.material, plant: c.plant, quantity: toProduce, load })
  if (!finish) {
    return { date: null, offset: null, productionFinishDate: null, productionVersion: null, reason: 'No free capacity in the planning window (D+1 … D+5)' }
  }
  const offset = Math.max(finish.finishOffset, fromSupply) + params.shippingLeadDays
  return { date: dateOf(offset), offset, productionFinishDate: finish.finishDate, productionVersion: finish.productionVersion, reason: null }
}

/**
 * Everything A3 shows for a case (stored as SupplyResult).
 * c: { caseId, salesOrder, item, material, plant, quantity, requestedDate, lane }
 * opts.load replaces the stored capacity load (earliest date).
 */
export async function buildSupplyPicture(c, { load } = {}) {
  const params = await getPlanningParameters(c.plant)
  const quantity = Number(c.quantity)
  const needByDate = dateOf(offsetOf(c.requestedDate) - params.shippingLeadDays)
  const tree = await materialTree(c.material, c.plant, quantity)
  const materials = [...new Set(tree.map(n => n.material))]

  const stockRows = (await Promise.all(materials.map(m => readStock(m)))).flat()
  const stockPerPlant = stockRows.map(({ material, plant, unrestrictedQty, unit }) => ({ material, plant, unrestrictedQty, unit }))
  const openReceipts = (await Promise.all(materials.map(m => getOpenReceipts(m, c.plant)))).flat()
  const excessFlags = await getSlowMovers(c.material, params)
  const reallocationCandidates = await findReallocationCandidates({ ...c, quantity, needByDate })

  const supplyPlanning = await getSupplyPlanning(c.material, c.plant)
  const root = tree[0]
  const receiptsByNeed = sum(openReceipts.filter(r => r.material === c.material && r.date <= needByDate), 'qty')
  const toProduce = qty(Math.max(0, root.shortfallQty - receiptsByNeed))
  const leftover = simulateLeftover(c.material, toProduce, supplyPlanning?.lotSize)
  const demand = (await getMovementStats(c.material, [c.plant]))[0]?.monthlyDemand
  const leftoverDaysOfSupply = leftover.leftoverQty > 0 && demand > 0 ? round1((leftover.leftoverQty / demand) * DAYS_PER_MONTH) : null
  const excessWarning = leftover.leftoverQty > 0 && (leftoverDaysOfSupply == null || leftoverDaysOfSupply > params.excessThresholdDays)

  const earliestDelivery = await earliestDeliveryDate({ ...c, quantity, tree, openReceipts }, { load })
  const sources = new Set([...stockRows.map(r => r.source), ...openReceipts.map(r => r.source), supplyPlanning?.source].filter(Boolean))

  return {
    caseId: c.caseId ?? null,
    material: c.material,
    plant: c.plant,
    quantity,
    requestedDate: c.requestedDate,
    needByDate,
    materialTree: tree,
    stockPerPlant,
    openReceipts,
    excessFlags,
    reallocationCandidates,
    lotSize: supplyPlanning?.lotSize ?? null,
    toProduceQty: toProduce,
    leftoverQty: leftover.leftoverQty,
    leftoverDaysOfSupply,
    excessWarning,
    producible: root.hasBom && !tree.some(n => !n.hasBom && n.shortfallQty > 0),
    earliestDelivery,
    asOf: today(),
    source: sources.has('s4') ? 's4' : 'mock',
  }
}

// --- Decision ladder (pure) ---------------------------------------------------------------

/**
 * The §7 A3 ladder over a supply picture. Every option has
 * { optionId, rank, label, action, feasible, reason, ... }; the first feasible
 * one of ranks 1–4 is recommended, else rank 5 (reject with the earliest date).
 * Ranks 2–4 only appear when local supply is short.
 */
export function rankSupplyOptions(picture) {
  const { quantity, plant, material, needByDate } = picture
  const root = picture.materialTree[0]
  const localStock = Math.min(root.availableQty, quantity)
  const localReceipts = picture.openReceipts.filter(r => r.material === material && r.plant === plant && r.date <= needByDate)
  const fromReceipts = Math.min(sum(localReceipts, 'qty'), quantity - localStock)
  const local = qty(localStock + fromReceipts)
  const missing = qty(quantity - local)

  const options = [
    {
      optionId: 'S-LOCAL',
      rank: 1,
      label: `Confirm from plant ${plant}: ${localStock} from stock${fromReceipts ? `, ${fromReceipts} from open receipts` : ''}`,
      action: ACTION.LOCAL,
      fromStockQty: localStock,
      fromReceiptsQty: fromReceipts,
      receipts: localReceipts.map(r => r.order),
      feasible: missing <= 0,
      reason: missing > 0 ? `${missing} short in plant ${plant}` : null,
    },
  ]

  if (missing > 0) {
    const excess = new Map(picture.excessFlags.map(f => [f.plant, f]))
    const others = picture.stockPerPlant
      .filter(s => s.material === material && s.plant !== plant && s.unrestrictedQty > 0)
      .sort((a, b) => Number(!!excess.get(b.plant)?.excess) - Number(!!excess.get(a.plant)?.excess) || b.unrestrictedQty - a.unrestrictedQty)
    let open = missing
    const transfers = []
    for (const s of others) {
      if (open <= 0) break
      const take = Math.min(s.unrestrictedQty, open)
      const flags = excess.get(s.plant)
      transfers.push({ fromPlant: s.plant, qty: take, excess: !!flags?.excess, slowMoving: !!flags?.slowMoving, monthsOfSupply: flags?.monthsOfSupply ?? null, daysSinceMovement: flags?.daysSinceMovement ?? null })
      open = qty(open - take)
    }
    options.push({
      optionId: 'S-TRANSFER',
      rank: 2,
      label: transfers.length
        ? `${local} from plant ${plant}, stock transfer of ${transfers.map(t => `${t.qty} from plant ${t.fromPlant}${t.excess ? ' (excess)' : ''}`).join(', ')}`
        : 'Stock transfer from another plant',
      action: ACTION.TRANSFER,
      fromLocalQty: local,
      transfers,
      feasible: transfers.length > 0 && open <= 0,
      reason: open > 0 ? (transfers.length ? `${open} still short after transfers` : `No ${material} stock in other plants`) : null,
    })

    const reallocated = Math.min(sum(picture.reallocationCandidates, 'qty'), missing)
    options.push({
      optionId: 'S-REALLOCATE',
      rank: 3,
      label: picture.reallocationCandidates.length
        ? `Reallocate ${reallocated} from ${picture.reallocationCandidates.map(r => r.salesOrder).join(', ')}`
        : 'Reallocate from a lower-priority order',
      action: ACTION.REALLOCATE,
      fromLocalQty: local,
      candidates: picture.reallocationCandidates,
      feasible: reallocated >= missing,
      reason: reallocated >= missing ? null : picture.reallocationCandidates.length ? `${qty(missing - reallocated)} still short` : 'No lower-priority order can give up its supply and still meet its own date',
    })

    options.push({
      optionId: 'S-PRODUCE',
      rank: 4,
      label: `Production check for ${picture.toProduceQty} × ${material} by ${needByDate}`,
      action: ACTION.PRODUCE,
      fromLocalQty: local,
      produceQty: picture.toProduceQty,
      needByDate,
      leftoverQty: picture.leftoverQty,
      leftoverDaysOfSupply: picture.leftoverDaysOfSupply,
      excessWarning: picture.excessWarning,
      feasible: picture.producible,
      reason: picture.producible ? null : 'Components are missing or the material has no BOM',
    })
  }

  options.push({
    optionId: 'S-REJECT',
    rank: 5,
    label: picture.earliestDelivery?.date ? `Reject, earliest possible date ${picture.earliestDelivery.date}` : 'Reject, no possible date in the planning window',
    action: ACTION.REJECT,
    earliestDate: picture.earliestDelivery?.date ?? null,
    feasible: true,
    reason: picture.earliestDelivery?.reason ?? null,
  })

  const recommended = options.find(o => o.rank < 5 && o.feasible) ?? options.at(-1)
  return { options, recommendedOption: recommended.optionId }
}

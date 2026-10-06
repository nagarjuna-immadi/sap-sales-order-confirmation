// Tools of the Production Capacity Balancing agent (A4; blueprint §7 A4,
// development plan 2.0 and 2.2). Simulation only: nothing is rescheduled.
//
// - Operations run in routing sequence. An operation starts the day after the
//   previous one ends and fills free capacity (available − requirement) day by
//   day from its first day. New orders may use free capacity inside the frozen
//   horizon. Orders start on D+1 at the earliest.
// - O-ALT: an alternative production version on free capacity.
// - O-MOVE: the primary version; where an operation lacks free capacity, orders
//   of a lower lane on that work center and day are moved, whole, to the first
//   day after the frozen horizon.
// - No O-SPLIT or O-OVERTIME in the demo (plan 2.0).
// - Infeasible: the CR's needByDate is missed, or a moved order misses its own
//   date. An overload above 100% is not infeasible; it raises the score.
// - Score (lower is better): w1·peak + w2·spread + w3·frozen + w4·daysLate
//   + w5·setups + w6·overtime, utilization in percent over the planning window,
//   work centers without capacity left out.
//
// simulate() and score() are pure: they take the load grid and return new
// objects. generateOptions() reads the data and calls them.

import { getRouting, getWorkCenters as getWorkCenterMasters } from '../s4/work-center.js'
import { getLoad as readLoad } from '../s4/capacity-load.js'
import { getScheduledOrders as readScheduledOrders } from '../s4/orders.js'
import { getSalesOrderItem } from '../s4/sales-order.js'
import { getPlanningParameters, getScoringWeights, laneOf, laneRanks, PLANNING_WINDOW } from './config.js'
import { dateOf, offsetOf, label } from '../demo-clock.js'

const round = (value, digits = 1) => (value == null ? null : Math.round(value * 10 ** digits) / 10 ** digits)
const windowDates = () => ({ from: dateOf(PLANNING_WINDOW.from), to: dateOf(PLANNING_WINDOW.to) })

// --- Read tools -----------------------------------------------------------------

/**
 * Production versions of a material with their work centers, primary first:
 * [{ productionVersion, isPrimary, operations: [{ sequence, operation, operationText, workCenter, description, qtyPerPiece }], source }]
 */
export async function getWorkCenters(material, plant) {
  const [versions, masters] = await Promise.all([getRouting(material, plant), getWorkCenterMasters(plant)])
  return versions.map(v => ({
    ...v,
    operations: v.operations.map(op => ({ ...op, description: masters.find(m => m.workCenter === op.workCenter)?.description ?? null })),
  }))
}

/** Load per work center and day (capacity-load adapter), over the planning window by default. */
export function getLoad({ plant, workCenters, from, to } = {}) {
  const window = windowDates()
  return readLoad({ plant, workCenters, from: from ?? window.from, to: to ?? window.to })
}

/**
 * Orders on a work center in the planning window, with the lane and due date
 * of their sales order: [{ ...order, lane, dueDate }]. Orders without a sales
 * order (make-to-stock) count as NORMAL with no due date.
 */
export async function getScheduledOrders(workCenter, plant, { from, to } = {}) {
  const window = windowDates()
  const orders = await readScheduledOrders(workCenter, plant, from ?? window.from, to ?? window.to)
  const result = []
  for (const order of orders) {
    const item = order.salesOrder ? await getSalesOrderItem(order.salesOrder, order.salesOrderItem) : null
    result.push({
      ...order,
      lane: item ? await laneOf(item.deliveryPriority) : 'NORMAL',
      dueDate: item?.confirmedDate ?? item?.requestedDate ?? null,
    })
  }
  return result
}

// --- Load grid (pure) -------------------------------------------------------------

/** Load rows → { [workCenter]: { [dayOffset]: { available, requirement } } }. */
export function toGrid(loadRows) {
  const grid = {}
  for (const row of loadRows) {
    grid[row.workCenter] ??= {}
    grid[row.workCenter][row.dayOffset] = { available: row.availableCapacity ?? 0, requirement: row.requirement ?? 0 }
  }
  return grid
}

const cloneGrid = grid => Object.fromEntries(Object.entries(grid).map(([wc, days]) => [wc, Object.fromEntries(Object.entries(days).map(([d, c]) => [d, { ...c }]))]))

const free = cell => (cell ? Math.max(0, cell.available - cell.requirement) : 0)
const utilization = cell => (cell && cell.available > 0 ? (cell.requirement / cell.available) * 100 : null)

/** Grid → rows for before/after charts: [{ workCenter, date, dayOffset, availableCapacity, requirement, utilizationPercent }]. */
export function gridRows(grid) {
  const rows = []
  for (const wc of Object.keys(grid).sort()) {
    for (const day of Object.keys(grid[wc]).map(Number).sort((a, b) => a - b)) {
      const cell = grid[wc][day]
      rows.push({
        workCenter: wc,
        date: dateOf(day),
        dayOffset: day,
        availableCapacity: cell.available,
        requirement: cell.requirement,
        utilizationPercent: round(utilization(cell)),
      })
    }
  }
  return rows
}

// --- Simulation (pure) ------------------------------------------------------------

/**
 * Simulates one option on a copy of the grid.
 * option: { optionId, kind: 'ALT' | 'MOVE', version, label }
 * ctx: { grid, quantity, needByOffset, window: { from, to }, frozenHorizonDays, shippingLeadDays, movableOrders }
 * movableOrders: [{ order, salesOrder, workCenter, dayOffset, qty, laneRank, dueOffset }], only orders of a lower lane.
 * Returns { ...option, fits, slots, movedOrders, finishOffset, feasible, needsOverride, infeasibleReason, gridAfter }.
 */
export function simulate(option, ctx) {
  const grid = cloneGrid(ctx.grid)
  const slots = []
  const movedOrders = []
  let start = ctx.window.from

  for (const op of option.version.operations) {
    let remaining = ctx.quantity * (op.qtyPerPiece ?? 1)
    let lastDay = null
    for (let day = start; remaining > 0 && day <= ctx.window.to; day++) {
      const cell = grid[op.workCenter]?.[day]
      if (!cell) continue
      if (option.kind === 'MOVE' && free(cell) < remaining) {
        const candidates = ctx.movableOrders
          .filter(o => o.workCenter === op.workCenter && o.dayOffset === day && !movedOrders.some(m => m.order === o.order))
          .sort((a, b) => b.laneRank - a.laneRank || (b.dueOffset ?? Infinity) - (a.dueOffset ?? Infinity))
        for (const order of candidates) {
          if (free(cell) >= remaining) break
          const toOffset = Math.max(ctx.frozenHorizonDays + 1, day + 1)
          cell.requirement -= order.qty
          grid[op.workCenter][toOffset] ??= { available: 0, requirement: 0 }
          grid[op.workCenter][toOffset].requirement += order.qty
          const latestFinish = order.dueOffset == null ? null : order.dueOffset - ctx.shippingLeadDays
          movedOrders.push({
            order: order.order,
            salesOrder: order.salesOrder,
            workCenter: op.workCenter,
            qty: order.qty,
            fromOffset: day,
            toOffset,
            fromDate: dateOf(day),
            toDate: dateOf(toOffset),
            insideFrozenHorizon: day <= ctx.frozenHorizonDays,
            dueDate: order.dueOffset == null ? null : dateOf(order.dueOffset),
            daysLate: latestFinish == null ? 0 : Math.max(0, toOffset - latestFinish),
          })
        }
      }
      const take = Math.min(free(cell), remaining)
      if (take > 0) {
        cell.requirement += take
        remaining -= take
        lastDay = day
        slots.push({ workCenter: op.workCenter, operation: op.operation, dayOffset: day, date: dateOf(day), qty: take })
      }
    }
    if (remaining > 0) return { ...option, fits: false, slots, movedOrders, finishOffset: null, feasible: false, needsOverride: false, infeasibleReason: `No capacity on ${op.workCenter} in ${label(ctx.window.from)} … ${label(ctx.window.to)}`, gridAfter: grid }
    start = lastDay + 1
  }

  const finishOffset = Math.max(...slots.map(s => s.dayOffset))
  const lateOrders = movedOrders.filter(m => m.daysLate > 0)
  const infeasibleReason =
    finishOffset > ctx.needByOffset
      ? `Finishes ${label(finishOffset)}, needed by ${label(ctx.needByOffset)}`
      : lateOrders.length
        ? `Moved order ${lateOrders.map(m => m.salesOrder ?? m.order).join(', ')} would be late`
        : null
  return {
    ...option,
    fits: true,
    slots,
    movedOrders,
    finishOffset,
    finishDate: dateOf(finishOffset),
    feasible: !infeasibleReason,
    needsOverride: movedOrders.some(m => m.insideFrozenHorizon),
    infeasibleReason,
    gridAfter: grid,
  }
}

/**
 * Score of a simulated option (pure), lower is better.
 * Returns { peakUtilization, utilizationSpread, frozenHorizonViolations,
 *           daysLateForMovedOrders, setupChanges, overtimeHours, score }.
 */
export function score(sim, weights) {
  const averages = []
  let peak = 0
  for (const days of Object.values(sim.gridAfter)) {
    const values = Object.values(days).map(utilization).filter(v => v != null)
    if (!values.length) continue // work center without capacity (scenario 4)
    peak = Math.max(peak, ...values)
    averages.push(values.reduce((a, b) => a + b, 0) / values.length)
  }
  const metrics = {
    peakUtilization: peak,
    utilizationSpread: averages.length ? Math.max(...averages) - Math.min(...averages) : 0,
    frozenHorizonViolations: sim.movedOrders.filter(m => m.insideFrozenHorizon).length,
    daysLateForMovedOrders: sim.movedOrders.reduce((sum, m) => sum + m.daysLate, 0),
    setupChanges: new Set(sim.slots.map(s => `${s.workCenter}:${s.dayOffset}`)).size + sim.movedOrders.length,
    overtimeHours: 0,
  }
  const total =
    weights.w1 * metrics.peakUtilization +
    weights.w2 * metrics.utilizationSpread +
    weights.w3 * metrics.frozenHorizonViolations +
    weights.w4 * metrics.daysLateForMovedOrders +
    weights.w5 * metrics.setupChanges +
    weights.w6 * metrics.overtimeHours
  return {
    peakUtilization: round(metrics.peakUtilization),
    utilizationSpread: round(metrics.utilizationSpread),
    frozenHorizonViolations: metrics.frozenHorizonViolations,
    daysLateForMovedOrders: metrics.daysLateForMovedOrders,
    setupChanges: metrics.setupChanges,
    overtimeHours: metrics.overtimeHours,
    score: round(total, 2),
  }
}

// --- Option generation -------------------------------------------------------------

/**
 * Everything simulate() needs for one order. `load` (rows as from getLoad)
 * replaces the stored load, e.g. to try a scenario.
 */
async function buildContext({ material, plant, quantity, needByDate, lane, salesOrder, load }) {
  const [params, versions, ranks] = await Promise.all([getPlanningParameters(plant), getWorkCenters(material, plant), laneRanks()])
  const loadRows = load ?? (await getLoad({ plant }))
  const ownRank = ranks[lane] ?? ranks.NORMAL
  const primary = versions.find(v => v.isPrimary)
  const movableOrders = []
  for (const workCenter of new Set(primary?.operations.map(op => op.workCenter) ?? [])) {
    for (const order of await getScheduledOrders(workCenter, plant)) {
      const laneRank = ranks[order.lane] ?? ranks.NORMAL
      if (laneRank <= ownRank || (salesOrder && order.salesOrder === salesOrder)) continue
      movableOrders.push({
        order: order.order,
        salesOrder: order.salesOrder,
        workCenter,
        dayOffset: offsetOf(order.operationDate),
        qty: order.operationQty,
        laneRank,
        dueOffset: order.dueDate ? offsetOf(order.dueDate) : null,
      })
    }
  }
  return {
    versions,
    loadRows,
    sim: {
      grid: toGrid(loadRows),
      quantity: Number(quantity),
      needByOffset: needByDate ? offsetOf(needByDate) : PLANNING_WINDOW.to,
      window: { ...PLANNING_WINDOW },
      frozenHorizonDays: params.frozenHorizonDays,
      shippingLeadDays: params.shippingLeadDays,
      movableOrders,
    },
  }
}

const altLabel = (version, primary) => {
  const changed = version.operations.filter(op => !primary?.operations.some(p => p.workCenter === op.workCenter)).map(op => op.workCenter)
  return `Alternative version ${version.productionVersion}${changed.length ? ` on ${changed.join(', ')}` : ''}`
}

const moveLabel = sim =>
  `Move ${sim.movedOrders.map(m => `${m.salesOrder ?? m.order} ${label(m.fromOffset)} → ${label(m.toOffset)} on ${m.workCenter}`).join(', ')}`

/**
 * Options for a capacity request (§7 A4).
 * cr: { crId, material, plant, quantity, needByDate, lane, salesOrder }; opts.load replaces the stored load.
 * Returns { crId, options: [{ optionId, label, productionVersion, slots, movedOrders, finishDate,
 *   feasible, needsOverride, infeasibleReason, metrics, score, loadBefore, loadAfter }], recommendedOption, source }.
 * Options that do not fit in the window at all are left out.
 */
export async function generateOptions(cr, { load } = {}) {
  const ctx = await buildContext({ ...cr, load })
  const weights = await getScoringWeights(cr.plant)
  const primary = ctx.versions.find(v => v.isPrimary)
  const candidates = ctx.versions
    .filter(v => !v.isPrimary)
    .map((version, i) => ({ optionId: i ? `O-ALT-${i + 1}` : 'O-ALT', kind: 'ALT', version, label: altLabel(version, primary) }))
  if (primary) candidates.push({ optionId: 'O-MOVE', kind: 'MOVE', version: primary })

  const loadBefore = gridRows(ctx.sim.grid)
  const options = []
  for (const candidate of candidates) {
    const sim = simulate(candidate, ctx.sim)
    if (!sim.fits) continue
    if (candidate.kind === 'MOVE' && !sim.movedOrders.length) continue // nothing to move: not an O-MOVE
    const metrics = score(sim, weights)
    options.push({
      optionId: sim.optionId,
      label: sim.label ?? moveLabel(sim),
      productionVersion: sim.version.productionVersion,
      slots: sim.slots,
      movedOrders: sim.movedOrders,
      finishDate: sim.finishDate,
      feasible: sim.feasible,
      needsOverride: sim.needsOverride,
      infeasibleReason: sim.infeasibleReason,
      metrics,
      score: metrics.score,
      loadBefore,
      loadAfter: gridRows(sim.gridAfter),
    })
  }
  const best = options.filter(o => o.feasible).sort((a, b) => a.score - b.score)[0]
  return {
    crId: cr.crId ?? null,
    options,
    recommendedOption: best?.optionId ?? null,
    source: [...new Set([...ctx.loadRows.map(r => r.source), ...ctx.versions.map(v => v.source)])].includes('s4') ? 's4' : 'mock',
  }
}

/**
 * Earliest production finish using free capacity only (no order moved), over
 * all production versions: { finishDate, finishOffset, productionVersion } or
 * null when nothing fits in the planning window. Used by A3's earliest date.
 */
export async function earliestProductionFinish({ material, plant, quantity, load }) {
  const ctx = await buildContext({ material, plant, quantity, needByDate: null, lane: 'HIGH', load })
  let best = null
  for (const version of ctx.versions) {
    const sim = simulate({ optionId: version.productionVersion, kind: 'FREE', version }, ctx.sim)
    if (sim.fits && (!best || sim.finishOffset < best.finishOffset)) {
      best = { finishOffset: sim.finishOffset, finishDate: sim.finishDate, productionVersion: version.productionVersion }
    }
  }
  return best
}

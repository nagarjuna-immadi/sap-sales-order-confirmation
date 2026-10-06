// The stored agent results of a case as the agent services return them
// (development plan 6.2, 7.1): the supply picture with the ranked options
// (Supply & Inventory) and the scored options of a capacity request
// (Production Capacity Balancing). Read-only: nothing is recalculated, so
// Claude explains exactly what the planner sees.
//
// Shared by the A3 and A4 agent services and the Order Assistant, which must
// not import from another agent's folder. The CDS types of the results are in
// case-snapshots.cds. No customer data and no prices.

import cds from '@sap/cds'
import { latestRecommendation } from './case-facts.js'

const { SELECT } = cds.ql

const parse = value => {
  if (value == null || value === '') return []
  try {
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    return []
  }
}

const pick = (row, keys) => Object.fromEntries(keys.map(key => [key, row?.[key] ?? null]))

const SUPPLY_OPTION_KEYS = ['optionId', 'rank', 'label', 'feasible', 'reason', 'confirmedDate', 'confirmedQty', 'produceQty', 'needByDate',
  'leftoverQty', 'excessWarning', 'earliestDate', 'crId', 'chosenOption', 'productionFinishDate']
const MOVED_KEYS = ['order', 'salesOrder', 'workCenter', 'qty', 'fromDate', 'toDate', 'insideFrozenHorizon', 'daysLate']
const METRIC_KEYS = ['peakUtilization', 'utilizationSpread', 'frozenHorizonViolations', 'daysLateForMovedOrders', 'setupChanges', 'overtimeHours']

/** The work centers and days whose utilization the option changes. */
const loadChanges = o =>
  (o.loadAfter ?? [])
    .map(after => ({ after, before: o.loadBefore?.find(b => b.workCenter === after.workCenter && b.dayOffset === after.dayOffset) }))
    .filter(({ before, after }) => before && before.requirement !== after.requirement)
    .map(({ before, after }) => ({ workCenter: after.workCenter, date: after.date, utilizationBefore: before.utilizationPercent, utilizationAfter: after.utilizationPercent }))

/**
 * The latest SupplyResult and SUPPLY_OPTIONS recommendation of a case
 * (snapshots.SupplyPicture), or null when the supply check has not run yet.
 * f: the case from getCaseFacts().
 */
export async function getSupplyPicture(f) {
  const [rec, result] = await Promise.all([
    latestRecommendation(f.caseId, 'SUPPLY_OPTIONS'),
    SELECT.one.from('order.conf.SupplyResult').where({ parentCase_caseId: f.caseId }).orderBy('createdAt desc'),
  ])
  if (!rec) return null
  return {
    ...pick(f, ['caseId', 'salesOrder', 'item', 'material', 'plant', 'quantity', 'quantityUnit', 'requestedDate', 'lane', 'status']),
    recommendedOption: rec.recommendedOption,
    options: rec.options.map(o => ({ ...pick(o, SUPPLY_OPTION_KEYS), recommended: o.optionId === rec.recommendedOption })),
    materialTree: parse(result?.materialTree).map(n => pick(n, ['material', 'parent', 'level', 'requiredQty', 'availableQty', 'shortfallQty', 'unit'])),
    stockPerPlant: parse(result?.stockPerPlant).map(s => pick(s, ['material', 'plant', 'unrestrictedQty', 'unit'])),
    openReceipts: parse(result?.openReceipts).map(r => pick(r, ['order', 'type', 'material', 'plant', 'qty', 'date'])),
    stockFlags: parse(result?.excessFlags).map(x => pick(x, ['material', 'plant', 'daysSinceMovement', 'monthsOfSupply', 'slowMoving', 'excess'])),
  }
}

/**
 * The scored options of a capacity request (snapshots.CapacityOptions),
 * recommended first, then by score. cr: from getCapacityRequest(); f: its
 * case from getCaseFacts().
 */
export async function getCapacityOptions(cr, f) {
  const rec = await latestRecommendation(f.caseId, 'CAPACITY_OPTIONS', cr.crId)
  const recommendedOption = rec?.recommendedOption ?? null
  const options = cr.options
    .map(o => ({
      ...pick(o, ['optionId', 'label', 'productionVersion', 'finishDate', 'feasible', 'infeasibleReason', 'needsOverride', 'score']),
      recommended: o.optionId === recommendedOption,
      metrics: pick(o.metrics, METRIC_KEYS),
      movedOrders: (o.movedOrders ?? []).map(m => pick(m, MOVED_KEYS)),
      loadChanges: loadChanges(o),
    }))
    .sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.score - b.score)
  return {
    crId: cr.crId,
    caseId: f.caseId,
    salesOrder: f.salesOrder,
    material: f.material,
    plant: f.plant,
    quantity: cr.quantity ?? f.quantity,
    quantityUnit: f.quantityUnit,
    needByDate: cr.needByDate,
    lane: f.lane,
    status: cr.status,
    recommendedOption,
    options,
  }
}

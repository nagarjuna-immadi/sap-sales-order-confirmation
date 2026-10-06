// ProductionCapacityBalancingAgentService handlers (A4; development plan 6.2).
//
// Read-only: the options stored on the capacity request and its latest
// CAPACITY_OPTIONS recommendation. The load rows are cut down to the work
// centers and days an option changes.

import cds from '@sap/cds'
import { getCaseFacts, getCapacityRequest, latestRecommendation } from '../../lib/case-facts.js'
import { fixMasking } from '../../lib/agent-masking.js'

const pick = (row, keys) => Object.fromEntries(keys.map(key => [key, row?.[key] ?? null]))

const MOVED_KEYS = ['order', 'salesOrder', 'workCenter', 'qty', 'fromDate', 'toDate', 'insideFrozenHorizon', 'daysLate']
const METRIC_KEYS = ['peakUtilization', 'utilizationSpread', 'frozenHorizonViolations', 'daysLateForMovedOrders', 'setupChanges', 'overtimeHours']

/** The work centers and days whose utilization the option changes. */
const loadChanges = o =>
  (o.loadAfter ?? [])
    .map(after => ({ after, before: o.loadBefore?.find(b => b.workCenter === after.workCenter && b.dayOffset === after.dayOffset) }))
    .filter(({ before, after }) => before && before.requirement !== after.requirement)
    .map(({ before, after }) => ({ workCenter: after.workCenter, date: after.date, utilizationBefore: before.utilizationPercent, utilizationAfter: after.utilizationPercent }))

export default class ProductionCapacityBalancingAgentService extends cds.ApplicationService {
  init() {
    this.after('buildMiddleware', fixMasking(this)) // plugin masking fixes (agent-masking.js)

    this.on('getCapacityOptions', async req => {
      const crId = String(req.data.crId ?? '').trim()
      const cr = await getCapacityRequest(crId)
      if (!cr) return req.reject(404, `Capacity request ${crId} not found`)
      const [f, rec] = await Promise.all([getCaseFacts(cr.parentCase_caseId), latestRecommendation(cr.parentCase_caseId, 'CAPACITY_OPTIONS', crId)])
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
        crId,
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
    })

    return super.init()
  }
}

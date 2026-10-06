// Production Capacity Balancing agent (A4; blueprint §7 A4, development plan 2.3).
//
// When a capacity request is created (case → WITH_PRODUCTION), A4 generates,
// simulates and scores the options, stores them on the CR (CapacityRequest.options,
// not a status field) and attaches a CAPACITY_OPTIONS recommendation. The
// production planner chooses; nothing is rescheduled. Template texts until phase 6.

import cds from '@sap/cds'
import { attachRecommendation } from '../feasibility-case-orchestrator/orchestrator.js'
import { CASE_STATUS } from '../feasibility-case-orchestrator/case-rules.js'
import { generateOptions } from '../../lib/tools/capacity.js'
import { onStatusChange } from '../../lib/agent-trigger.js'
import { getCaseFacts, getCapacityRequest } from '../../lib/case-facts.js'

const { UPDATE } = cds.ql

const AGENT = 'PRODUCTION_CAPACITY_BALANCING_AGENT'

// --- Template text ---------------------------------------------------------------------

const loadChanges = o =>
  o.loadAfter
    .map(after => ({ after, before: o.loadBefore.find(b => b.workCenter === after.workCenter && b.dayOffset === after.dayOffset) }))
    .filter(({ before, after }) => before && before.requirement !== after.requirement)
    .map(({ before, after }) => `${after.workCenter} ${after.date} ${before.utilizationPercent}% → ${after.utilizationPercent}%`)
    .join(', ')

function comparison(cr, result) {
  if (!result.options.length) return `No option fits ${cr.quantity} × ${cr.material} into the planning window. Reject with a reason.`
  const lines = result.options
    .slice()
    .sort((a, b) => a.score - b.score)
    .map(o => {
      const moved = o.movedOrders.length ? `moves ${o.movedOrders.map(m => `${m.salesOrder ?? m.order} ${m.fromDate} → ${m.toDate}`).join(', ')}` : 'no order moved'
      const flags = [o.needsOverride ? 'needs a frozen-horizon override' : null, o.feasible ? null : `not feasible: ${o.infeasibleReason}`].filter(Boolean).join('; ')
      return `${o.optionId} (score ${o.score}): ${o.label}; finishes ${o.finishDate}; ${moved}; load ${loadChanges(o)}${flags ? `; ${flags}` : ''}.`
    })
  const best = result.options.find(o => o.optionId === result.recommendedOption)
  const head = best ? `Recommended: ${best.optionId}, the lowest score among the feasible options.` : 'No option is feasible. Reject with a reason.'
  return [head, ...lines].join('\n')
}

/** Generates and stores the options of a capacity request. Returns the recommendation ID. */
export async function assessCapacity(crId) {
  const cr = await getCapacityRequest(crId)
  if (!cr) return null
  const facts = await getCaseFacts(cr.parentCase_caseId)
  const request = {
    crId,
    material: facts.material,
    plant: facts.plant,
    quantity: cr.quantity ?? facts.quantity,
    needByDate: cr.needByDate,
    lane: facts.lane,
    salesOrder: facts.salesOrder,
  }
  const result = await generateOptions(request)
  await UPDATE('order.conf.CapacityRequest').set({ options: JSON.stringify(result.options) }).where({ crId })
  return attachRecommendation({
    caseId: facts.caseId,
    crId,
    agent: AGENT,
    kind: 'CAPACITY_OPTIONS',
    // the load rows stay on the CR only
    options: result.options.map(o => Object.fromEntries(Object.entries(o).filter(([key]) => key !== 'loadBefore' && key !== 'loadAfter'))),
    recommendedOption: result.recommendedOption,
    rationale: comparison(request, result),
    inputSnapshot: { request, source: result.source },
  })
}

/** Subscribes A4 to the case events: a new CR puts the case in WITH_PRODUCTION. */
export function register() {
  return onStatusChange(AGENT, e => e.to === CASE_STATUS.WITH_PRODUCTION && !!e.crId, e => assessCapacity(e.crId))
}

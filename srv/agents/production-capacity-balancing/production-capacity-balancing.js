// Production Capacity Balancing agent (A4; blueprint §7 A4, development plan 2.3).
//
// When a capacity request is created (case → WITH_PRODUCTION), A4 generates,
// simulates and scores the options, stores them on the CR (CapacityRequest.options,
// not a status field) and attaches a CAPACITY_OPTIONS recommendation. The
// production planner chooses; nothing is rescheduled.
//
// Claude step (phase 6): after the commit, the agent service compares the top
// options and drafts the planner's comment (agent-call.js). Scores and the
// recommended option stay the tools'; the template comparison stays when
// Claude is not used.

import cds from '@sap/cds'
import { attachRecommendation } from '../feasibility-case-orchestrator/orchestrator.js'
import { CASE_STATUS } from '../feasibility-case-orchestrator/case-rules.js'
import { generateOptions } from '../../lib/tools/capacity.js'
import { onStatusChange } from '../../lib/agent-trigger.js'
import { getCaseFacts, getCapacityRequest } from '../../lib/case-facts.js'
import { refineRecommendation } from '../../lib/agent-call.js'

const { UPDATE } = cds.ql

const AGENT = 'PRODUCTION_CAPACITY_BALANCING_AGENT'
const AGENT_SERVICE = 'ProductionCapacityBalancingAgentService'

// The emit_data_part shape of the agent service (AGENTS.md).
const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['comparison', 'plannerComment'],
  additionalProperties: false,
  properties: {
    comparison: { type: 'string', minLength: 1, maxLength: 1200 },
    plannerComment: { type: ['string', 'null'], maxLength: 300 },
  },
}

/** The stored rationale: the comparison and, from Claude, the planner's draft comment. */
const render = output => [output.comparison, output.plannerComment && `Draft comment: ${output.plannerComment}`].filter(Boolean).join('\n\n')

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
  const template = { comparison: comparison(request, result), plannerComment: null }
  const recommendationId = await attachRecommendation({
    caseId: facts.caseId,
    crId,
    agent: AGENT,
    kind: 'CAPACITY_OPTIONS',
    // the load rows stay on the CR only
    options: result.options.map(o => Object.fromEntries(Object.entries(o).filter(([key]) => key !== 'loadBefore' && key !== 'loadAfter'))),
    recommendedOption: result.recommendedOption,
    rationale: render(template),
    inputSnapshot: { request, source: result.source },
  })
  refineRecommendation({
    recommendationId,
    agent: AGENT_SERVICE,
    query: `Capacity request ${crId}: compare the options and draft the planner's comment.`,
    schema: OUTPUT_SCHEMA,
    template,
    render,
    mustMention: [result.recommendedOption],
  })
  return recommendationId
}

/** Subscribes A4 to the case events: a new CR puts the case in WITH_PRODUCTION. */
export function register() {
  return onStatusChange(AGENT, e => e.to === CASE_STATUS.WITH_PRODUCTION && !!e.crId, e => assessCapacity(e.crId))
}

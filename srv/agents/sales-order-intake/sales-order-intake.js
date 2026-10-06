// Sales Order Intake agent (A2; blueprint §7 A2, development plan 2.3).
//
// For each sales order item: lane from the delivery priority, penalty clause,
// basic ATP. NORMAL and confirmed in full on time → the orchestrator auto-
// confirms the case; everything else goes to Supply Planning. A penalty clause
// on a non-HIGH item only gives a PRIORITY_RAISE suggestion (plan 2.0): Sales
// changes the priority in S/4HANA.
//
// Claude step (phase 6): after the commit, the agent service writes the
// summary and reads the penalty rule from the clause text (agent-call.js).
// The rule counts only if its rate is written in the clause; then
// calculatePenalty() gives the amount. Otherwise the case says "No penalty
// rule verified". The template summary and the contract's structured rule
// stay when Claude is not used (llm-mock) or its result fails a check.
//
// Runs in the caller's transaction (a DemoService or SalesService request).
// Agents never change a status: the orchestrator's system steps do.

import cds from '@sap/cds'
import {
  openCase,
  systemTransition,
  updateLane,
  attachRecommendation,
} from '../feasibility-case-orchestrator/orchestrator.js'
import { getSalesOrder, getCustomer, runAvailabilityCheck, calculatePenalty, penaltyRuleText } from '../../lib/tools/order-intake.js'
import { laneOf } from '../../lib/tools/config.js'
import { getSalesOrderItems } from '../../lib/s4/sales-order.js'
import { getProduct } from '../../lib/s4/product.js'
import { getCaseFacts } from '../../lib/case-facts.js'
import { refineRecommendation } from '../../lib/agent-call.js'
import { numbersIn } from '../../lib/number-check.js'

const { SELECT, UPDATE } = cds.ql

const AGENT = 'SALES_ORDER_INTAKE_AGENT'
const AGENT_SERVICE = 'SalesOrderIntakeAgentService'
const NO_RULE_VERIFIED = 'No penalty rule verified'

// The emit_data_part shape of the agent service (AGENTS.md).
const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['summary', 'penaltyRule'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string', minLength: 1, maxLength: 600 },
    penaltyRule: {
      oneOf: [
        { type: 'null' },
        {
          type: 'object',
          required: ['rate', 'unit', 'basis'],
          additionalProperties: false,
          properties: {
            rate: { type: 'number', exclusiveMinimum: 0 },
            unit: { enum: ['DAY', 'WEEK', 'OTHER'] },
            basis: { enum: ['ORDER_VALUE', 'OTHER'] },
          },
        },
      ],
    },
  },
}

// --- Template texts (the fallback of the Claude step) ----------------------------

const summaryText = ({ item, customer, product, atp, rule, penaltyAmount, lane }) => {
  const need = `${customer?.name ?? item.customer} needs ${item.quantity} ${item.quantityUnit} × ${item.material} (${product?.description ?? item.material}) by ${item.requestedDate}. Lane ${lane}.`
  const supply = atp.confirmedInFull
    ? `ATP confirms the full quantity in plant ${item.plant} (available ${atp.availableDate}).`
    : `ATP: ${atp.availableQty} of ${atp.requestedQty} available in plant ${item.plant}${atp.availableDate ? ` on ${atp.availableDate}` : ''}.`
  const penalty = rule
    ? `Penalty clause: ${penaltyRuleText(rule)}${penaltyAmount != null ? ` (${penaltyAmount} ${item.currency} per day late)` : ''}.`
    : 'No penalty clause found.'
  return `${need} ${supply} ${penalty}`
}

const priorityRaiseText = ({ item, customer, lane, highKey }) =>
  `${customer?.name ?? item.customer} has a penalty clause, but ${item.salesOrder} item ${item.item} is in the ${lane} lane (delivery priority ${item.deliveryPriority || 'blank'}). Consider raising the delivery priority to ${highKey} (HIGH) in S/4HANA.`

// --- Assessment ------------------------------------------------------------------

/** Everything A2 knows about an item: lane, customer, ATP, penalty, texts. */
async function assess(item) {
  const [lane, customer, product, atp] = await Promise.all([
    laneOf(item.deliveryPriority),
    getCustomer(item.customer),
    getProduct(item.material),
    runAvailabilityCheck(item),
  ])
  const rule = customer?.penaltyRule ?? null
  const penaltyAmount = rule ? calculatePenalty(rule, item.netAmount, 1) : null
  return {
    lane,
    customer,
    atp,
    rule,
    penaltyAmount,
    penaltyRisk: !!rule && !atp.confirmedInFull,
    summary: summaryText({ item, customer, product, atp, rule, penaltyAmount, lane }),
  }
}

const snapshot = (item, a) => ({ item, atp: a.atp, lane: a.lane, penaltyRule: a.rule, penaltyAmount: a.penaltyAmount })

/**
 * The penalty facts of the case from Claude's rule: the rule counts only when
 * its rate is written in the clause text (blueprint §7 A2 guardrail).
 */
function verifiedPenalty(rule, clauseText, orderValue) {
  if (!clauseText) return null // no clause: the summary says so, nothing to change
  if (!rule || !numbersIn(clauseText).has(rule.rate)) return { penaltyRule: NO_RULE_VERIFIED, penaltyAmount: null }
  const toolRule = { rate: rule.rate, per: rule.unit, basis: rule.basis }
  return { penaltyRule: penaltyRuleText(toolRule), penaltyAmount: calculatePenalty(toolRule, orderValue, 1) }
}

async function recommend(caseId, item, a) {
  const template = { summary: a.summary, penaltyRule: a.rule && { rate: a.rule.rate, unit: a.rule.per, basis: a.rule.basis } }
  const recommendationId = await attachRecommendation({
    caseId,
    agent: AGENT,
    kind: 'CASE_SUMMARY',
    recommendedOption: a.lane,
    rationale: a.summary,
    inputSnapshot: snapshot(item, a),
  })
  refineRecommendation({
    recommendationId,
    agent: AGENT_SERVICE,
    query: `Case ${caseId}: write the case summary and read the penalty rule.`,
    schema: OUTPUT_SCHEMA,
    template,
    render: output => output.summary,
    mustMention: [item.material, item.requestedDate],
    apply: async run => {
      if (!run.llmUsed) return
      const facts = verifiedPenalty(run.output.penaltyRule, a.customer?.clauseText, item.netAmount)
      if (facts) await UPDATE('order.conf.OrderFeasibilityCase').set(facts).where({ caseId })
    },
  })
  if (a.rule && a.lane !== 'HIGH') {
    const high = await SELECT.one.from('order.conf.DeliveryPriorityLane').columns('deliveryPriority').where({ lane_code: 'HIGH' })
    const highKey = high?.deliveryPriority ?? '01'
    await attachRecommendation({
      caseId,
      agent: AGENT,
      kind: 'PRIORITY_RAISE',
      recommendedOption: highKey,
      rationale: priorityRaiseText({ item, customer: a.customer, lane: a.lane, highKey }),
      inputSnapshot: snapshot(item, a),
    })
  }
}

const caseFacts = (a, item) => ({
  penaltyRisk: a.penaltyRisk,
  penaltyAmount: a.penaltyAmount,
  penaltyRule: penaltyRuleText(a.rule),
  atpResult: JSON.stringify(a.atp),
  currency: item.currency,
})

/**
 * Intake of one sales order item: opens the case, attaches the summary and
 * routes it (auto-confirm or Supply Planning). An item that already has a case
 * is re-evaluated instead. Returns { caseId, created, lane, status }.
 */
export async function intakeItem(item) {
  const a = await assess(item)
  const opened = await openCase({
    salesOrder: item.salesOrder,
    item: item.item,
    customer_ID: item.customer,
    material: item.material,
    plant: item.plant,
    quantity: item.quantity,
    quantityUnit: item.quantityUnit,
    requestedDate: item.requestedDate,
    deliveryPriority: item.deliveryPriority,
    ...caseFacts(a, item),
  })
  if (!opened.created) return reevaluateCase(opened.caseId)

  await recommend(opened.caseId, item, a)
  const step = a.lane === 'NORMAL' && a.atp.confirmedInFull ? 'autoConfirm' : 'routeToSupplyPlanning'
  const input = step === 'autoConfirm' ? { confirmedDate: item.requestedDate, confirmedQty: item.quantity } : {}
  const result = await systemTransition(opened.caseId, step, input)
  return { caseId: opened.caseId, created: true, lane: opened.lane, status: result.to }
}

/** Intake of every item of a sales order (simulated S/4 event). Returns one result per item. */
export async function intakeOrder(salesOrder) {
  const items = await getSalesOrderItems(salesOrder)
  if (!items.length) throw cds.error(`Sales order ${salesOrder} not found.`, { status: 404, code: 'SALES_ORDER_NOT_FOUND' })
  const results = []
  for (const item of items) results.push(await intakeItem(item))
  return results
}

/**
 * Re-runs the intake checks for an existing case (checkFeasibility, a
 * Changed event): a new delivery priority goes through updateLane (audit row),
 * ATP, penalty and summary are refreshed. Never a status change.
 * Returns { caseId, created: false, lane, status, laneChanged }.
 */
export async function reevaluateCase(caseId) {
  const facts = await getCaseFacts(caseId)
  if (!facts) throw cds.error(`Case ${caseId} not found.`, { status: 404, code: 'CASE_NOT_FOUND' })
  const item = await getSalesOrder(facts.salesOrder, facts.item)
  if (!item) throw cds.error(`Sales order item ${facts.salesOrder} / ${facts.item} not found.`, { status: 404, code: 'SALES_ORDER_NOT_FOUND' })

  const lane = await updateLane(caseId, item.deliveryPriority, { comment: 'Delivery priority changed in S/4HANA' })
  const a = await assess(item)
  // Intake facts, not status: written here, the version (ETag) stays
  await UPDATE('order.conf.OrderFeasibilityCase').set(caseFacts(a, item)).where({ caseId })
  await recommend(caseId, item, a)
  return { caseId, created: false, lane: lane.to, status: facts.status, laneChanged: lane.changed }
}

// Supply & Inventory agent (A3; blueprint §7 A3, development plan 2.3).
//
// When a case reaches Supply Planning, and when its capacity request is
// answered, A3 stores the supply picture (SupplyResult) and a SUPPLY_OPTIONS
// recommendation with the ranked ladder:
// - WITH_SUPPLY_PLANNING: the first feasible option of ranks 1–4, else reject
//   with the earliest date;
// - PRODUCTION_CONFIRMED: confirm the date to Sales (chosen option's finish +
//   shipping lead time, never before the requested date);
// - PRODUCTION_REJECTED: reject with the earliest date (free capacity only).
// The ranking comes from the tools, never from text.
//
// Claude step (phase 6): after the commit, the agent service explains why the
// recommended option ranks first and drafts the production check question or
// the message to Sales (agent-call.js). The options list under it stays the
// tools' own, and the template text stays when Claude is not used.

import cds from '@sap/cds'
import { attachRecommendation } from '../feasibility-case-orchestrator/orchestrator.js'
import { CASE_STATUS } from '../feasibility-case-orchestrator/case-rules.js'
import { buildSupplyPicture, rankSupplyOptions } from '../../lib/tools/supply.js'
import { getPlanningParameters } from '../../lib/tools/config.js'
import { onStatusChange } from '../../lib/agent-trigger.js'
import { getCaseFacts, getCapacityRequest } from '../../lib/case-facts.js'
import { dateOf, offsetOf } from '../../lib/demo-clock.js'
import { refineRecommendation } from '../../lib/agent-call.js'

const { SELECT, INSERT } = cds.ql

const AGENT = 'SUPPLY_INVENTORY_AGENT'
const AGENT_SERVICE = 'SupplyInventoryAgentService'
const TRIGGERS = [CASE_STATUS.WITH_SUPPLY_PLANNING, CASE_STATUS.PRODUCTION_CONFIRMED, CASE_STATUS.PRODUCTION_REJECTED]

// The emit_data_part shape of the agent service (AGENTS.md).
const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['explanation', 'message'],
  additionalProperties: false,
  properties: {
    explanation: { type: 'string', minLength: 1, maxLength: 1000 },
    message: { type: ['string', 'null'], maxLength: 800 },
  },
}

// --- Texts ----------------------------------------------------------------------------

const optionLine = o => `${o.rank ? `${o.rank}. ` : ''}${o.label}${o.feasible ? '' : ` (not possible: ${o.reason})`}`

/** Template output: { explanation, message }; message is the production check question or null. */
function templateOutput(facts, picture, recommended) {
  if (recommended.optionId !== 'S-PRODUCE') return { explanation: `Recommended: ${recommended.label}.`, message: null }
  const components = picture.materialTree
    .filter(n => n.level > 0 && !n.hasBom)
    .map(n => `${n.material} ${n.availableQty}/${n.requiredQty}`)
    .join(', ')
  return {
    explanation: `Recommended: ${recommended.label}.`,
    message:
      `Can we produce ${recommended.produceQty} × ${facts.material} by ${recommended.needByDate}? ` +
      `Components in plant ${facts.plant}: ${components || 'none needed'}. ` +
      `No ${facts.material} stock in other plants and no lower-priority order to reallocate from.` +
      (picture.leftoverQty > 0 ? ` Lot size leaves ${picture.leftoverQty} over.` : ' Lot size leaves nothing over.'),
  }
}

/**
 * The stored rationale: explanation, the message (supply-service.js reads the
 * production check question from its own line), the excess warning and the
 * options as the tools ranked them.
 */
function rationale(output, options, recommended) {
  const message = output.message?.replace(/\s*\n\s*/g, ' ').trim()
  const lines = [output.explanation]
  if (message) lines.push(`${recommended.optionId === 'S-PRODUCE' ? 'Production check question' : 'Message to Sales'}: ${message}`)
  if (recommended.excessWarning) lines.push(`Excess warning: the leftover is above the excess threshold; consider an exact lot size for this order.`)
  lines.push('Options:', ...options.map(optionLine))
  return lines.join('\n')
}

// --- Options per trigger ----------------------------------------------------------------

// Confirming options carry the date and quantity the Supply Planning action
// writes on the case (supply-service.js).
const withConfirmation = (options, facts) =>
  options.map(o =>
    ['S-LOCAL', 'S-TRANSFER', 'S-REALLOCATE'].includes(o.optionId) && o.feasible
      ? { ...o, confirmedDate: facts.requestedDate, confirmedQty: facts.quantity }
      : o,
  )

async function confirmDateOption(facts, cr) {
  const chosen = cr?.options.find(o => o.optionId === cr.chosenOption)
  const { shippingLeadDays } = await getPlanningParameters(facts.plant)
  const finishOffset = chosen?.finishDate ? offsetOf(chosen.finishDate) : null
  const deliveryOffset = finishOffset == null ? offsetOf(facts.requestedDate) : Math.max(finishOffset + shippingLeadDays, offsetOf(facts.requestedDate))
  const confirmedDate = dateOf(deliveryOffset)
  return {
    optionId: 'S-CONFIRM-DATE',
    rank: 0,
    label: `Confirm ${confirmedDate} to Sales (${cr?.crId}: ${cr?.chosenOption ?? 'option'}, production finishes ${chosen?.finishDate ?? 'as chosen'})`,
    action: 'confirmDateToSales',
    crId: cr?.crId ?? null,
    chosenOption: cr?.chosenOption ?? null,
    productionFinishDate: chosen?.finishDate ?? null,
    confirmedDate,
    confirmedQty: facts.quantity,
    feasible: true,
    reason: null,
  }
}

/**
 * Builds and stores the supply picture and the SUPPLY_OPTIONS recommendation
 * for a case. Returns the recommendation ID.
 */
export async function assessSupply(caseId, crId) {
  const facts = await getCaseFacts(caseId)
  if (!facts) return null
  const picture = await buildSupplyPicture(facts)
  const ladder = rankSupplyOptions(picture)
  let options = withConfirmation(ladder.options, facts)
  let recommendedOption = ladder.recommendedOption

  if (facts.status === CASE_STATUS.PRODUCTION_CONFIRMED) {
    const cr = await getCapacityRequest(crId ?? (await latestCrId(caseId)))
    options = [await confirmDateOption(facts, cr), ...options.filter(o => o.optionId === 'S-REJECT')]
    recommendedOption = 'S-CONFIRM-DATE'
  } else if (facts.status === CASE_STATUS.PRODUCTION_REJECTED) {
    recommendedOption = 'S-REJECT'
  }
  const recommended = options.find(o => o.optionId === recommendedOption)

  await INSERT.into('order.conf.SupplyResult').entries({
    parentCase_caseId: caseId,
    materialTree: JSON.stringify(picture.materialTree),
    stockPerPlant: JSON.stringify(picture.stockPerPlant),
    openReceipts: JSON.stringify(picture.openReceipts),
    excessFlags: JSON.stringify(picture.excessFlags),
    leftoverQty: picture.leftoverQty,
    excessWarning: picture.excessWarning,
    source: picture.source,
  })
  const template = templateOutput(facts, picture, recommended)
  const render = output => rationale(output, options, recommended)
  const recommendationId = await attachRecommendation({
    caseId,
    crId: facts.status === CASE_STATUS.WITH_SUPPLY_PLANNING ? null : (crId ?? null),
    agent: AGENT,
    kind: 'SUPPLY_OPTIONS',
    options,
    recommendedOption,
    rationale: render(template),
    inputSnapshot: picture,
  })
  const draft = recommendedOption === 'S-PRODUCE' ? 'the production check question' : 'the message to Sales'
  refineRecommendation({
    recommendationId,
    agent: AGENT_SERVICE,
    query: `Case ${caseId}: explain the supply recommendation and draft ${draft}.`,
    schema: OUTPUT_SCHEMA,
    template,
    render,
    // the date the message is about: need-by, confirmed or earliest date
    mustMention: [recommended.needByDate ?? recommended.confirmedDate ?? recommended.earliestDate],
  })
  return recommendationId
}

const latestCrId = async caseId =>
  (await SELECT.one.from('order.conf.CapacityRequest').columns('crId').where({ parentCase_caseId: caseId }).orderBy('createdAt desc', 'crId desc'))?.crId

/** Subscribes A3 to the case events. */
export function register() {
  return onStatusChange(AGENT, e => TRIGGERS.includes(e.to), e => assessSupply(e.caseId, e.crId))
}

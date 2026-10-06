// Communication agent (A5; blueprint §7 A5, development plan 2.3).
//
// On every status change: Notification rows per the §7 A5 routing table
// (recipient role, text, deep link as a semantic-object intent), none for
// AUTO_CONFIRMED. On SUPPLY_CONFIRMED and REJECTED: a customer draft
// (confirmation, or delay with the earliest date from A3), stored as a
// CUSTOMER_DRAFT recommendation and copied to the case. A5 never sends
// anything to a customer: Sales edits and sends the draft. Template texts
// until phase 6; dates, quantities and IDs come from the case and the tools.

import cds from '@sap/cds'
import { attachRecommendation } from '../feasibility-case-orchestrator/orchestrator.js'
import { CASE_STATUS, ROLES } from '../feasibility-case-orchestrator/case-rules.js'
import { onStatusChange } from '../../lib/agent-trigger.js'
import { getCaseFacts, getCapacityRequest, latestRecommendation } from '../../lib/case-facts.js'
import { getCustomer } from '../../lib/tools/order-intake.js'
import { getProduct } from '../../lib/s4/product.js'

const { SELECT, INSERT } = cds.ql

const AGENT = 'COMMUNICATION_AGENT'
const S = CASE_STATUS

// Semantic-object intents of the three case apps, one inbound per app
// (manifest crossNavigation, development plan 4).
export const INTENTS = Object.freeze({
  supply: caseId => `#FeasibilityCase-plan?caseId=${caseId}`,
  production: crId => `#CapacityRequest-decide?crId=${crId}`,
  sales: caseId => `#FeasibilityCase-track?caseId=${caseId}`,
})

// --- Notifications ------------------------------------------------------------------------

const item = f => `${f.quantity} ${f.quantityUnit ?? ''} × ${f.material}`.replace(/\s+×/, ' ×')

/** The §7 A5 routing table: [{ recipientRole, title, text, deepLink, crId }] for one event. */
async function notificationsFor(event, f) {
  const cr = event.crId ? await getCapacityRequest(event.crId) : null
  switch (event.to) {
    case S.WITH_SUPPLY_PLANNING:
      // the intake summary already has priority, requested date and penalty risk
      return [{
        recipientRole: ROLES.SUPPLY_PLANNER,
        title: `${f.caseId} ${f.lane}${f.penaltyRisk ? ', penalty risk' : ''}: ${item(f)} by ${f.requestedDate}`,
        text: f.summary ?? `${f.salesOrder} item ${f.item} needs a supply decision.`,
        deepLink: INTENTS.supply(f.caseId),
      }]
    case S.WITH_PRODUCTION: {
      const supply = await latestRecommendation(f.caseId, 'SUPPLY_OPTIONS')
      const produce = supply?.options.find(o => o.optionId === 'S-PRODUCE')
      return [{
        recipientRole: ROLES.PRODUCTION_PLANNER,
        crId: cr?.crId,
        title: `${cr?.crId} for ${f.caseId} (${f.lane}): ${cr?.quantity ?? f.quantity} × ${f.material} by ${cr?.needByDate ?? 'open date'}`,
        text: `Can we produce ${cr?.quantity ?? f.quantity} × ${f.material} by ${cr?.needByDate}?${produce?.label ? ` Supply check: ${produce.label}.` : ''} Capacity options are prepared in the Production Capacity Workbench.`,
        deepLink: INTENTS.production(cr?.crId),
      }]
    }
    case S.PRODUCTION_CONFIRMED:
    case S.PRODUCTION_REJECTED: {
      const confirmed = event.to === S.PRODUCTION_CONFIRMED
      const chosen = cr?.options.find(o => o.optionId === cr.chosenOption)
      return [{
        recipientRole: ROLES.SUPPLY_PLANNER,
        crId: cr?.crId,
        title: `${cr?.crId} for ${f.caseId}: production ${confirmed ? 'confirmed' : 'rejected'}`,
        text: confirmed
          ? `Chosen option ${cr?.chosenOption}${chosen ? `: ${chosen.label}, finishes ${chosen.finishDate}` : ''}.${cr?.overrideUsed ? ' Frozen-horizon override used.' : ''}${cr?.reason ? ` Comment: ${cr.reason}` : ''}`
          : `Reason: ${cr?.reason ?? 'none given'}.`,
        deepLink: INTENTS.supply(f.caseId),
      }]
    }
    case S.SUPPLY_CONFIRMED:
      return [{
        recipientRole: ROLES.SALES,
        title: `${f.caseId}: ${f.salesOrder} confirmed for ${f.confirmedDate ?? f.requestedDate}`,
        text: `${f.confirmedQty ?? f.quantity} × ${f.material} confirmed for ${f.confirmedDate ?? f.requestedDate}. A customer confirmation draft is ready.`,
        deepLink: INTENTS.sales(f.caseId),
      }]
    case S.REJECTED: {
      const earliest = await earliestDate(f.caseId)
      const reason = await lastReason(f.caseId)
      return [{
        recipientRole: ROLES.SALES,
        title: `${f.caseId}: ${f.salesOrder} cannot be delivered by ${f.requestedDate}`,
        text: `Reason: ${reason ?? 'none given'}. Earliest possible date: ${earliest ?? 'none in the planning window'}. A delay message draft is ready.`,
        deepLink: INTENTS.sales(f.caseId),
      }]
    }
    case S.CONFIRMED_TO_CUSTOMER: {
      const lastCr = await SELECT.one.from('order.conf.CapacityRequest').columns('crId').where({ parentCase_caseId: f.caseId }).orderBy('createdAt desc', 'crId desc')
      const closure = {
        title: `${f.caseId}: confirmed to the customer`,
        text: `${f.salesOrder} item ${f.item}: ${f.confirmedQty ?? f.quantity} × ${f.material} for ${f.confirmedDate ?? f.requestedDate}. See the case timeline.`,
      }
      // Production sees the case through its capacity request
      return [
        { recipientRole: ROLES.SUPPLY_PLANNER, ...closure, deepLink: INTENTS.supply(f.caseId) },
        ...(lastCr ? [{ recipientRole: ROLES.PRODUCTION_PLANNER, ...closure, crId: lastCr.crId, deepLink: INTENTS.production(lastCr.crId) }] : []),
      ]
    }
    default:
      return [] // NEW, AUTO_CONFIRMED, CLOSED: nobody has to act
  }
}

const earliestDate = async caseId =>
  (await latestRecommendation(caseId, 'SUPPLY_OPTIONS'))?.options.find(o => o.optionId === 'S-REJECT')?.earliestDate ?? null

const lastReason = async caseId =>
  (await SELECT.one.from('order.conf.AuditLog').columns('reason').where({ parentCase_caseId: caseId, toStatus: S.REJECTED, outcome: 'DONE' }).orderBy('at desc'))?.reason

// --- Customer drafts ------------------------------------------------------------------------

const GREETING = { formal: name => `Dear ${name},`, neutral: name => `Hello ${name},`, friendly: name => `Hi ${name},` }
const CLOSING = { formal: 'Kind regards', neutral: 'Best regards', friendly: 'Many thanks and best wishes' }

/** { subject, body } in the customer's tone (English templates for every language until phase 6). */
async function customerDraft(f, kind) {
  const customer = await getCustomer(f.customer)
  const product = await getProduct(f.material)
  const tone = customer?.tone in GREETING ? customer.tone : 'neutral'
  const name = customer?.name ?? f.customer
  const what = `${f.confirmedQty ?? f.quantity} ${f.quantityUnit ?? ''} of ${product?.description ?? f.material} (${f.material})`.replace(/\s+of/, ' of')
  if (kind === 'confirmation') {
    const date = f.confirmedDate ?? f.requestedDate
    return {
      subject: `Your order ${f.salesOrder}: delivery confirmed for ${date}`,
      body: `${GREETING[tone](name)}\n\nwe confirm your order ${f.salesOrder}, item ${f.item}: ${what} for delivery on ${date}.\n\n${CLOSING[tone]}`,
    }
  }
  const earliest = await earliestDate(f.caseId)
  return {
    subject: `Your order ${f.salesOrder}: new delivery date`,
    body:
      `${GREETING[tone](name)}\n\nwe are sorry: we cannot deliver your order ${f.salesOrder}, item ${f.item} (${f.quantity} ${f.quantityUnit ?? ''} of ${product?.description ?? f.material}) by ${f.requestedDate}.`.replace(/\s+of/, ' of') +
      (earliest ? ` The earliest date we can offer is ${earliest}. Please let us know if this date works for you.` : ' We will come back to you with a new date as soon as possible.') +
      `\n\n${CLOSING[tone]}`,
  }
}

// --- Trigger ---------------------------------------------------------------------------------

/** Notifications and, where due, the customer draft for one status change. */
export async function communicate(event) {
  const f = await getCaseFacts(event.caseId)
  if (!f) return
  const rows = (await notificationsFor(event, f)).map(n => ({
    recipientRole: n.recipientRole,
    plant: f.plant,
    parentCase_caseId: f.caseId,
    capacityRequest_crId: n.crId ?? event.crId ?? null,
    event: event.to,
    title: n.title,
    text: n.text,
    deepLink: n.deepLink,
  }))
  if (rows.length) await INSERT.into('order.conf.Notification').entries(rows)

  const kind = event.to === S.SUPPLY_CONFIRMED ? 'confirmation' : event.to === S.REJECTED ? 'delay' : null
  if (!kind) return
  const draft = await customerDraft(f, kind)
  await attachRecommendation({
    caseId: f.caseId,
    agent: AGENT,
    kind: 'CUSTOMER_DRAFT',
    recommendedOption: kind,
    rationale: `Subject: ${draft.subject}\n\n${draft.body}`,
    inputSnapshot: { draft, kind, confirmedDate: f.confirmedDate, confirmedQty: f.confirmedQty, requestedDate: f.requestedDate },
  })
}

/** Subscribes A5 to every status change. */
export function register() {
  return onStatusChange(AGENT, () => true, communicate)
}

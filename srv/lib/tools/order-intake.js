// Tools of the Sales Order Intake agent (A2; blueprint §7 A2, development plan 2.2).
// Read-only or pure. All numbers the agent shows come from here.

import cds from '@sap/cds'
import { getSalesOrderItem } from '../s4/sales-order.js'
import { checkAvailability } from '../s4/availability.js'
import { num } from '../s4/connection.js'
import { getPlanningParameters } from './config.js'
import { offsetOf, dateOf } from '../demo-clock.js'

const { SELECT } = cds.ql

/** The order item as a domain object (sales order adapter), or null. */
export function getSalesOrder(salesOrder, item) {
  return getSalesOrderItem(salesOrder, item)
}

/**
 * Customer with contract terms, or null:
 * { id, name, clauseText, language, tone, penaltyRule: { rate, per, basis } | null }.
 * The structured rule is read from CustomerContract until phase 7 extracts it
 * from the clause text. No clause → penaltyRule null.
 */
export async function getCustomer(customerId) {
  const customer = await SELECT.one.from('order.conf.Customers').columns('ID', 'name').where({ ID: customerId })
  if (!customer) return null
  const contract = await SELECT.one.from('order.conf.CustomerContract').where({ customer_ID: customerId })
  const rate = num(contract?.penaltyRate)
  return {
    id: customer.ID,
    name: customer.name,
    clauseText: contract?.clauseText ?? null,
    language: contract?.language ?? 'EN',
    tone: contract?.tone ?? 'neutral',
    penaltyRule: contract?.clauseText && rate ? { rate, per: contract.penaltyPer, basis: contract.penaltyBasis } : null,
  }
}

/** "2% of order value per day late": the rule as a short text for the case. */
export function penaltyRuleText(rule) {
  if (!rule) return null
  const basis = rule.basis === 'ORDER_VALUE' ? 'order value' : rule.basis
  const per = rule.per === 'DAY' ? 'day' : rule.per
  return `${rule.rate}% of ${basis} per ${per} late`
}

/**
 * Penalty amount for `daysLate` days, rounded to cents. Supports the demo's
 * rule (percent of order value per day). Another basis or unit gives null,
 * so no number is invented.
 */
export function calculatePenalty(rule, orderValue, daysLate) {
  if (!rule || orderValue == null || !(daysLate > 0)) return 0
  if (rule.basis !== 'ORDER_VALUE' || rule.per !== 'DAY') return null
  return Math.round(orderValue * (rule.rate / 100) * daysLate * 100) / 100
}

/**
 * Basic ATP for the item:
 * { requestedQty, availableQty, availableDate, deliveryDate, confirmedInFull, source }.
 * deliveryDate = availableDate + shippingLeadDays. confirmedInFull: the full
 * quantity can be delivered by the requested date.
 */
export async function runAvailabilityCheck({ material, plant, quantity, requestedDate }) {
  const atp = await checkAvailability({ material, plant, quantity })
  const { shippingLeadDays } = await getPlanningParameters(plant)
  const deliveryOffset = atp.availableDate ? offsetOf(atp.availableDate) + shippingLeadDays : null
  return {
    material,
    plant,
    requestedQty: atp.requestedQty,
    availableQty: atp.availableQty,
    availableDate: atp.availableDate,
    deliveryDate: deliveryOffset == null ? null : dateOf(deliveryOffset),
    confirmedInFull:
      atp.availableQty >= atp.requestedQty && deliveryOffset != null && deliveryOffset <= offsetOf(requestedDate),
    source: atp.source,
  }
}

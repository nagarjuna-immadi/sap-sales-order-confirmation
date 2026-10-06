// Read helpers the agents share (development plan 2.3): the case, its active
// capacity request and the latest recommendation of a kind. Read-only.

import cds from '@sap/cds'
import { num } from './s4/connection.js'

const { SELECT } = cds.ql

const DB = {
  Cases: 'order.conf.OrderFeasibilityCase',
  CapacityRequests: 'order.conf.CapacityRequest',
  Recommendations: 'order.conf.Recommendation',
}

const parse = value => {
  if (value == null || value === '') return null
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/** The case with numbers as numbers and `lane` / `status` as codes, or null. */
export async function getCaseFacts(caseId) {
  const row = await SELECT.one.from(DB.Cases).where({ caseId })
  if (!row) return null
  return {
    ...row,
    lane: row.lane_code,
    status: row.status_code,
    customer: row.customer_ID,
    quantity: num(row.quantity),
    confirmedQty: num(row.confirmedQty),
    penaltyAmount: num(row.penaltyAmount),
    atpResult: parse(row.atpResult),
  }
}

/** A capacity request with its options parsed, or null. */
export async function getCapacityRequest(crId) {
  const row = await SELECT.one.from(DB.CapacityRequests).where({ crId })
  return row && { ...row, quantity: num(row.quantity), status: row.status_code, options: parse(row.options) ?? [] }
}

/** The latest recommendation of a kind for a case (optionally a CR), with options parsed, or null. */
export async function latestRecommendation(caseId, kind, crId) {
  const where = { parentCase_caseId: caseId, kind_code: kind }
  if (crId) where.capacityRequest_crId = crId
  const row = await SELECT.one.from(DB.Recommendations).where(where).orderBy('createdAt desc')
  return row && { ...row, options: parse(row.options) ?? [] }
}

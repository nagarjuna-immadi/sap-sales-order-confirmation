import cds from '@sap/cds'
import { registerCaseHandlers } from './lib/case-service.js'
import { actionFlags, registerComputedFields, textSource } from './lib/case-view.js'
import { latestRecommendation } from './lib/case-facts.js'
import { isFinal } from './agents/feasibility-case-orchestrator/case-rules.js'
import { reevaluateCase } from './agents/sales-order-intake/sales-order-intake.js'

const { SELECT } = cds.ql

const ACTIONS = ['confirmToCustomer', 'close']

// The recommendations Sales sees as "Suggested by agent": the decisions of the
// flow, not the summary and the draft (they have their own sections).
const DECISION_KINDS = ['PRIORITY_RAISE', 'SUPPLY_OPTIONS', 'CAPACITY_OPTIONS']

const AGENT_NAME = {
  SALES_ORDER_INTAKE_AGENT: 'Sales Order Intake',
  SUPPLY_INVENTORY_AGENT: 'Supply & Inventory',
  PRODUCTION_CAPACITY_BALANCING_AGENT: 'Production Capacity Balancing',
}
const KIND_NAME = {
  PRIORITY_RAISE: 'Raise delivery priority',
  SUPPLY_OPTIONS: 'Supply options',
  CAPACITY_OPTIONS: 'Capacity options',
}
const DRAFT_KIND = { confirmation: 'Confirmation', delay: 'Delay' }

const parse = value => {
  if (value == null || value === '') return null
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const keyOf = param => (param && typeof param === 'object' ? param.caseId : param)

/** The case's latest recommendation of a decision kind, with options parsed, or null. */
async function latestDecision(caseId) {
  const row = await SELECT.one
    .from('order.conf.Recommendation')
    .where({ parentCase_caseId: caseId, kind_code: { in: DECISION_KINDS } })
    .orderBy('createdAt desc')
  return row && { ...row, options: parse(row.options) ?? [] }
}

/** Fills the requested virtual fields of Cases rows. */
async function fillCases(rows, requested) {
  const needsRecommendation = ['recommendationAgent', 'recommendationKind', 'recommendedOptionLabel', 'recommendationRationale', 'rationaleSource', 'recommendationAt'].some(n => requested.has(n))
  for (const row of rows) {
    const open = !isFinal(row.status_code)
    const values = {
      ...actionFlags(row.status_code, ACTIONS),
      offerConfirmToCustomer: open && row.status_code !== 'REJECTED',
      canCheckFeasibility: open,
    }
    if (needsRecommendation) {
      const rec = await latestDecision(row.caseId)
      const option = rec?.options.find(o => o.optionId === rec.recommendedOption)
      Object.assign(values, {
        recommendationAgent: rec ? (AGENT_NAME[rec.agent] ?? rec.agent) : null,
        recommendationKind: rec ? (KIND_NAME[rec.kind_code] ?? rec.kind_code) : null,
        recommendedOptionLabel: rec ? (option?.label ?? rec.recommendedOption) : null,
        recommendationRationale: rec?.rationale ?? null,
        rationaleSource: textSource(rec),
        recommendationAt: rec?.createdAt ?? null,
      })
    }
    if (requested.has('draftKind') || requested.has('draftSource')) {
      const draft = await latestRecommendation(row.caseId, 'CUSTOMER_DRAFT')
      values.draftKind = draft ? (DRAFT_KIND[draft.recommendedOption] ?? null) : null
      values.draftSource = textSource(draft)
    }
    if (requested.has('summarySource')) values.summarySource = textSource(await latestRecommendation(row.caseId, 'CASE_SUMMARY'))
    for (const [name, value] of Object.entries(values)) if (requested.has(name)) row[name] = value
  }
}

export default class SalesService extends cds.ApplicationService {
  init() {
    const { Cases } = this.entities

    // Re-runs Sales Order Intake for the item: lane, ATP, penalty, summary. No status change.
    this.on('checkFeasibility', Cases, async req => {
      const caseId = keyOf(req.params.at(-1))
      const caseRow = await this.run(SELECT.one.from(Cases).columns('caseId', 'status_code').where({ caseId }))
      if (!caseRow) return req.reject(404, `${caseId} not found`)
      if (isFinal(caseRow.status_code)) return req.reject(400, `Case ${caseId} is ${caseRow.status_code}; there is nothing left to check.`)
      await reevaluateCase(caseId)
      return this.run(SELECT.one.from(Cases).where({ caseId }))
    })

    // The draft shown to Sales is linked to the confirmation's audit row:
    // accepted when Sales sends a text (edited or not), the payload has the text.
    this.before('confirmToCustomer', Cases, async req => {
      const rec = await latestRecommendation(keyOf(req.params.at(-1)), 'CUSTOMER_DRAFT')
      if (!rec) return
      req.data.recommendationId = rec.ID
      req.data.recommendationAccepted = !!req.data.customerDraft?.trim()
    })

    registerComputedFields(this, Cases, {
      inputs: ['caseId', 'status_code'],
      fill: fillCases,
    })

    registerCaseHandlers(this, {
      role: 'Sales',
      actions: { confirmToCustomer: 'Cases', close: 'Cases' },
      order: { Cases: ['salesOrder', 'item'], CaseTimeline: ['at'], Notifications: ['createdAt desc'] },
    })
    return super.init()
  }
}

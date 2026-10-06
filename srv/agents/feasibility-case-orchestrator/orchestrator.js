// Feasibility Case Orchestrator (blueprint §7 A1, development plan 1.3).
//
// Deterministic, no LLM. The only writer of case status, capacity request
// status and the AuditLog:
// - executeAction(req, action, input): human actions from the case services.
//   One transaction (the request's): lock the case, check the ETag, ask
//   case-rules, update case (and CR), write exactly one audit row (rule 6).
// - openCase / systemTransition / updateLane: steps of the Sales Order Intake
//   agent. attachRecommendation: A2–A5 write recommendations, never a status;
//   recordAgentRun adds the Claude text to one afterwards (phase 6).
// - A refused action writes an AuditLog row with outcome REFUSED in its own
//   transaction, after the request's has ended (the in-memory SQLite has one
//   connection, so a second transaction cannot run alongside the first).
// - After commit, case.statusChanged goes to in-process subscribers
//   (onCaseEvent). Subscribers run detached: they cannot block or fail the action.
//
// SQLite ignores forUpdate, so the case update also requires the version that
// was read: a concurrent action that got there first makes it a 412.

import cds from '@sap/cds'
import {
  ROLES,
  CASE_STATUS,
  CR_STATUS,
  TRANSITIONS,
  canAct,
  checkCapacityRequest,
  waitingForRole,
  mapLane,
  nextCaseId,
  nextCrId,
} from './case-rules.js'

const { SELECT, INSERT, UPDATE } = cds.ql
const LOG = cds.log('orchestrator')

const DB = {
  Cases: 'order.conf.OrderFeasibilityCase',
  CapacityRequests: 'order.conf.CapacityRequest',
  Recommendations: 'order.conf.Recommendation',
  AuditLog: 'order.conf.AuditLog',
  DeliveryPriorityLane: 'order.conf.DeliveryPriorityLane',
}

const ORCHESTRATOR = 'FEASIBILITY_CASE_ORCHESTRATOR_AGENT'
const INTAKE = 'SALES_ORDER_INTAKE_AGENT'
const CASE_ROLES = [ROLES.SALES, ROLES.SUPPLY_PLANNER, ROLES.PRODUCTION_PLANNER]
// Recommendation kinds whose rationale is copied onto the case (plan 2.0).
const CASE_TEXT_FIELD = { CASE_SUMMARY: 'summary', CUSTOMER_DRAFT: 'customerDraft' }

// --- Event bus ----------------------------------------------------------------

const listeners = new Map()

/** Subscribes to a case event ('case.statusChanged'). Returns an unsubscribe function. */
export function onCaseEvent(event, listener) {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event).add(listener)
  return () => listeners.get(event).delete(listener)
}

const emitDetached = (event, payload) => {
  for (const listener of listeners.get(event) ?? []) {
    setImmediate(async () => {
      try {
        await listener(payload)
      } catch (e) {
        LOG.error(`Subscriber of ${event} failed:`, e)
      }
    })
  }
}

/** Emits once the current transaction has committed; nothing on rollback. */
const emitAfterCommit = (event, payload) => {
  const ctx = cds.context
  if (ctx?.tx && !ctx.tx._done) ctx.on('succeeded', () => emitDetached(event, payload))
  else emitDetached(event, payload)
}

// --- Helpers ------------------------------------------------------------------

const text = value => (value == null || String(value).trim() === '' ? null : String(value).trim())
const json = value => (value == null || typeof value === 'string' ? (value ?? null) : JSON.stringify(value))

/** Runs fn in the caller's transaction, or in a new one when there is none. */
const inTransaction = fn => (cds.context?.tx ? fn() : cds.tx(() => fn()))

/** "W/\"3\"" → "3"; null when absent. */
const parseEtag = header => {
  if (!header) return null
  const value = String(header).split(',')[0].trim()
  if (value === '*') return '*'
  return value.replace(/^W\//, '').replace(/^"|"$/g, '')
}

/** The case key (caseId) or CR key (crId) of a bound action's target. */
const targetOf = req => {
  const param = req.params?.at(-1)
  const keys = Object.keys(req.target?.keys ?? {})
  const key = keys.includes('crId') ? 'crId' : 'caseId'
  const value = param && typeof param === 'object' ? param[key] : param
  return { [key]: value }
}

const latestCr = caseId =>
  SELECT.one.from(DB.CapacityRequests).where({ parentCase_caseId: caseId }).orderBy('createdAt desc', 'crId desc')

/**
 * Writes a REFUSED audit row in its own transaction, after the current one has
 * ended. `at` is the time of the refusal, not of the (later) insert.
 */
const auditRefusal = row => {
  const { user, tenant } = cds.context ?? {}
  const at = new Date().toISOString()
  cds.spawn({ user, tenant }, tx =>
    tx.run(INSERT.into(DB.AuditLog).entries({ ...row, at, outcome: 'REFUSED' })),
  )
}

// --- Core ---------------------------------------------------------------------

/**
 * Applies one action. Caller provides the transaction (cds.context.tx).
 * actor: { id, roles, role }; ifMatch: the request's ETag (null for system steps).
 * Returns { ok: true, result } or { ok: false, httpStatus, code, message, audited }.
 */
async function apply({ caseId, crId, action, input, actor, ifMatch }) {
  // A Production action targets the CR: find its case first, then lock the case.
  if (!caseId && crId) {
    const cr = await SELECT.one.from(DB.CapacityRequests).columns('parentCase_caseId').where({ crId })
    if (!cr) return { ok: false, httpStatus: 404, code: 'CR_NOT_FOUND', message: `Capacity request ${crId} not found.` }
    caseId = cr.parentCase_caseId
  }
  const caseRow = await SELECT.one.from(DB.Cases).where({ caseId }).forUpdate()
  if (!caseRow) return { ok: false, httpStatus: 404, code: 'CASE_NOT_FOUND', message: `Case ${caseId} not found.` }

  // Rule 7: the version the user saw. CAP checked it before the lock; this
  // catches an action that committed in between.
  if (ifMatch !== null && ifMatch !== '*' && String(caseRow.version) !== ifMatch) {
    return { ok: false, httpStatus: 412, code: 'STALE_VERSION', message: `Case ${caseId} has changed; reload it.` }
  }

  const activeCr = crId
    ? await SELECT.one.from(DB.CapacityRequests).where({ crId })
    : await latestCr(caseId)

  const check = canAct({ caseRow, action, userRoles: actor.roles, input, activeCr })
  if (!check.ok) {
    auditRefusal({
      parentCase_caseId: caseId,
      capacityRequest_crId: activeCr?.crId ?? null,
      action,
      actor: actor.id,
      role: actor.role,
      fromStatus: caseRow.status_code,
      toStatus: caseRow.status_code,
      comment: input.comment,
      reason: input.reason,
      refusalCode: check.code,
    })
    return { ...check, audited: true }
  }

  const { next } = check
  const t = TRANSITIONS[action]
  const now = new Date().toISOString()
  let cr = t.crTo ? activeCr : null

  if (next.createsCr) {
    const last = await SELECT.one.from(DB.CapacityRequests).columns('max(crId) as crId')
    const newCr = {
      crId: nextCrId(last?.crId),
      parentCase_caseId: caseId,
      status_code: CR_STATUS.OPEN,
      needByDate: input.needByDate ?? null,
      quantity: input.quantity ?? caseRow.quantity,
    }
    const parentCheck = checkCapacityRequest(newCr) // rule 5
    if (!parentCheck.ok) return parentCheck
    await INSERT.into(DB.CapacityRequests).entries(newCr)
    cr = newCr
  }

  if (next.crStatus) {
    await UPDATE(DB.CapacityRequests, { crId: cr.crId }).set({
      status_code: next.crStatus,
      chosenOption: input.optionId ?? null,
      overrideUsed: action === 'chooseOverrideOption',
      decidedBy: actor.id,
      decidedAt: now,
      reason: input.reason ?? input.comment ?? null,
    })
  }

  // The recommendation shown to the user, and whether the decision follows it.
  let recommendation = null
  let recommendationAccepted = input.recommendationAccepted ?? null
  if (input.recommendationId) {
    recommendation = await SELECT.one.from(DB.Recommendations).where({ ID: input.recommendationId, parentCase_caseId: caseId })
    if (recommendation && recommendationAccepted === null && input.optionId && recommendation.recommendedOption)
      recommendationAccepted = recommendation.recommendedOption === input.optionId
    if (recommendation && recommendationAccepted !== null)
      await UPDATE(DB.Recommendations, { ID: recommendation.ID }).set({ accepted: recommendationAccepted })
  }

  const caseUpdate = { status_code: next.status, waitingForRole: next.waitingForRole, version: caseRow.version + 1 }
  if (input.confirmedDate !== undefined) caseUpdate.confirmedDate = input.confirmedDate
  if (input.confirmedQty !== undefined) caseUpdate.confirmedQty = input.confirmedQty
  // Confirm to customer: the draft as Sales edited it (nothing is sent, plan 5)
  if (input.customerDraft) caseUpdate.customerDraft = input.customerDraft
  const updated = await UPDATE(DB.Cases).set(caseUpdate).where({ caseId, version: caseRow.version })
  if (updated !== 1) {
    // rolled back by the caller: the request fails, so the CR insert/update goes too
    return { ok: false, httpStatus: 412, code: 'STALE_VERSION', message: `Case ${caseId} has changed; reload it.` }
  }

  // Rule 6: exactly one audit row, same transaction
  await INSERT.into(DB.AuditLog).entries({
    parentCase_caseId: caseId,
    capacityRequest_crId: cr?.crId ?? null,
    action,
    actor: actor.id,
    role: actor.role,
    fromStatus: caseRow.status_code,
    toStatus: next.status,
    comment: input.comment,
    reason: input.reason,
    payload: payloadOf(action, input),
    recommendation_ID: recommendation?.ID ?? null,
    recommendationAccepted,
    outcome: 'DONE',
  })

  const result = {
    caseId,
    crId: cr?.crId ?? null,
    from: caseRow.status_code,
    to: next.status,
    actor: actor.id,
    action,
    version: caseUpdate.version,
  }
  emitAfterCommit('case.statusChanged', result)
  return { ok: true, result }
}

const normalize = (input = {}) => ({
  ...input,
  comment: text(input.comment),
  reason: text(input.reason),
  customerDraft: input.customerDraft == null || String(input.customerDraft).trim() === '' ? null : String(input.customerDraft),
})

/** The audit payload of an action: the chosen option of a decision, the customer draft of a confirmation. */
function payloadOf(action, input) {
  if (input.optionId) return json({ chosenOption: input.optionId, overrideUsed: action === 'chooseOverrideOption' })
  if (input.customerDraft) return json({ customerDraft: input.customerDraft })
  return null
}

// --- Human actions ------------------------------------------------------------

/**
 * A bound action of a case service, on a case (key caseId) or a capacity
 * request (key crId). The request needs the case version as If-Match.
 * input: { comment, reason, optionId, recommendationId, recommendationAccepted,
 *          confirmedDate, confirmedQty, needByDate, customerDraft }
 * Returns { caseId, crId, from, to, actor, action, version }.
 */
export async function executeAction(req, action, input = {}) {
  const roles = CASE_ROLES.filter(role => req.user?.is(role))
  const actor = {
    id: req.user?.id ?? 'anonymous',
    roles,
    // the role the user acts in: the one the case waits for, else their first case role
    role: roles.find(role => TRANSITIONS[action]?.role === role) ?? roles[0] ?? null,
  }
  const ifMatch = parseEtag(req.headers?.['if-match'])
  if (ifMatch === null) return req.reject({ status: 428, code: 'ETAG_REQUIRED', message: 'The case version (If-Match) is required.' })

  const outcome = await apply({ ...targetOf(req), action, input: normalize(input), actor, ifMatch })
  if (!outcome.ok) return req.reject({ status: outcome.httpStatus, code: outcome.code, message: outcome.message })
  return outcome.result
}

// --- System steps (Sales Order Intake agent) ----------------------------------

/**
 * Opens a case for a sales order item, status NEW. The lane comes from the
 * delivery priority. One case per item: a second call returns the existing case.
 * data: { salesOrder, item, customer_ID, material, plant, quantity, quantityUnit,
 *         requestedDate, deliveryPriority, penaltyRisk, penaltyAmount, currency,
 *         penaltyRule, summary, atpResult }
 * Returns { caseId, created, lane }.
 */
export function openCase(data, { actor = INTAKE } = {}) {
  return inTransaction(async () => {
    const existing = await SELECT.one
      .from(DB.Cases)
      .columns('caseId', 'lane_code')
      .where({ salesOrder: data.salesOrder, item: data.item })
    if (existing) return { caseId: existing.caseId, created: false, lane: existing.lane_code }

    const mapping = await SELECT.from(DB.DeliveryPriorityLane)
    const lane = mapLane(data.deliveryPriority, mapping)
    // max() is lexical: fine up to FC-9999
    const last = await SELECT.one.from(DB.Cases).columns('max(caseId) as caseId')
    const caseId = nextCaseId(last?.caseId)

    await INSERT.into(DB.Cases).entries({
      ...data,
      atpResult: json(data.atpResult),
      caseId,
      lane_code: lane,
      status_code: CASE_STATUS.NEW,
      waitingForRole: waitingForRole(CASE_STATUS.NEW),
      version: 0,
    })
    await INSERT.into(DB.AuditLog).entries({
      parentCase_caseId: caseId,
      action: 'openCase',
      actor,
      role: ROLES.SYSTEM,
      fromStatus: null,
      toStatus: CASE_STATUS.NEW,
      payload: json({ salesOrder: data.salesOrder, item: data.item, deliveryPriority: data.deliveryPriority ?? '', lane }),
      outcome: 'DONE',
    })
    emitAfterCommit('case.statusChanged', { caseId, crId: null, from: null, to: CASE_STATUS.NEW, actor, action: 'openCase' })
    return { caseId, created: true, lane }
  })
}

/**
 * A system transition: 'autoConfirm' (NEW → AUTO_CONFIRMED) or
 * 'routeToSupplyPlanning' (NEW → WITH_SUPPLY_PLANNING). No ETag (no user).
 * Throws on refusal: a system step that breaks the rules is a bug.
 */
export function systemTransition(caseId, action, input = {}, { actor = INTAKE } = {}) {
  return inTransaction(async () => {
    const outcome = await apply({
      caseId,
      action,
      input: normalize(input),
      actor: { id: actor, roles: [ROLES.SYSTEM], role: ROLES.SYSTEM },
      ifMatch: null,
    })
    if (!outcome.ok) throw cds.error(`${outcome.code}: ${outcome.message}`, { status: outcome.httpStatus, code: outcome.code })
    return outcome.result
  })
}

/**
 * A delivery priority change in S/4: new lane, audit row, no status change.
 * Returns { caseId, changed, from, to }.
 */
export function updateLane(caseId, deliveryPriority, { actor = INTAKE, comment = null } = {}) {
  return inTransaction(async () => {
    const caseRow = await SELECT.one.from(DB.Cases).where({ caseId }).forUpdate()
    if (!caseRow) throw cds.error(`Case ${caseId} not found`, { status: 404, code: 'CASE_NOT_FOUND' })
    const lane = mapLane(deliveryPriority, await SELECT.from(DB.DeliveryPriorityLane))
    const priority = deliveryPriority ?? ''
    if (lane === caseRow.lane_code && priority === (caseRow.deliveryPriority ?? ''))
      return { caseId, changed: false, from: lane, to: lane }

    const updated = await UPDATE(DB.Cases)
      .set({ deliveryPriority: priority, lane_code: lane, version: caseRow.version + 1 })
      .where({ caseId, version: caseRow.version })
    if (updated !== 1) throw cds.error(`Case ${caseId} has changed`, { status: 412, code: 'STALE_VERSION' })
    await INSERT.into(DB.AuditLog).entries({
      parentCase_caseId: caseId,
      action: 'updateLane',
      actor,
      role: ROLES.SYSTEM,
      fromStatus: caseRow.status_code,
      toStatus: caseRow.status_code,
      comment: text(comment),
      payload: json({ deliveryPriority: priority, fromLane: caseRow.lane_code, toLane: lane }),
      outcome: 'DONE',
    })
    return { caseId, changed: true, from: caseRow.lane_code, to: lane }
  })
}

// --- Recommendations (A2–A5) --------------------------------------------------

/**
 * Stores a recommendation on a case (and optionally its CR). Never touches
 * the status. JSON fields may be passed as objects.
 * rec: { caseId, crId, agent, kind, options, recommendedOption, rationale,
 *        inputSnapshot, modelId, promptVersion, llmUsed, fallbackReason, agentTaskId }
 * Returns the new recommendation ID.
 */
export function attachRecommendation(rec) {
  return inTransaction(async () => {
    const caseRow = await SELECT.one.from(DB.Cases).columns('caseId').where({ caseId: rec.caseId })
    if (!caseRow) throw cds.error(`Case ${rec.caseId} not found`, { status: 404, code: 'CASE_NOT_FOUND' })
    if (rec.crId) {
      const cr = await SELECT.one.from(DB.CapacityRequests).columns('crId', 'parentCase_caseId').where({ crId: rec.crId })
      const check = checkCapacityRequest(cr ?? { crId: rec.crId }, caseRow) // rule 5
      if (!check.ok) throw cds.error(check.message, { status: check.httpStatus, code: check.code })
    }
    const ID = cds.utils.uuid()
    await INSERT.into(DB.Recommendations).entries({
      ID,
      parentCase_caseId: rec.caseId,
      capacityRequest_crId: rec.crId ?? null,
      agent: rec.agent,
      kind_code: rec.kind,
      options: json(rec.options),
      recommendedOption: rec.recommendedOption ?? null,
      rationale: rec.rationale ?? null,
      inputSnapshot: json(rec.inputSnapshot),
      modelId: rec.modelId ?? null,
      promptVersion: rec.promptVersion ?? null,
      llmUsed: !!rec.llmUsed,
      fallbackReason: rec.fallbackReason ?? null,
      agentTaskId: rec.agentTaskId ?? null,
    })
    // The case keeps a copy of the latest summary and customer draft for the
    // apps (plan 2.0). Not a status change, so the version (ETag) stays.
    const copyTo = CASE_TEXT_FIELD[rec.kind]
    if (copyTo) await UPDATE(DB.Cases).set({ [copyTo]: rec.rationale ?? null }).where({ caseId: rec.caseId })
    return ID
  })
}

/**
 * Records an agent's Claude run on a stored recommendation (plan 6.1): the
 * checked text replaces the rationale when llmUsed, and the run's model,
 * persona version, fallback reason, task ID and tool results are kept. The
 * case copy of a summary or customer draft follows, as long as this is still
 * the case's latest recommendation of its kind. Never a status change.
 * run: { text, llmUsed, fallbackReason, modelId, promptVersion, agentTaskId, inputSnapshot }
 * Returns false when the recommendation no longer exists (e.g. after a demo reset).
 */
export function recordAgentRun(recommendationId, run) {
  return inTransaction(async () => {
    const rec = await SELECT.one.from(DB.Recommendations)
      .columns('ID', 'parentCase_caseId', 'capacityRequest_crId', 'kind_code', 'createdAt')
      .where({ ID: recommendationId })
    if (!rec) return false
    await UPDATE(DB.Recommendations)
      .set({
        ...(run.llmUsed && { rationale: run.text }),
        llmUsed: !!run.llmUsed,
        fallbackReason: run.fallbackReason ?? null,
        modelId: run.llmUsed ? (run.modelId ?? null) : null,
        promptVersion: run.promptVersion ?? null,
        agentTaskId: run.agentTaskId ?? null,
        inputSnapshot: json(run.inputSnapshot),
      })
      .where({ ID: recommendationId })
    const copyTo = CASE_TEXT_FIELD[rec.kind_code]
    if (copyTo && run.llmUsed) {
      const latest = await SELECT.one.from(DB.Recommendations).columns('ID')
        .where({ parentCase_caseId: rec.parentCase_caseId, kind_code: rec.kind_code })
        .orderBy('createdAt desc')
      if (latest?.ID === rec.ID) await UPDATE(DB.Cases).set({ [copyTo]: run.text }).where({ caseId: rec.parentCase_caseId })
    }
    return true
  })
}

// --- Append-only AuditLog (rule 6) --------------------------------------------

const guarded = new WeakSet()

/** Refuses UPDATE and DELETE on AuditLog at the database service, whoever sends them. */
export function guardAuditLog(db) {
  if (!db || guarded.has(db)) return
  guarded.add(db)
  db.before(['UPDATE', 'DELETE', 'UPSERT'], DB.AuditLog, req =>
    req.reject({ status: 405, code: 'AUDIT_APPEND_ONLY', message: `The audit log is append-only (${ORCHESTRATOR}).` }),
  )
}

if (cds.db) guardAuditLog(cds.db)
cds.on('connect', srv => srv.name === 'db' && guardAuditLog(srv))

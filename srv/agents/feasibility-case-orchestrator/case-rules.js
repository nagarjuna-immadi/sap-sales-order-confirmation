// Case rules of the Feasibility Case Orchestrator (blueprint §7 A1).
//
// Pure functions on plain objects, no CDS imports: the orchestrator reads the
// rows, asks these functions, and writes the result. Every check returns
// { ok: true, next } or { ok: false, code, message, httpStatus }; the
// orchestrator turns a refusal into req.error(httpStatus, code) and an
// AuditLog row with outcome REFUSED.
//
// Rows may come straight from a CDS select (status_code) or be expanded
// (status: { code }); both are accepted.

export const ROLES = Object.freeze({
  SALES: 'Sales',
  SUPPLY_PLANNER: 'SupplyPlanner',
  PRODUCTION_PLANNER: 'ProductionPlanner',
  // System steps by the agents (Sales Order Intake on intake). Never a user role.
  SYSTEM: 'system',
})

export const CASE_STATUS = Object.freeze({
  NEW: 'NEW',
  AUTO_CONFIRMED: 'AUTO_CONFIRMED',
  WITH_SUPPLY_PLANNING: 'WITH_SUPPLY_PLANNING',
  WITH_PRODUCTION: 'WITH_PRODUCTION',
  PRODUCTION_CONFIRMED: 'PRODUCTION_CONFIRMED',
  PRODUCTION_REJECTED: 'PRODUCTION_REJECTED',
  SUPPLY_CONFIRMED: 'SUPPLY_CONFIRMED',
  REJECTED: 'REJECTED',
  CONFIRMED_TO_CUSTOMER: 'CONFIRMED_TO_CUSTOMER',
  CLOSED: 'CLOSED',
})

export const CR_STATUS = Object.freeze({
  OPEN: 'OPEN',
  PRODUCTION_CONFIRMED: 'PRODUCTION_CONFIRMED',
  PRODUCTION_REJECTED: 'PRODUCTION_REJECTED',
})

const S = CASE_STATUS
const R = ROLES

// The §7 A1 status table, one row per action. `role` is always the role that
// waitingForRole() returns for every status in `from` (system for NEW).
// crTo: the active capacity request's next status; createsCr: the action opens
// a new CR (status OPEN) under the case.
export const TRANSITIONS = Object.freeze({
  // System, on intake (Sales Order Intake agent)
  autoConfirm: { from: [S.NEW], to: S.AUTO_CONFIRMED, role: R.SYSTEM, needsReason: false },
  routeToSupplyPlanning: { from: [S.NEW], to: S.WITH_SUPPLY_PLANNING, role: R.SYSTEM, needsReason: false },

  // Supply Planning Workbench
  confirmFromStock: { from: [S.WITH_SUPPLY_PLANNING], to: S.SUPPLY_CONFIRMED, role: R.SUPPLY_PLANNER, needsReason: false },
  approveStockTransfer: { from: [S.WITH_SUPPLY_PLANNING], to: S.SUPPLY_CONFIRMED, role: R.SUPPLY_PLANNER, needsReason: false },
  approveReallocation: { from: [S.WITH_SUPPLY_PLANNING], to: S.SUPPLY_CONFIRMED, role: R.SUPPLY_PLANNER, needsReason: false },
  requestProductionCheck: {
    from: [S.WITH_SUPPLY_PLANNING, S.PRODUCTION_REJECTED],
    to: S.WITH_PRODUCTION,
    role: R.SUPPLY_PLANNER,
    needsReason: false,
    createsCr: true,
  },
  reject: {
    from: [S.WITH_SUPPLY_PLANNING, S.PRODUCTION_CONFIRMED, S.PRODUCTION_REJECTED],
    to: S.REJECTED,
    role: R.SUPPLY_PLANNER,
    needsReason: true,
  },
  confirmDateToSales: { from: [S.PRODUCTION_CONFIRMED], to: S.SUPPLY_CONFIRMED, role: R.SUPPLY_PLANNER, needsReason: false },

  // Production Capacity Workbench (act on the active CR)
  chooseOption: {
    from: [S.WITH_PRODUCTION],
    to: S.PRODUCTION_CONFIRMED,
    role: R.PRODUCTION_PLANNER,
    needsReason: false,
    crTo: CR_STATUS.PRODUCTION_CONFIRMED,
  },
  chooseOverrideOption: {
    from: [S.WITH_PRODUCTION],
    to: S.PRODUCTION_CONFIRMED,
    role: R.PRODUCTION_PLANNER,
    needsReason: true,
    crTo: CR_STATUS.PRODUCTION_CONFIRMED,
  },
  rejectProduction: {
    from: [S.WITH_PRODUCTION],
    to: S.PRODUCTION_REJECTED,
    role: R.PRODUCTION_PLANNER,
    needsReason: true,
    crTo: CR_STATUS.PRODUCTION_REJECTED,
  },

  // Sales Order Feasibility
  confirmToCustomer: { from: [S.SUPPLY_CONFIRMED], to: S.CONFIRMED_TO_CUSTOMER, role: R.SALES, needsReason: false },
  close: { from: [S.REJECTED], to: S.CLOSED, role: R.SALES, needsReason: false },
})

const WAITING_FOR = Object.freeze({
  [S.NEW]: null, // system
  [S.AUTO_CONFIRMED]: null,
  [S.WITH_SUPPLY_PLANNING]: R.SUPPLY_PLANNER,
  [S.WITH_PRODUCTION]: R.PRODUCTION_PLANNER,
  [S.PRODUCTION_CONFIRMED]: R.SUPPLY_PLANNER,
  [S.PRODUCTION_REJECTED]: R.SUPPLY_PLANNER,
  [S.SUPPLY_CONFIRMED]: R.SALES,
  [S.REJECTED]: R.SALES,
  [S.CONFIRMED_TO_CUSTOMER]: null,
  [S.CLOSED]: null,
})

const FINAL = new Set([S.AUTO_CONFIRMED, S.CONFIRMED_TO_CUSTOMER, S.CLOSED])

/** The role that has to act next, or null (system step or final status). */
export function waitingForRole(status) {
  if (!(status in WAITING_FOR)) throw new Error(`Unknown case status ${status}`)
  return WAITING_FOR[status]
}

/** True for AUTO_CONFIRMED, CONFIRMED_TO_CUSTOMER and CLOSED. */
export function isFinal(status) {
  return FINAL.has(status)
}

// --- Refusals -----------------------------------------------------------------

const refuse = (httpStatus, code, message) => ({ ok: false, code, message, httpStatus })

const codeOf = value => (value && typeof value === 'object' ? value.code : value)
const statusOf = row => row?.status_code ?? codeOf(row?.status)
const parentOf = cr => cr?.parentCase_caseId ?? codeOf(cr?.parentCase) ?? cr?.parentCase?.caseId
const isBlank = text => text == null || String(text).trim() === ''

const parseOptions = options => {
  if (options == null || options === '') return null
  if (Array.isArray(options)) return options
  try {
    const parsed = JSON.parse(options)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Rule 5: a capacity request needs a parent case. Used when a CR is created
 * and for every action on one.
 */
export function checkCapacityRequest(cr, caseRow) {
  const parent = parentOf(cr)
  if (isBlank(parent)) {
    return refuse(400, 'CR_WITHOUT_PARENT', `Capacity request ${cr?.crId ?? '(new)'} has no parent case.`)
  }
  if (caseRow && parent !== caseRow.caseId) {
    return refuse(400, 'CR_WITHOUT_PARENT', `Capacity request ${cr.crId} belongs to ${parent}, not to ${caseRow.caseId}.`)
  }
  return { ok: true }
}

/**
 * Checks one action on a case against the status table and business rules 1–5.
 *
 * caseRow:   { caseId, status_code | status }
 * action:    a key of TRANSITIONS
 * userRoles: the user's roles (ROLES values); ROLES.SYSTEM for agent steps
 * input:     { reason, comment, optionId }
 * activeCr:  { crId, parentCase_caseId | parentCase, status_code | status, options } or null
 *
 * next: { status, waitingForRole, crStatus, createsCr, needsOverride }
 */
export function canAct({ caseRow, action, userRoles = [], input = {}, activeCr = null }) {
  const t = TRANSITIONS[action]
  if (!t) return refuse(400, 'UNKNOWN_ACTION', `Unknown action ${action}.`)

  const caseId = caseRow?.caseId
  const status = statusOf(caseRow)
  if (!(status in WAITING_FOR)) return refuse(400, 'UNKNOWN_STATUS', `Case ${caseId} has unknown status ${status}.`)

  // Status first, so that the refusal names the real reason (scenario 5: Sales
  // confirming to the customer in WITH_PRODUCTION hears "not SUPPLY_CONFIRMED").
  if (isFinal(status)) return refuse(400, 'CASE_FINAL', `Case ${caseId} is ${status}; no further action is possible.`)

  // Rule 2
  if (action === 'confirmToCustomer' && status !== S.SUPPLY_CONFIRMED) {
    return refuse(
      400,
      'CONFIRM_ONLY_IN_SUPPLY_CONFIRMED',
      `Confirm to customer is only allowed when the case is ${S.SUPPLY_CONFIRMED}; ${caseId} is ${status}.`,
    )
  }
  if (!t.from.includes(status)) {
    return refuse(400, 'INVALID_TRANSITION', `Action ${action} is not allowed for case ${caseId} in status ${status}.`)
  }

  // Rule 1
  const required = waitingForRole(status) ?? R.SYSTEM
  if (!userRoles.includes(required)) {
    return refuse(403, 'NOT_WAITING_FOR_ROLE', `Case ${caseId} is waiting for ${required}; only that role can act.`)
  }

  // Rule 5, and the CR the production actions and rule 3 work on
  if (t.crTo || action === 'confirmDateToSales') {
    if (!activeCr) return refuse(400, 'NO_ACTIVE_CR', `Case ${caseId} has no active capacity request.`)
    const parentCheck = checkCapacityRequest(activeCr, caseRow)
    if (!parentCheck.ok) return parentCheck
  }
  if (t.crTo && statusOf(activeCr) !== CR_STATUS.OPEN) {
    return refuse(400, 'CR_NOT_OPEN', `Capacity request ${activeCr.crId} is ${statusOf(activeCr)}, not ${CR_STATUS.OPEN}.`)
  }

  // Rule 3
  if (action === 'confirmDateToSales' && statusOf(activeCr) !== CR_STATUS.PRODUCTION_CONFIRMED) {
    return refuse(
      400,
      'CR_NOT_PRODUCTION_CONFIRMED',
      `Confirm date to Sales needs capacity request ${activeCr.crId} to be ${CR_STATUS.PRODUCTION_CONFIRMED}; it is ${statusOf(activeCr)}.`,
    )
  }

  // Rule 4
  if (t.needsReason && isBlank(input.reason)) {
    return refuse(400, 'REASON_REQUIRED', `Action ${action} needs a reason.`)
  }

  // The chosen option must be one of the CR's options; an option inside the
  // frozen horizon only goes through chooseOverrideOption (with a reason).
  let needsOverride = false
  if (action === 'chooseOption' || action === 'chooseOverrideOption') {
    if (isBlank(input.optionId)) return refuse(400, 'OPTION_REQUIRED', `Action ${action} needs an option.`)
    const options = parseOptions(activeCr.options)
    if (options) {
      const option = options.find(o => o.optionId === input.optionId)
      if (!option) {
        return refuse(400, 'UNKNOWN_OPTION', `Option ${input.optionId} is not an option of ${activeCr.crId}.`)
      }
      needsOverride = !!option.needsOverride
      if (needsOverride && action === 'chooseOption') {
        return refuse(
          400,
          'OVERRIDE_NEEDS_REASON',
          `Option ${input.optionId} changes orders inside the frozen horizon; choose it as an override with a reason.`,
        )
      }
    }
  }

  return {
    ok: true,
    next: {
      status: t.to,
      waitingForRole: waitingForRole(t.to),
      crStatus: t.crTo ?? null,
      createsCr: !!t.createsCr,
      needsOverride,
    },
  }
}

// --- Lanes and IDs ------------------------------------------------------------

/**
 * Delivery priority → lane code, from DeliveryPriorityLane rows
 * ({ deliveryPriority, lane_code } or { deliveryPriority, lane }). Blank and
 * unknown priorities map to NORMAL. A one-digit priority is read as NUMC 2 ("1" = "01").
 */
export function mapLane(deliveryPriority, mappingRows = []) {
  let key = deliveryPriority == null ? '' : String(deliveryPriority).trim()
  if (/^\d$/.test(key)) key = `0${key}`
  const row = mappingRows.find(r => (r.deliveryPriority ?? '').trim() === key)
  return (row && (row.lane_code ?? codeOf(row.lane))) || 'NORMAL'
}

const nextId = (prefix, lastId) => {
  if (lastId == null || lastId === '') return `${prefix}-0001`
  const match = new RegExp(`^${prefix}-(\\d+)$`).exec(lastId)
  if (!match) throw new Error(`Expected an ID like ${prefix}-0001, got ${lastId}`)
  return `${prefix}-${String(Number(match[1]) + 1).padStart(4, '0')}`
}

/** FC-0007 → FC-0008; no case yet → FC-0001. */
export function nextCaseId(lastId) {
  return nextId('FC', lastId)
}

/** CR-0001 → CR-0002; no CR yet → CR-0001. */
export function nextCrId(lastId) {
  return nextId('CR', lastId)
}

// Handlers shared by the three case services (development plan 1.4). Each
// service is one role's view of the same cases:
// - reads are limited to the cases that role may see (case-access.js, rule 8),
//   on the cases and on everything hanging off them, and get a default order;
// - the Case Timeline gets its durations (case-timeline.js);
// - every bound action goes to the orchestrator, which checks the ETag and the
//   rules and writes status and audit row. The action returns the entity
//   again, so Fiori elements gets the new status and version.

import cds from '@sap/cds'
import { executeAction } from '../agents/feasibility-case-orchestrator/orchestrator.js'
import { canRead, scopeOf } from './case-access.js'
import { addDurations, requestedDurations } from './case-timeline.js'

const { SELECT } = cds.ql

// Path from each exposed entity to its case
const CASE_PATH = {
  Cases: '',
  CapacityRequests: 'parentCase.',
  Recommendations: 'parentCase.',
  SupplyResults: 'parentCase.',
  CaseTimeline: 'parentCase.',
}

const TIMELINE_INPUTS = ['at', 'previousAt', 'outcome']

/** The case behind a bound action's target, with what canRead needs. */
async function caseOf(req) {
  const param = req.params.at(-1)
  const key = 'crId' in (req.target.keys ?? {}) ? 'crId' : 'caseId'
  const value = param && typeof param === 'object' ? param[key] : param
  const caseId =
    key === 'crId'
      ? (await SELECT.one.from('order.conf.CapacityRequest').columns('parentCase_caseId').where({ crId: value }))
          ?.parentCase_caseId
      : value
  const caseRow = caseId && (await SELECT.one.from('order.conf.OrderFeasibilityCase').columns('caseId', 'status_code').where({ caseId }))
  if (!caseRow) return null
  const cr = await SELECT.one.from('order.conf.CapacityRequest').columns('crId').where({ parentCase_caseId: caseId })
  return { ...caseRow, hasCapacityRequest: !!cr, key, value }
}

/**
 * srv:     the case service
 * role:    the role the service is for (also its @requires)
 * actions: { actionName: 'Cases' | 'CapacityRequests' } — the entity the action is bound to
 * order:   { entityName: ['laneRank', 'requestedDate'] } — default sort when the client sends none
 */
export function registerCaseHandlers(srv, { role, actions, order = {} }) {
  const { entities } = srv

  for (const [name, path] of Object.entries(CASE_PATH)) {
    const entity = entities[name]
    if (!entity) continue
    srv.before('READ', entity, req => {
      const scope = scopeOf(req.user, [role], path)
      if (scope) req.query.where(scope)
      // default order when the client sent none (CAP adds the keys for paging)
      const select = req.query.SELECT
      const keys = Object.keys(entity.keys ?? {})
      const clientOrder = select.orderBy?.some(o => !keys.includes(o.ref?.at(-1)))
      if (order[name] && !clientOrder && !select.one) {
        const keyOrder = select.orderBy ?? []
        select.orderBy = []
        req.query.orderBy(...order[name])
        select.orderBy.push(...keyOrder)
      }
    })
  }

  if (entities.CaseTimeline) {
    // CAP drops virtual columns from the query: remember which ones were asked for
    const durations = new WeakMap()
    srv.before('READ', entities.CaseTimeline, req => {
      durations.set(req, requestedDurations(req.query))
      // durations are derived from these, whatever $select asked for
      const { columns } = req.query.SELECT
      if (columns && !columns.some(c => c === '*')) {
        for (const name of TIMELINE_INPUTS)
          if (!columns.some(c => c.ref?.[0] === name && !c.as)) columns.push({ ref: [name] })
      }
    })
    srv.after('READ', entities.CaseTimeline, (result, req) => addDurations(result, durations.get(req)))
  }

  for (const [action, entityName] of Object.entries(actions)) {
    const entity = entities[entityName]
    srv.on(action, entity, async req => {
      // rule 8: a case outside this role's view is "not found"
      const target = await caseOf(req)
      if (!target || !canRead(req.user, target, [role])) return req.reject(404, `${target?.value ?? 'Case'} not found`)
      await executeAction(req, action, req.data)
      return SELECT.one.from(entity).where({ [target.key]: target.value })
    })
  }
}

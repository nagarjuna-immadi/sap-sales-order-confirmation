// Runs agents on case events (development plan 2.3, blueprint §5.1).
//
// The orchestrator emits case.statusChanged after the commit, detached from
// the request. Each agent then runs in its own background transaction
// (cds.spawn) as a privileged system user: the request's transaction is
// finished by then, and an agent must never block or roll back the action.
// A failure is logged by the orchestrator's event bus and changes nothing.

import cds from '@sap/cds'
import { onCaseEvent } from '../agents/feasibility-case-orchestrator/orchestrator.js'

const LOG = cds.log('agents')

/**
 * Subscribes `handler(event)` to status changes for which `when(event)` is true.
 * event: { caseId, crId, from, to, actor, action }
 */
export function onStatusChange(agent, when, handler) {
  return onCaseEvent('case.statusChanged', event => {
    if (!when(event)) return
    return new Promise((resolve, reject) => {
      const job = cds.spawn({ user: cds.User.privileged }, () => handler(event))
      job.on('succeeded', () => {
        LOG.debug(`${agent} done for ${event.caseId} (${event.to})`)
        resolve()
      })
      job.on('failed', e => reject(Object.assign(e, { message: `${agent} on ${event.caseId} → ${event.to}: ${e.message}` })))
    })
  })
}

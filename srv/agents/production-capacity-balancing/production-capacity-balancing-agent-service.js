// ProductionCapacityBalancingAgentService handlers (A4; development plan 6.2).
//
// Read-only: the options stored on the capacity request and its latest
// CAPACITY_OPTIONS recommendation (srv/lib/case-snapshots.js). The load rows
// are cut down to the work centers and days an option changes.

import cds from '@sap/cds'
import { getCaseFacts, getCapacityRequest } from '../../lib/case-facts.js'
import { getCapacityOptions } from '../../lib/case-snapshots.js'
import { fixMasking } from '../../lib/agent-masking.js'

export default class ProductionCapacityBalancingAgentService extends cds.ApplicationService {
  init() {
    this.after('buildMiddleware', fixMasking(this)) // plugin masking fixes (agent-masking.js)

    this.on('getCapacityOptions', async req => {
      const crId = String(req.data.crId ?? '').trim()
      const cr = await getCapacityRequest(crId)
      if (!cr) return req.reject(404, `Capacity request ${crId} not found`)
      return getCapacityOptions(cr, await getCaseFacts(cr.parentCase_caseId))
    })

    return super.init()
  }
}

// SupplyInventoryAgentService handlers (A3; development plan 6.2).
//
// Read-only: the latest SupplyResult and SUPPLY_OPTIONS recommendation of the
// case, as supply-inventory.js stored them (srv/lib/case-snapshots.js).
// Nothing is recalculated here, so Claude explains exactly the ranking the
// planner sees.

import cds from '@sap/cds'
import { getCaseFacts } from '../../lib/case-facts.js'
import { getSupplyPicture } from '../../lib/case-snapshots.js'
import { fixMasking } from '../../lib/agent-masking.js'

export default class SupplyInventoryAgentService extends cds.ApplicationService {
  init() {
    this.after('buildMiddleware', fixMasking(this)) // plugin masking fixes (agent-masking.js)

    this.on('getSupplyPicture', async req => {
      const caseId = String(req.data.caseId ?? '').trim()
      const f = await getCaseFacts(caseId)
      if (!f) return req.reject(404, `Case ${caseId} not found`)
      const picture = await getSupplyPicture(f)
      if (!picture) return req.reject(404, `Case ${caseId} has no supply check yet`)
      return picture
    })

    return super.init()
  }
}

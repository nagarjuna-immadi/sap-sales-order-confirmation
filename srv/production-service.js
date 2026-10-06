import cds from '@sap/cds'
import { registerCaseHandlers } from './lib/case-service.js'
import { latestRecommendation } from './lib/case-facts.js'

const { SELECT } = cds.ql

const ACTIONS = ['chooseOption', 'chooseOverrideOption', 'rejectProduction']

export default class ProductionService extends cds.ApplicationService {
  init() {
    // Links the capacity options shown to the decision's audit row. The
    // orchestrator marks it accepted when the chosen option is the recommended one.
    this.before(ACTIONS, this.entities.CapacityRequests, async req => {
      const param = req.params.at(-1)
      const crId = typeof param === 'object' ? param.crId : param
      const cr = await SELECT.one.from('order.conf.CapacityRequest').columns('parentCase_caseId').where({ crId })
      const rec = cr && (await latestRecommendation(cr.parentCase_caseId, 'CAPACITY_OPTIONS', crId))
      if (!rec) return
      req.data.recommendationId = rec.ID
      if (req.event === 'rejectProduction') req.data.recommendationAccepted = !rec.recommendedOption
    })

    registerCaseHandlers(this, {
      role: 'ProductionPlanner',
      actions: {
        chooseOption: 'CapacityRequests',
        chooseOverrideOption: 'CapacityRequests',
        rejectProduction: 'CapacityRequests',
      },
      order: {
        CapacityRequests: ['laneRank', 'requestedDate'],
        Cases: ['laneRank', 'requestedDate'],
        CaseTimeline: ['at'],
        Notifications: ['createdAt desc'],
      },
    })
    return super.init()
  }
}

import cds from '@sap/cds'
import { registerCaseHandlers } from './lib/case-service.js'

export default class ProductionService extends cds.ApplicationService {
  init() {
    registerCaseHandlers(this, {
      role: 'ProductionPlanner',
      actions: {
        chooseOption: 'CapacityRequests',
        chooseOverrideOption: 'CapacityRequests',
        rejectProduction: 'CapacityRequests',
      },
      order: { CapacityRequests: ['laneRank', 'requestedDate'], Cases: ['laneRank', 'requestedDate'], CaseTimeline: ['at'] },
    })
    return super.init()
  }
}

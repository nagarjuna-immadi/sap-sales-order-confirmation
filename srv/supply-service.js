import cds from '@sap/cds'
import { registerCaseHandlers } from './lib/case-service.js'

export default class SupplyPlanningService extends cds.ApplicationService {
  init() {
    registerCaseHandlers(this, {
      role: 'SupplyPlanner',
      actions: {
        confirmFromStock: 'Cases',
        approveStockTransfer: 'Cases',
        approveReallocation: 'Cases',
        requestProductionCheck: 'Cases',
        reject: 'Cases',
        confirmDateToSales: 'Cases',
      },
      order: { Cases: ['laneRank', 'requestedDate'], CaseTimeline: ['at'] },
    })
    return super.init()
  }
}

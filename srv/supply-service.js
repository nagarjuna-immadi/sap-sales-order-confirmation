import cds from '@sap/cds'
import { registerCaseHandlers } from './lib/case-service.js'
import { getCaseFacts, latestRecommendation } from './lib/case-facts.js'
import { getPlanningParameters } from './lib/tools/config.js'
import { dateOf, offsetOf } from './lib/demo-clock.js'

// The Supply & Inventory ladder option each action carries out (plan 2.2–2.3).
const OPTION_OF = {
  confirmFromStock: 'S-LOCAL',
  approveStockTransfer: 'S-TRANSFER',
  approveReallocation: 'S-REALLOCATE',
  requestProductionCheck: 'S-PRODUCE',
  reject: 'S-REJECT',
  confirmDateToSales: 'S-CONFIRM-DATE',
}

export default class SupplyPlanningService extends cds.ApplicationService {
  init() {
    // Numbers for the action come from the agent's tools, not from the user:
    // confirmed date and quantity, the CR's need-by date and quantity. The
    // recommendation shown is linked to the audit row (accepted or not).
    this.before(Object.keys(OPTION_OF), this.entities.Cases, async req => {
      const param = req.params.at(-1)
      const caseId = typeof param === 'object' ? param.caseId : param
      const optionId = OPTION_OF[req.event]
      const rec = await latestRecommendation(caseId, 'SUPPLY_OPTIONS')
      const option = rec?.options.find(o => o.optionId === optionId)
      if (rec) {
        req.data.recommendationId = rec.ID
        req.data.recommendationAccepted = rec.recommendedOption === optionId
      }
      if (option?.confirmedDate) {
        req.data.confirmedDate = option.confirmedDate
        req.data.confirmedQty = option.confirmedQty
      }
      if (req.event === 'requestProductionCheck') {
        const facts = await getCaseFacts(caseId)
        if (!facts) return
        if (!req.data.needByDate) {
          const { shippingLeadDays } = await getPlanningParameters(facts.plant)
          req.data.needByDate = dateOf(offsetOf(facts.requestedDate) - shippingLeadDays)
        }
        req.data.quantity = option?.produceQty || facts.quantity
      }
    })

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
      order: { Cases: ['laneRank', 'requestedDate'], CaseTimeline: ['at'], Notifications: ['createdAt desc'] },
    })
    return super.init()
  }
}

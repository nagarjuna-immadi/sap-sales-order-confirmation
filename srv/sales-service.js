import cds from '@sap/cds'
import { registerCaseHandlers } from './lib/case-service.js'
import { reevaluateCase } from './agents/sales-order-intake/sales-order-intake.js'

const { SELECT } = cds.ql

export default class SalesService extends cds.ApplicationService {
  init() {
    // Re-runs Sales Order Intake for the item: lane, ATP, penalty, summary. No status change.
    this.on('checkFeasibility', this.entities.Cases, async req => {
      const param = req.params.at(-1)
      const caseId = typeof param === 'object' ? param.caseId : param
      await reevaluateCase(caseId)
      return SELECT.one.from(this.entities.Cases).where({ caseId })
    })
    registerCaseHandlers(this, {
      role: 'Sales',
      actions: { confirmToCustomer: 'Cases', close: 'Cases' },
      order: { Cases: ['salesOrder', 'item'], CaseTimeline: ['at'], Notifications: ['createdAt desc'] },
    })
    return super.init()
  }
}

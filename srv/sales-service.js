import cds from '@sap/cds'
import { registerCaseHandlers } from './lib/case-service.js'

export default class SalesService extends cds.ApplicationService {
  init() {
    // Sales Order Intake comes in phase 2
    this.on('checkFeasibility', this.entities.Cases, req =>
      req.reject(501, 'The feasibility check comes with the Sales Order Intake agent (phase 2).'),
    )
    registerCaseHandlers(this, {
      role: 'Sales',
      actions: { confirmToCustomer: 'Cases', close: 'Cases' },
      order: { Cases: ['salesOrder', 'item'], CaseTimeline: ['at'] },
    })
    return super.init()
  }
}

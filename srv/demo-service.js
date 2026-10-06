import cds from '@sap/cds'
import { intakeItem } from './agents/sales-order-intake/sales-order-intake.js'
import { getSalesOrderItem } from './lib/s4/sales-order.js'

export default class DemoService extends cds.ApplicationService {
  init() {
    this.on('openCase', req => this.onOpenCase(req))
    return super.init()
  }

  // Runs Sales Order Intake for one item. Phase 2.4 replaces this with
  // simulateNewOrder (a simulated S/4 event for the whole order).
  async onOpenCase(req) {
    const salesOrder = req.data.salesOrder?.trim()
    const item = req.data.item?.trim() || '10'
    if (!salesOrder) return req.reject(400, 'Enter a sales order, e.g. SO-5005.')

    const line = await getSalesOrderItem(salesOrder, item)
    if (!line) return req.reject(404, `Sales order item ${salesOrder} / ${item} not found.`)
    const { caseId, created, lane, status } = await intakeItem(line)
    return { caseId, created, lane, status }
  }
}

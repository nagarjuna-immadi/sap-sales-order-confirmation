import cds from '@sap/cds'
import { openCase, systemTransition } from './agents/feasibility-case-orchestrator/orchestrator.js'
import { getSalesOrderItem } from './lib/s4/sales-order.js'

const { SELECT } = cds.ql

export default class DemoService extends cds.ApplicationService {
  init() {
    this.on('openCase', req => this.onOpenCase(req))
    return super.init()
  }

  // Phase 2.4 replaces this with simulateNewOrder (Sales Order Intake).
  async onOpenCase(req) {
    const salesOrder = req.data.salesOrder?.trim()
    const item = req.data.item?.trim() || '10'
    if (!salesOrder) return req.reject(400, 'Enter a sales order, e.g. SO-5005.')

    const line = await getSalesOrderItem(salesOrder, item)
    if (!line) return req.reject(404, `Sales order item ${salesOrder} / ${item} not found.`)

    const opened = await openCase({
      salesOrder,
      item,
      customer_ID: line.customer,
      material: line.material,
      plant: line.plant,
      quantity: line.quantity,
      quantityUnit: line.quantityUnit,
      requestedDate: line.requestedDate,
      deliveryPriority: line.deliveryPriority,
      currency: line.currency,
    })
    if (opened.created) return { ...opened, status: (await systemTransition(opened.caseId, 'routeToSupplyPlanning')).to }
    const existing = await SELECT.one.from('order.conf.OrderFeasibilityCase').columns('status_code').where({ caseId: opened.caseId })
    return { ...opened, status: existing.status_code }
  }
}

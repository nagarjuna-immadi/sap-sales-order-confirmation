import cds from '@sap/cds'
import { openCase, systemTransition } from './agents/feasibility-case-orchestrator/orchestrator.js'

const { SELECT } = cds.ql

export default class DemoService extends cds.ApplicationService {
  init() {
    this.on('openCase', req => this.onOpenCase(req))
    return super.init()
  }

  // Reads the order flat, entity by entity (the mock has no $expand, phase 0).
  // Phase 2 moves this read into the sales order adapter.
  async onOpenCase(req) {
    const salesOrder = req.data.salesOrder?.trim()
    const item = req.data.item?.trim() || '10'
    if (!salesOrder) return req.reject(400, 'Enter a sales order, e.g. SO-5005.')

    const s4 = await cds.connect.to('API_SALES_ORDER_SRV')
    const { A_SalesOrder, A_SalesOrderItem, A_SalesOrderScheduleLine } = s4.entities
    const header = await s4.run(SELECT.one.from(A_SalesOrder).where({ SalesOrder: salesOrder }))
    const line = await s4.run(SELECT.one.from(A_SalesOrderItem).where({ SalesOrder: salesOrder, SalesOrderItem: item }))
    if (!header || !line) return req.reject(404, `Sales order item ${salesOrder} / ${item} not found.`)
    const schedule = await s4.run(
      SELECT.one
        .from(A_SalesOrderScheduleLine)
        .where({ SalesOrder: salesOrder, SalesOrderItem: item })
        .orderBy('ScheduleLine'),
    )

    const opened = await openCase({
      salesOrder,
      item,
      customer_ID: header.SoldToParty,
      material: line.Material,
      plant: line.ProductionPlant,
      quantity: line.RequestedQuantity,
      quantityUnit: line.RequestedQuantityUnit,
      requestedDate: schedule?.RequestedDeliveryDate ?? header.RequestedDeliveryDate,
      deliveryPriority: line.DeliveryPriority,
      currency: line.TransactionCurrency,
    })
    if (opened.created) return { ...opened, status: (await systemTransition(opened.caseId, 'routeToSupplyPlanning')).to }
    const existing = await SELECT.one.from('order.conf.OrderFeasibilityCase').columns('status_code').where({ caseId: opened.caseId })
    return { ...opened, status: existing.status_code }
  }
}

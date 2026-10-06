// Demo helpers (development plan 2.4): simulated S/4 sales order events,
// a delivery priority change in the S/4 mock, the scenario 4 switch and a
// reset. Demo only.

import cds from '@sap/cds'
import { intakeOrder } from './agents/sales-order-intake/sales-order-intake.js'
import { getSalesOrderItems } from './lib/s4/sales-order.js'
import { connect, isMocked } from './lib/s4/connection.js'
import { setScenario, getScenario } from './lib/demo-scenario.js'
import { clearCache } from './lib/cache.js'

const { UPDATE, SELECT } = cds.ql

const SALES_ORDER_SERVICE = 'API_SALES_ORDER_SRV'
const EVENT_TYPE = {
  created: 'sap.s4.beh.salesorder.v1.SalesOrder.Created.v1',
  changed: 'sap.s4.beh.salesorder.v1.SalesOrder.Changed.v1',
}

/** A CloudEvents 1.0 envelope in the S/4 format for a sales order. */
async function salesOrderEvent(type, salesOrder) {
  const [item] = await getSalesOrderItems(salesOrder)
  const now = new Date().toISOString()
  return {
    id: cds.utils.uuid(),
    specversion: '1.0',
    source: '/default/sap.s4.beh/demo',
    type,
    subject: salesOrder,
    time: now,
    datacontenttype: 'application/json',
    data: { SalesOrder: salesOrder, SoldToParty: item?.customer ?? null, EventRaisedDateTime: now },
  }
}

/** Runs fn in its own transaction after the current one, and waits for it. */
const detached = fn =>
  new Promise((resolve, reject) => {
    let result
    const job = cds.spawn({ user: cds.User.privileged }, async () => (result = await fn()))
    job.on('succeeded', () => resolve(result))
    job.on('failed', reject)
  })

export default class DemoService extends cds.ApplicationService {
  init() {
    this.on('simulateS4Event', req => this.onS4Event(req, req.data.payload))
    this.on('simulateNewOrder', async req => {
      const salesOrder = req.data.salesOrder?.trim()
      if (!salesOrder) return req.reject(400, 'Enter a sales order, e.g. SO-5005.')
      return this.onS4Event(req, await salesOrderEvent(EVENT_TYPE.created, salesOrder))
    })
    this.on('simulatePriorityChange', req => this.onPriorityChange(req))
    this.on('setScenario', req => {
      try {
        setScenario(req.data.scenario?.trim() || 'default')
      } catch (e) {
        return req.reject(400, e.message)
      }
      return getScenario()
    })
    this.on('resetDemo', req => this.onReset(req))
    return super.init()
  }

  /** Validates the envelope and runs Sales Order Intake for every item of the order. */
  async onS4Event(req, event) {
    if (!event) return req.reject(400, 'Send the event as { payload: { id, specversion, source, type, data } }.')
    const missing = ['id', 'specversion', 'source', 'type'].filter(k => !event[k])
    if (missing.length) return req.reject(400, `CloudEvents attribute missing: ${missing.join(', ')}.`)
    if (event.specversion !== '1.0') return req.reject(400, `specversion must be 1.0, got ${event.specversion}.`)
    if (!Object.values(EVENT_TYPE).includes(event.type))
      return req.reject(400, `Only ${Object.values(EVENT_TYPE).join(' and ')} are handled.`)
    const salesOrder = event.data?.SalesOrder?.trim()
    if (!salesOrder) return req.reject(400, 'data.SalesOrder is missing.')

    const results = await intakeOrder(salesOrder)
    const items = await getSalesOrderItems(salesOrder)
    return results.map((r, i) => ({
      caseId: r.caseId,
      salesOrder,
      item: items[i]?.item ?? null,
      created: r.created,
      lane: r.lane,
      status: r.status,
      laneChanged: r.laneChanged ?? false,
    }))
  }

  /** New delivery priority in the S/4 mock, then a Changed event. */
  async onPriorityChange(req) {
    const { salesOrder, item = '10', deliveryPriority = '' } = req.data
    if (!salesOrder) return req.reject(400, 'Enter a sales order, e.g. SO-5006.')
    if (!/^\d{0,2}$/.test(deliveryPriority)) return req.reject(400, 'The delivery priority is a two-digit key, e.g. 01, or blank.')
    if (!isMocked(SALES_ORDER_SERVICE))
      return req.reject(409, 'The sales order service is a real S/4HANA system: change the priority there; the app never writes to S/4HANA.')

    const s4 = await connect(SALES_ORDER_SERVICE)
    const changed = await s4.run(
      UPDATE(s4.entities.A_SalesOrderItem).set({ DeliveryPriority: deliveryPriority }).where({ SalesOrder: salesOrder, SalesOrderItem: item }),
    )
    if (!changed) return req.reject(404, `Sales order item ${salesOrder} / ${item} not found.`)
    return this.onS4Event(req, await salesOrderEvent(EVENT_TYPE.changed, salesOrder))
  }

  /**
   * Redeploys the model and the seed data (cases, audit, notifications, the
   * S/4 mocks) into the in-memory SQLite database. Runs in its own
   * transaction: the in-memory database has one connection.
   */
  async onReset(req) {
    if (cds.db?.kind !== 'sqlite') return req.reject(501, 'resetDemo only reseeds the SQLite demo database.')
    await detached(async () => {
      const csn = await cds.load('*')
      if (Object.keys(cds.services).some(name => cds.services[name]?.mocked)) cds.deploy.include_external_entities_in(csn)
      await cds.deploy(csn).to(cds.db)
    })
    setScenario('default')
    clearCache()
    const cases = await SELECT.one.from('order.conf.OrderFeasibilityCase').columns('count(1) as count')
    return { scenario: getScenario(), cases: cases.count }
  }
}

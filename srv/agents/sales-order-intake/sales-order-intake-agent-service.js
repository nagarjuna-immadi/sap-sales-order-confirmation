// SalesOrderIntakeAgentService handlers (A2; development plan 6.2).
//
// Read-only: the case as the intake stored it (case-facts.js), the product
// description and the contract clause. No prices.

import cds from '@sap/cds'
import { getCaseFacts } from '../../lib/case-facts.js'
import { getCustomer } from '../../lib/tools/order-intake.js'
import { getProduct } from '../../lib/s4/product.js'
import { fixMasking } from '../../lib/agent-masking.js'

export default class SalesOrderIntakeAgentService extends cds.ApplicationService {
  init() {
    this.after('buildMiddleware', fixMasking(this)) // plugin masking fixes (agent-masking.js)

    this.on('getOrderItem', async req => {
      const f = await getCaseFacts(String(req.data.caseId ?? '').trim())
      if (!f) return req.reject(404, `Case ${req.data.caseId} not found`)
      const [customer, product] = await Promise.all([getCustomer(f.customer), getProduct(f.material)])
      const atp = f.atpResult ?? {}
      return {
        caseId: f.caseId,
        salesOrder: f.salesOrder,
        item: f.item,
        customerId: f.customer,
        customerName: customer?.name ?? null,
        material: f.material,
        materialDescription: product?.description ?? null,
        plant: f.plant,
        quantity: f.quantity,
        quantityUnit: f.quantityUnit,
        requestedDate: f.requestedDate,
        deliveryPriority: f.deliveryPriority,
        lane: f.lane,
        penaltyRisk: !!f.penaltyRisk,
        availability: {
          requestedQty: atp.requestedQty ?? f.quantity,
          availableQty: atp.availableQty ?? null,
          availableDate: atp.availableDate ?? null,
          deliveryDate: atp.deliveryDate ?? null,
          confirmedInFull: !!atp.confirmedInFull,
        },
      }
    })

    this.on('getContractClause', async req => {
      const customerId = String(req.data.customerId ?? '').trim()
      const customer = await getCustomer(customerId)
      if (!customer) return req.reject(404, `Customer ${customerId} not found`)
      return { customerId, found: !!customer.clauseText, clauseText: customer.clauseText }
    })

    return super.init()
  }
}

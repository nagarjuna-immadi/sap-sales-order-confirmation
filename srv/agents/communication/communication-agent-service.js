// CommunicationAgentService handlers (A5; development plan 6.2).
//
// Read-only: the case, its latest CUSTOMER_DRAFT recommendation (confirmation
// or delay), the earliest date and the reject reason as communication.js reads
// them, and the customer's contract preferences. No prices.

import cds from '@sap/cds'
import { getCaseFacts, latestRecommendation } from '../../lib/case-facts.js'
import { getCustomer } from '../../lib/tools/order-intake.js'
import { getProduct } from '../../lib/s4/product.js'
import { earliestDate, lastReason } from './communication.js'
import { fixMasking } from '../../lib/agent-masking.js'

export default class CommunicationAgentService extends cds.ApplicationService {
  init() {
    this.after('buildMiddleware', fixMasking(this)) // plugin masking fixes (agent-masking.js)

    this.on('getCaseOutcome', async req => {
      const caseId = String(req.data.caseId ?? '').trim()
      const f = await getCaseFacts(caseId)
      if (!f) return req.reject(404, `Case ${caseId} not found`)
      const draft = await latestRecommendation(caseId, 'CUSTOMER_DRAFT')
      if (!draft) return req.reject(404, `Case ${caseId} is not ready for the customer yet`)
      const delay = draft.recommendedOption === 'delay'
      const product = await getProduct(f.material)
      return {
        caseId: f.caseId,
        salesOrder: f.salesOrder,
        item: f.item,
        customerId: f.customer,
        material: f.material,
        materialDescription: product?.description ?? null,
        quantity: f.quantity,
        quantityUnit: f.quantityUnit,
        requestedDate: f.requestedDate,
        draftKind: draft.recommendedOption,
        confirmedDate: delay ? null : (f.confirmedDate ?? f.requestedDate),
        confirmedQty: delay ? null : (f.confirmedQty ?? f.quantity),
        earliestDate: delay ? await earliestDate(caseId) : null,
        reason: delay ? ((await lastReason(caseId)) ?? null) : null,
      }
    })

    this.on('getCustomerPreferences', async req => {
      const customerId = String(req.data.customerId ?? '').trim()
      const customer = await getCustomer(customerId)
      if (!customer) return req.reject(404, `Customer ${customerId} not found`)
      return { customerId, customerName: customer.name, language: customer.language, tone: customer.tone }
    })

    return super.init()
  }
}

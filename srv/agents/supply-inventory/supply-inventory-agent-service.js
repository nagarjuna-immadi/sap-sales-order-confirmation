// SupplyInventoryAgentService handlers (A3; development plan 6.2).
//
// Read-only: the latest SupplyResult and SUPPLY_OPTIONS recommendation of the
// case, as supply-inventory.js stored them. Nothing is recalculated here, so
// Claude explains exactly the ranking the planner sees.

import cds from '@sap/cds'
import { getCaseFacts, latestRecommendation } from '../../lib/case-facts.js'
import { fixMasking } from '../../lib/agent-masking.js'

const { SELECT } = cds.ql

const parse = value => {
  if (value == null || value === '') return []
  try {
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    return []
  }
}

const pick = (row, keys) => Object.fromEntries(keys.map(key => [key, row[key] ?? null]))

const OPTION_KEYS = ['optionId', 'rank', 'label', 'feasible', 'reason', 'confirmedDate', 'confirmedQty', 'produceQty', 'needByDate',
  'leftoverQty', 'excessWarning', 'earliestDate', 'crId', 'chosenOption', 'productionFinishDate']

export default class SupplyInventoryAgentService extends cds.ApplicationService {
  init() {
    this.after('buildMiddleware', fixMasking(this)) // plugin masking fixes (agent-masking.js)

    this.on('getSupplyPicture', async req => {
      const caseId = String(req.data.caseId ?? '').trim()
      const f = await getCaseFacts(caseId)
      if (!f) return req.reject(404, `Case ${caseId} not found`)
      const [rec, result] = await Promise.all([
        latestRecommendation(caseId, 'SUPPLY_OPTIONS'),
        SELECT.one.from('order.conf.SupplyResult').where({ parentCase_caseId: caseId }).orderBy('createdAt desc'),
      ])
      if (!rec) return req.reject(404, `Case ${caseId} has no supply check yet`)
      return {
        ...pick(f, ['caseId', 'salesOrder', 'item', 'material', 'plant', 'quantity', 'quantityUnit', 'requestedDate', 'lane', 'status']),
        recommendedOption: rec.recommendedOption,
        options: rec.options.map(o => ({ ...pick(o, OPTION_KEYS), recommended: o.optionId === rec.recommendedOption })),
        materialTree: parse(result?.materialTree).map(n => pick(n, ['material', 'parent', 'level', 'requiredQty', 'availableQty', 'shortfallQty', 'unit'])),
        stockPerPlant: parse(result?.stockPerPlant).map(s => pick(s, ['material', 'plant', 'unrestrictedQty', 'unit'])),
        openReceipts: parse(result?.openReceipts).map(r => pick(r, ['order', 'type', 'material', 'plant', 'qty', 'date'])),
        stockFlags: parse(result?.excessFlags).map(x => pick(x, ['material', 'plant', 'daysSinceMovement', 'monthsOfSupply', 'slowMoving', 'excess'])),
      }
    })

    return super.init()
  }
}

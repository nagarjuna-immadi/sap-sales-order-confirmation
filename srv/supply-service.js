import cds from '@sap/cds'
import { registerCaseHandlers } from './lib/case-service.js'
import { actionFlags, page, registerComputedFields, textSource } from './lib/case-view.js'
import { getCaseFacts, latestRecommendation } from './lib/case-facts.js'
import { getPlanningParameters } from './lib/tools/config.js'
import { dateOf, offsetOf } from './lib/demo-clock.js'

const { SELECT } = cds.ql

// The Supply & Inventory ladder option each action carries out (plan 2.2–2.3).
const OPTION_OF = {
  confirmFromStock: 'S-LOCAL',
  approveStockTransfer: 'S-TRANSFER',
  approveReallocation: 'S-REALLOCATE',
  requestProductionCheck: 'S-PRODUCE',
  reject: 'S-REJECT',
  confirmDateToSales: 'S-CONFIRM-DATE',
}
const ACTIONS = Object.keys(OPTION_OF)

// The line of the Supply & Inventory text that holds the drafted question to
// Production (supply-inventory.js; a field of its own from phase 6).
const QUESTION = /^Production check question: (.*)$/m

const parse = value => {
  if (value == null || value === '') return null
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const keyOf = param => (param && typeof param === 'object' ? param.caseId : param)

// --- What the object page shows (plan 3) -------------------------------------------

/** The latest CR, supply picture and SUPPLY_OPTIONS recommendation of a case. */
async function latestSupply(caseId) {
  const [cr, result, recommendation] = await Promise.all([
    SELECT.one.from('order.conf.CapacityRequest').columns('crId').where({ parentCase_caseId: caseId }).orderBy('createdAt desc', 'crId desc'),
    SELECT.one.from('order.conf.SupplyResult').where({ parentCase_caseId: caseId }).orderBy('createdAt desc'),
    latestRecommendation(caseId, 'SUPPLY_OPTIONS'),
  ])
  return { cr, result, recommendation }
}

const indent = node => `${' '.repeat(node.level)}${node.level ? '└ ' : ''}${node.material}`
const list = items => (items.length ? items.join(', ') : null)

/** The stored material tree in tree order (depth first), with the other supply facts per material. */
export function treeRows(caseId, plant, unit, result) {
  if (!result) return []
  const tree = parse(result.materialTree) ?? []
  const stock = parse(result.stockPerPlant) ?? []
  const receipts = parse(result.openReceipts) ?? []
  const flags = parse(result.excessFlags) ?? []

  const ordered = []
  const seen = new Set()
  const visit = node => {
    seen.add(node)
    ordered.push(node)
    for (const child of tree) if (!seen.has(child) && child.level === node.level + 1 && child.parent === node.material) visit(child)
  }
  for (const node of tree) if (!seen.has(node) && node.level === 0) visit(node)

  return ordered.map((n, i) => {
    const otherPlants = stock.filter(s => s.material === n.material && s.plant !== plant && s.unrestrictedQty > 0)
    const ownReceipts = receipts.filter(r => r.material === n.material)
    const ownFlags = flags.filter(f => f.material === n.material && (f.slowMoving || f.excess))
    return {
      caseId,
      nodeNo: i + 1,
      level: n.level,
      material: n.material,
      materialTree: indent(n),
      parent: n.parent,
      requiredQty: n.requiredQty,
      availableQty: n.availableQty,
      shortfallQty: n.shortfallQty,
      shortfallCriticality: n.shortfallQty > 0 ? 1 : 3,
      unit: n.unit ?? unit, // the root node has the case's unit
      stockOtherPlants: otherPlants.reduce((total, s) => total + s.unrestrictedQty, 0),
      otherPlants: list(otherPlants.map(s => `${s.plant}: ${s.unrestrictedQty}`)),
      openReceiptsQty: ownReceipts.reduce((total, r) => total + r.qty, 0),
      openReceipts: list(ownReceipts.map(r => `${r.order}: ${r.qty} on ${r.date}`)),
      slowMoving: ownFlags.some(f => f.slowMoving),
      excess: ownFlags.some(f => f.excess),
      excessInfo: list(
        ownFlags.map(f =>
          [
            `${f.plant}:`,
            f.slowMoving ? `slow-moving (${f.daysSinceMovement} days)` : null,
            f.excess ? `excess (${f.monthsOfSupply} months of supply)` : null,
          ]
            .filter(Boolean)
            .join(' '),
        ),
      ),
    }
  })
}

/** The recommendation's ranked options, as stored. */
export function optionRows(caseId, recommendation) {
  return (recommendation?.options ?? []).map(o => {
    const recommended = o.optionId === recommendation.recommendedOption
    return {
      caseId,
      optionId: o.optionId,
      rank: o.rank,
      label: o.label,
      feasible: !!o.feasible,
      reason: o.reason ?? null,
      recommended,
      criticality: recommended ? 3 : o.feasible ? 0 : 1,
      confirmedDate: o.confirmedDate ?? null,
      confirmedQty: o.confirmedQty ?? null,
    }
  })
}

/** Fills the requested virtual fields and lists of Cases rows. */
async function fillCases(rows, requested) {
  const needsSupply = ['activeCrId', 'dataSource', 'dataSourceCriticality', 'recommendedOption', 'recommendedOptionLabel',
    'recommendationRationale', 'rationaleSource', 'productionCheckQuestion', 'excessWarning', 'supplyTree', 'supplyOptions'].some(n => requested.has(n))
  for (const row of rows) {
    for (const [name, value] of Object.entries(actionFlags(row.status_code, ACTIONS))) if (requested.has(name)) row[name] = value
    if (requested.has('summarySource')) row.summarySource = textSource(await latestRecommendation(row.caseId, 'CASE_SUMMARY'))
    if (!needsSupply) continue

    const { cr, result, recommendation } = await latestSupply(row.caseId)
    const recommended = recommendation?.options.find(o => o.optionId === recommendation.recommendedOption)
    const atpSource = result ? null : parse((await SELECT.one.from('order.conf.OrderFeasibilityCase').columns('atpResult').where({ caseId: row.caseId }))?.atpResult)?.source
    const source = result?.source ?? atpSource ?? null
    const values = {
      activeCrId: cr?.crId ?? null,
      dataSource: source,
      dataSourceCriticality: source === 's4' ? 3 : 0,
      recommendedOption: recommendation?.recommendedOption ?? null,
      recommendedOptionLabel: recommended?.label ?? null,
      recommendationRationale: recommendation?.rationale ?? null,
      rationaleSource: textSource(recommendation),
      productionCheckQuestion: recommended?.optionId === 'S-PRODUCE' ? (QUESTION.exec(recommendation.rationale ?? '')?.[1] ?? null) : null,
      excessWarning: result ? !!result.excessWarning : null,
    }
    for (const [name, value] of Object.entries(values)) if (requested.has(name)) row[name] = value
    if (requested.has('supplyTree')) row.supplyTree = treeRows(row.caseId, row.plant, row.quantityUnit, result)
    if (requested.has('supplyOptions')) row.supplyOptions = optionRows(row.caseId, recommendation)
  }
}

export default class SupplyPlanningService extends cds.ApplicationService {
  init() {
    const { Cases, SupplyTreeNodes, SupplyOptions } = this.entities

    // Numbers for the action come from the agent's tools, not from the user:
    // confirmed date and quantity, the CR's need-by date and quantity. The
    // recommendation shown is linked to the audit row (accepted or not).
    this.before(ACTIONS, Cases, async req => {
      const caseId = keyOf(req.params.at(-1))
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

    registerComputedFields(this, Cases, {
      inputs: ['caseId', 'status_code', 'plant', 'quantityUnit'],
      lists: ['supplyTree', 'supplyOptions'],
      fill: fillCases,
    })

    // Cases('FC-0001')/supplyTree and /supplyOptions. Reading the case through
    // this service applies the role's read rule (rule 8): not visible, no rows.
    this.on('READ', [SupplyTreeNodes, SupplyOptions], async req => {
      const caseId = req.params.length ? keyOf(req.params[0]) : null
      const caseRow = caseId && (await this.run(SELECT.one.from(Cases).columns('caseId', 'plant', 'quantityUnit').where({ caseId })))
      if (!caseRow) return page([], req.query)
      const { result, recommendation } = await latestSupply(caseId)
      const rows = req.target === SupplyTreeNodes ? treeRows(caseId, caseRow.plant, caseRow.quantityUnit, result) : optionRows(caseId, recommendation)
      return page(rows, req.query)
    })

    registerCaseHandlers(this, {
      role: 'SupplyPlanner',
      actions: Object.fromEntries(ACTIONS.map(action => [action, 'Cases'])),
      order: { Cases: ['laneRank', 'requestedDate'], CaseTimeline: ['at'], Notifications: ['createdAt desc'] },
    })
    return super.init()
  }
}

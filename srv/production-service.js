import cds from '@sap/cds'
import { registerCaseHandlers } from './lib/case-service.js'
import { actionFlags, page, registerComputedFields } from './lib/case-view.js'
import { getCapacityRequest, latestRecommendation } from './lib/case-facts.js'
import { getPlanningParameters } from './lib/tools/config.js'
import { label } from './lib/demo-clock.js'

const { SELECT } = cds.ql

const ACTIONS = ['chooseOption', 'chooseOverrideOption', 'rejectProduction']

const keyOf = param => (param && typeof param === 'object' ? param.crId : param)

// --- What the object page shows (plan 4) -------------------------------------------

/** The CR's options (with the load rows) and its latest CAPACITY_OPTIONS recommendation. */
async function capacityOf(crId) {
  const cr = await getCapacityRequest(crId)
  if (!cr) return { cr: null, options: [], recommendation: null }
  const recommendation = await latestRecommendation(cr.parentCase_caseId, 'CAPACITY_OPTIONS', crId)
  // best score first, as A4 ranks them
  const options = cr.options.slice().sort((a, b) => a.score - b.score)
  return { cr, options, recommendation }
}

const movedText = o => o.movedOrders.map(m => `${m.salesOrder ?? m.order} ${m.fromDate} → ${m.toDate}`).join(', ') || 'None'

/** One row per option, best score first; the recommended one is "Suggested by agent". */
export function optionRows(crId, options, recommendedOption) {
  return options.map((o, i) => {
    const recommended = o.optionId === recommendedOption
    return {
      crId,
      optionId: o.optionId,
      rank: i + 1,
      label: o.label,
      productionVersion: o.productionVersion ?? null,
      feasible: !!o.feasible,
      infeasibleReason: o.infeasibleReason ?? null,
      feasibility: o.feasible ? 'Yes' : `No: ${o.infeasibleReason}`,
      feasibilityCriticality: o.feasible ? 0 : 1,
      score: o.score,
      needsOverride: !!o.needsOverride,
      finishDate: o.finishDate ?? null,
      movedOrders: movedText(o),
      peakUtilization: o.metrics?.peakUtilization ?? null,
      frozenHorizonViolations: o.metrics?.frozenHorizonViolations ?? 0,
      recommended,
      suggestion: recommended ? 'Suggested by agent' : null,
      suggestionCriticality: recommended ? 3 : 0,
      criticality: recommended ? 3 : !o.feasible ? 1 : o.needsOverride ? 2 : 0,
    }
  })
}

/** The other orders each option moves. */
export function movedOrderRows(crId, options) {
  return options.flatMap(o =>
    o.movedOrders.map(m => {
      const onTime = !m.daysLate
      return {
        crId,
        optionId: o.optionId,
        order: m.order,
        salesOrder: m.salesOrder ?? null,
        workCenter: m.workCenter,
        qty: m.qty,
        fromDate: m.fromDate,
        toDate: m.toDate,
        dueDate: m.dueDate ?? null,
        daysLate: m.daysLate ?? 0,
        insideFrozenHorizon: !!m.insideFrozenHorizon,
        onTime,
        criticality: !onTime ? 1 : m.insideFrozenHorizon ? 2 : 3,
      }
    }),
  )
}

/** Load before and after per option, work center and day; days up to D+frozenHorizonDays are frozen. */
export function loadRows(crId, options, frozenHorizonDays) {
  return options.flatMap(o =>
    o.loadAfter.map(after => {
      const before = o.loadBefore.find(b => b.workCenter === after.workCenter && b.dayOffset === after.dayOffset)
      const frozen = after.dayOffset <= frozenHorizonDays
      return {
        crId,
        optionId: o.optionId,
        workCenter: after.workCenter,
        dayOffset: after.dayOffset,
        date: after.date,
        dayLabel: `${label(after.dayOffset)}${frozen ? ' frozen' : ''}`,
        frozen,
        availableCapacity: after.availableCapacity,
        requirementBefore: before?.requirement ?? null,
        requirementAfter: after.requirement,
        utilizationBefore: before?.utilizationPercent ?? null,
        utilizationAfter: after.utilizationPercent,
      }
    }),
  )
}

const frozenDaysOf = async plant => (plant ? (await getPlanningParameters(plant)).frozenHorizonDays : 0)

/** Fills the requested virtual fields and lists of CapacityRequests rows. */
async function fillRequests(rows, requested) {
  for (const row of rows) {
    const { cr, options, recommendation } = await capacityOf(row.crId)
    const open = cr?.status === 'OPEN'
    const flags = actionFlags(row.caseStatus, ACTIONS)
    const recommended = options.find(o => o.optionId === recommendation?.recommendedOption)
    const override = options.find(o => o.needsOverride && o.feasible) ?? options.find(o => o.needsOverride)
    const frozenDays = requested.has('frozenHorizon') || requested.has('loadRows') ? await frozenDaysOf(row.plant) : 0
    const values = {
      recommendedOption: recommendation?.recommendedOption ?? null,
      recommendedOptionLabel: recommended?.label ?? null,
      overrideOption: override?.optionId ?? null,
      comparison: recommendation?.rationale ?? null,
      frozenHorizon: `D+0 … ${label(frozenDays)}`,
      canChooseOption: open && flags.canChooseOption && options.some(o => !o.needsOverride),
      canChooseOverrideOption: open && flags.canChooseOverrideOption && !!override,
      canRejectProduction: open && flags.canRejectProduction,
    }
    for (const [name, value] of Object.entries(values)) if (requested.has(name)) row[name] = value
    if (requested.has('capacityOptions')) row.capacityOptions = optionRows(row.crId, options, recommendation?.recommendedOption)
    if (requested.has('movedOrders')) row.movedOrders = movedOrderRows(row.crId, options)
    if (requested.has('loadRows')) row.loadRows = loadRows(row.crId, options, frozenDays)
  }
}

/** { property: value } of the plain `property = value` conditions of a where clause (the value list's filters). */
function equalities(where = []) {
  const result = {}
  for (let i = 0; i + 2 < where.length; i++) {
    const [left, op, right] = where.slice(i, i + 3)
    if (op === '=' && left?.ref && right && 'val' in right) result[left.ref.at(-1)] = right.val
  }
  return result
}

export default class ProductionService extends cds.ApplicationService {
  init() {
    const { CapacityRequests, CapacityOptions, MovedOrders, OptionLoad } = this.entities

    // Links the capacity options shown to the decision's audit row. The
    // orchestrator marks it accepted when the chosen option is the recommended one.
    this.before(ACTIONS, CapacityRequests, async req => {
      const crId = keyOf(req.params.at(-1))
      const cr = await SELECT.one.from('order.conf.CapacityRequest').columns('parentCase_caseId').where({ crId })
      const rec = cr && (await latestRecommendation(cr.parentCase_caseId, 'CAPACITY_OPTIONS', crId))
      if (!rec) return
      req.data.recommendationId = rec.ID
      if (req.event === 'rejectProduction') req.data.recommendationAccepted = !rec.recommendedOption
    })

    registerComputedFields(this, CapacityRequests, {
      inputs: ['crId', 'caseStatus', 'plant'],
      lists: ['capacityOptions', 'movedOrders', 'loadRows'],
      fill: fillRequests,
    })

    // CapacityRequests('CR-0001')/capacityOptions, /movedOrders and /loadRows.
    // Reading the CR through this service applies the role's read rule (rule 8):
    // not visible, no rows. CapacityOptions without a CR is the value list of
    // the choose actions: the options of the OPEN CRs, filtered by crId,
    // optionId and needsOverride when the client asks.
    this.on('READ', [CapacityOptions, MovedOrders, OptionLoad], async req => {
      const crId = req.params.length ? keyOf(req.params[0]) : null
      if (!crId && req.target !== CapacityOptions) return page([], req.query)
      const filter = equalities(req.query.SELECT.where)
      const visible = await this.run(
        SELECT.from(CapacityRequests).columns('crId', 'plant').where(crId ? { crId } : { status_code: 'OPEN', ...(filter.crId && { crId: filter.crId }) }),
      )
      const rows = []
      for (const cr of visible) {
        const { options, recommendation } = await capacityOf(cr.crId)
        if (req.target === CapacityOptions) rows.push(...optionRows(cr.crId, options, recommendation?.recommendedOption))
        else if (req.target === MovedOrders) rows.push(...movedOrderRows(cr.crId, options))
        else rows.push(...loadRows(cr.crId, options, await frozenDaysOf(cr.plant)))
      }
      const matching = rows.filter(row => Object.entries(filter).every(([name, value]) => row[name] === value))
      return page(matching, req.query)
    })

    registerCaseHandlers(this, {
      role: 'ProductionPlanner',
      actions: {
        chooseOption: 'CapacityRequests',
        chooseOverrideOption: 'CapacityRequests',
        rejectProduction: 'CapacityRequests',
      },
      order: {
        CapacityRequests: ['laneRank', 'needByDate'],
        Cases: ['laneRank', 'requestedDate'],
        CaseTimeline: ['at'],
        Notifications: ['createdAt desc'],
      },
    })
    return super.init()
  }
}

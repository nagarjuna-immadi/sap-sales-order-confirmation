// OrderAssistantService handlers (blueprint §6.2, development plan 7.1).
//
// Read-only. Every read is limited to the cases the user may see (rule 8,
// srv/lib/case-access.js): the projections get the read rule as a filter, the
// functions check canRead and answer "not found" otherwise. The functions
// return the facts for Claude and send the data cards and deep links to the
// app (cards.js). No import from another agent's folder (ESLint rule): shared
// code is in srv/lib/.
//
// Agent setup on top of the plugin's defaults:
// - fixMasking: plugin masking fixes (agent-masking.js), also for the query tool;
// - cardsMiddleware: lets the functions publish cards (cards.js);
// - answerCheck: the number check of the final answer (answer-check.js);
// - no emit_data_part: cards come from CAP only, never from Claude.
// The runs are in the plugin's cap.agent.Tasks (agentService = OrderAssistantService).

import cds from '@sap/cds'
import { canRead, scopeOf } from '../../lib/case-access.js'
import { getCaseFacts, getCapacityRequest } from '../../lib/case-facts.js'
import { getSupplyPicture, getCapacityOptions } from '../../lib/case-snapshots.js'
import { addDurations, requestedDurations } from '../../lib/case-timeline.js'
import { allowedActions } from '../../lib/case-view.js'
import { CASE_APPS } from '../../lib/deep-links.js'
import { dateOf, today } from '../../lib/demo-clock.js'
import { getSalesOrderItems } from '../../lib/s4/sales-order.js'
import { laneOf } from '../../lib/tools/config.js'
import { fixMasking } from '../../lib/agent-masking.js'
import { answerCheck } from './answer-check.js'
import {
  CASE_ROLES,
  TEAMS,
  cardsMiddleware,
  inAgentRun,
  sendCards,
  casesCard,
  caseCard,
  caseLinks,
  supplyOptionsCard,
  materialTreeCard,
  capacityOptionsCard,
  salesOrderCard,
} from './cards.js'

const { SELECT } = cds.ql

const DB = {
  Cases: 'order.conf.OrderFeasibilityCase',
  CapacityRequests: 'order.conf.CapacityRequest',
  Recommendations: 'order.conf.Recommendation',
  CaseTimeline: 'order.conf.CaseTimeline',
  CaseStatus: 'order.conf.CaseStatus',
  Customers: 'order.conf.Customers',
}

// The buttons of the case apps (annotations.cds and the custom actions).
const ACTION_LABELS = {
  confirmFromStock: 'Confirm from Stock',
  approveStockTransfer: 'Approve Stock Transfer',
  approveReallocation: 'Approve Reallocation',
  requestProductionCheck: 'Request Production Check',
  reject: 'Reject',
  confirmDateToSales: 'Confirm Date to Sales',
  chooseOption: 'Choose Option',
  chooseOverrideOption: 'Choose Override Option',
  rejectProduction: 'Reject',
  confirmToCustomer: 'Confirm to Customer',
  close: 'Close',
}

const TIMELINE_INPUTS = ['at', 'previousAt', 'outcome']

// Cases in the table card of a case list
const MAX_LISTED_CASES = 10

const parse = value => {
  if (value == null || value === '') return null
  try {
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    return null
  }
}

const notFound = (req, what) => req.reject(404, `${what} not found`)

/** The case with what canRead needs, or null when it does not exist or the user may not see it. */
async function readableCase(user, caseId) {
  const f = caseId && (await getCaseFacts(caseId))
  if (!f) return null
  const latestCr = await SELECT.one.from(DB.CapacityRequests).columns('crId').where({ parentCase_caseId: caseId }).orderBy('createdAt desc')
  const caseRow = { status_code: f.status, hasCapacityRequest: !!latestCr }
  return canRead(user, caseRow) ? { f, caseRow, latestCrId: latestCr?.crId ?? null } : null
}

/** The link to the first case app in which the user may open the case (for table rows). */
async function firstLink(user, caseId) {
  const found = await readableCase(user, caseId)
  return found && caseLinks(user, found.caseRow, { caseId, crId: found.latestCrId })[0]
}

/** Monday and Sunday of this week (YYYY-MM-DD). */
function thisWeek() {
  const weekday = (new Date(`${today()}T00:00:00Z`).getUTCDay() + 6) % 7 // Monday 0
  return { weekStart: dateOf(-weekday), weekEnd: dateOf(6 - weekday) }
}

export default class OrderAssistantService extends cds.ApplicationService {
  init() {
    this.after('buildMiddleware', fixMasking(this))
    this.after('buildMiddleware', middleware => {
      if (Array.isArray(middleware)) middleware.push(cardsMiddleware(), answerCheck(this))
    })
    this.after('buildTools', tools => {
      const i = Array.isArray(tools) ? tools.findIndex(t => t?.name === 'emit_data_part') : -1
      if (i >= 0) tools.splice(i, 1)
    })

    // --- Projections: the read rule on every entity (rule 8) ---------------------------

    for (const entity of Object.values(this.entities)) {
      this.before('READ', entity, req => {
        const scope = scopeOf(req.user)
        if (scope) req.query.where({ caseId: { in: SELECT('caseId').from(DB.Cases).where(scope) } })
      })
    }

    // The timeline's durations, as in the case services (case-service.js)
    const durations = new WeakMap()
    this.before('READ', 'CaseTimeline', req => {
      durations.set(req, requestedDurations(req.query))
      const { columns } = req.query.SELECT
      if (columns && !columns.some(c => c === '*')) {
        for (const name of TIMELINE_INPUTS) if (!columns.some(c => c.ref?.[0] === name && !c.as)) columns.push({ ref: [name] })
      }
    })
    this.after('READ', 'CaseTimeline', (result, req) => addDurations(result, durations.get(req)))

    // A case list from the query tool also goes to the app, as a table card
    this.after('READ', 'Cases', async (result, req) => {
      const ids = [result ?? []].flat().map(r => r?.caseId).filter(Boolean)
      if (!ids.length || !inAgentRun()) return
      const rows = await SELECT.from(DB.Cases)
        .columns('caseId', 'salesOrder', 'item', 'lane_code', 'status_code', 'waitingForRole', 'requestedDate', 'penaltyRisk')
        .where({ caseId: { in: ids.slice(0, MAX_LISTED_CASES) } })
        .orderBy('laneRank', 'requestedDate', 'caseId')
      for (const row of rows) row.intent = (await firstLink(req.user, row.caseId))?.intent
      sendCards([casesCard(rows, ids.length)])
    })

    // --- Functions ---------------------------------------------------------------------

    this.on('getMyContext', req => {
      const roles = CASE_ROLES.filter(role => req.user.is(role))
      return { roles, caseApps: roles.map(role => CASE_APPS[role].app), today: today(), ...thisWeek() }
    })

    this.on('getCase', async req => {
      const caseId = String(req.data.caseId ?? '').trim()
      const found = await readableCase(req.user, caseId)
      if (!found) return notFound(req, `Case ${caseId}`)
      const { f, caseRow, latestCrId } = found

      const [statusRow, customer, crs, recs, trail] = await Promise.all([
        SELECT.one.from(DB.CaseStatus).columns('name').where({ code: f.status }),
        SELECT.one.from(DB.Customers).columns('name').where({ ID: f.customer }),
        SELECT.from(DB.CapacityRequests).where({ parentCase_caseId: caseId }).orderBy('createdAt desc'),
        SELECT.from(DB.Recommendations)
          .columns('agent', 'kind_code', 'capacityRequest_crId', 'recommendedOption', 'rationale', 'accepted', 'createdAt')
          .where({ parentCase_caseId: caseId, kind_code: { in: ['SUPPLY_OPTIONS', 'CAPACITY_OPTIONS'] } })
          .orderBy('createdAt desc'),
        SELECT.from(DB.CaseTimeline).where({ caseId }).orderBy('at'),
      ])
      addDurations(trail)

      // the latest recommendation per kind and capacity request
      const latest = new Map()
      for (const r of recs) {
        const key = `${r.kind_code}:${r.capacityRequest_crId ?? ''}`
        if (!latest.has(key)) latest.set(key, r)
      }
      const statusText = statusRow?.name ?? f.status
      const waitingSince = trail.filter(t => t.outcome === 'DONE' && t.toStatus === f.status && t.fromStatus !== t.toStatus).at(-1)?.at ?? f.createdAt
      const links = caseLinks(req.user, caseRow, { caseId, crId: latestCrId })

      const details = {
        caseId,
        salesOrder: f.salesOrder,
        item: f.item,
        customerId: f.customer,
        customerName: customer?.name ?? null,
        material: f.material,
        plant: f.plant,
        quantity: f.quantity,
        quantityUnit: f.quantityUnit,
        requestedDate: f.requestedDate,
        lane: f.lane,
        status: f.status,
        statusText,
        waitingForRole: f.waitingForRole ?? null,
        waitingFor: TEAMS[f.waitingForRole] ?? null,
        waitingSince,
        penaltyRisk: !!f.penaltyRisk,
        penaltyRule: f.penaltyRule ?? null,
        confirmedDate: f.confirmedDate ?? null,
        confirmedQty: f.confirmedQty,
        nextActions: allowedActions(f.status).map(a => ({ ...a, label: ACTION_LABELS[a.action] ?? a.action, app: CASE_APPS[a.role]?.app ?? null })),
        capacityRequests: crs.map(cr => {
          const options = parse(cr.options) ?? []
          return {
            crId: cr.crId,
            status: cr.status_code,
            needByDate: cr.needByDate,
            quantity: cr.quantity == null ? null : Number(cr.quantity),
            optionCount: options.length,
            feasibleOptionCount: options.filter(o => o.feasible).length,
            recommendedOption: latest.get(`CAPACITY_OPTIONS:${cr.crId}`)?.recommendedOption ?? null,
            chosenOption: cr.chosenOption ?? null,
            overrideUsed: !!cr.overrideUsed,
            requestedAt: cr.createdAt,
            decidedAt: cr.decidedAt ?? null,
          }
        }),
        recommendations: [...latest.values()].map(r => ({
          agent: r.agent,
          kind: r.kind_code,
          crId: r.capacityRequest_crId ?? null,
          recommendedOption: r.recommendedOption,
          rationale: r.rationale,
          accepted: r.accepted,
          suggestedAt: r.createdAt,
        })),
        decisionTrail: trail.map(t => ({
          at: t.at,
          step: t.step,
          action: t.action,
          role: t.role,
          crId: t.capacityRequest_crId ?? null,
          fromStatus: t.fromStatus,
          toStatus: t.toStatus,
          outcome: t.outcome,
          refusalCode: t.refusalCode ?? null,
          chosenOption: parse(t.payload)?.chosenOption ?? null,
          comment: t.comment ?? null,
          reason: t.reason ?? null,
          durationText: t.durationText,
        })),
        openIn: links.map(l => l.app),
      }
      sendCards([caseCard(f, statusText), ...links])
      return details
    })

    this.on('getSupplyPicture', async req => {
      const caseId = String(req.data.caseId ?? '').trim()
      const found = await readableCase(req.user, caseId)
      if (!found) return notFound(req, `Case ${caseId}`)
      const picture = await getSupplyPicture(found.f)
      if (!picture) return req.reject(404, `Case ${caseId} has no supply check yet`)
      sendCards([supplyOptionsCard(picture), materialTreeCard(picture), ...caseLinks(req.user, found.caseRow, { caseId, crId: found.latestCrId })])
      return picture
    })

    this.on('getCapacityOptions', async req => {
      const crId = String(req.data.crId ?? '').trim()
      const cr = await getCapacityRequest(crId)
      const found = cr && (await readableCase(req.user, cr.parentCase_caseId))
      if (!found) return notFound(req, `Capacity request ${crId}`)
      const result = await getCapacityOptions(cr, found.f)
      sendCards([capacityOptionsCard(result), ...caseLinks(req.user, found.caseRow, { caseId: found.f.caseId, crId })])
      return result
    })

    this.on('getSalesOrder', async req => {
      const salesOrder = String(req.data.salesOrder ?? '').trim()
      const items = salesOrder ? await getSalesOrderItems(salesOrder) : []
      const cases = items.length ? await SELECT.from(DB.Cases).columns('caseId', 'item').where({ salesOrder }) : []
      const readable = new Map()
      for (const c of cases) {
        const found = await readableCase(req.user, c.caseId)
        if (found) readable.set(c.item, found)
      }
      // Sales sees every order; the planners only orders with a case they may see (rule 8)
      if (!items.length || (!req.user.is('Sales') && !readable.size)) return notFound(req, `Sales order ${salesOrder}`)
      const order = {
        salesOrder,
        customerId: items[0].customer,
        source: items[0].source,
        items: await Promise.all(
          items.map(async i => ({
            item: i.item,
            material: i.material,
            plant: i.plant,
            quantity: i.quantity,
            quantityUnit: i.quantityUnit,
            requestedDate: i.requestedDate,
            confirmedDate: i.confirmedDate,
            confirmedQty: i.confirmedQty,
            deliveryPriority: i.deliveryPriority,
            lane: await laneOf(i.deliveryPriority),
            caseId: readable.get(i.item)?.f.caseId ?? null,
            caseStatus: readable.get(i.item)?.f.status ?? null,
          })),
        ),
      }
      const links = new Map([...readable.values()].map(({ f, caseRow, latestCrId }) => [f.caseId, caseLinks(req.user, caseRow, { caseId: f.caseId, crId: latestCrId })]))
      const intents = Object.fromEntries([...links].map(([caseId, l]) => [caseId, l[0]?.intent]))
      sendCards([salesOrderCard(order, intents), ...[...links.values()].flat()])
      return order
    })

    return super.init()
  }
}

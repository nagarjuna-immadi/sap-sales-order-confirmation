// Data cards and deep links of the Order Assistant (blueprint §6.2,
// development plan 7.1). Built in CAP from the function results, never from
// LLM text, and sent to the app as A2A data artifacts next to the answer.
//
// How they get there (spike 7.0): the plugin turns a function result into
// TOON text for Claude, so a {"kind":"data"} object in the result never
// reaches the client, and the function handler runs in a CAP context of its
// own without the plugin's event bus. cardsMiddleware() wraps every tool call
// and keeps the plugin's context in an AsyncLocalStorage; sendCards(), called
// by a function handler, publishes the cards on that context's event bus as
// one artifact-update "data-card-<uuid>", once, in the task that produced
// them. Claude never sees the cards; the answer text refers to them.
//
// Card shapes (data of each part), read by app/order-assistant:
//   { card: 'case', key, caseId, salesOrder, item, material, quantity, quantityUnit,
//     lane, status, statusText, waitingFor, requestedDate, confirmedDate, penaltyRisk }
//   { card: 'table', key, title, columns: [{ label, align }],
//     rows: [{ cells: [text | { text, state }], highlight, intent }] }   intent: the row opens a case
//   { card: 'link', key, label, app, intent }      intent: '#FeasibilityCase-track?caseId=FC-0001'
// key identifies a card within an answer: the app shows a card once even when
// Claude calls a function twice.

import cds from '@sap/cds'
import { AsyncLocalStorage } from 'node:async_hooks'
import { canRead } from '../../lib/case-access.js'
import { CASE_APPS } from '../../lib/deep-links.js'

const LOG = cds.log('order-assistant')
const turn = new AsyncLocalStorage()

export const CASE_ROLES = Object.keys(CASE_APPS)

// The team each role stands for, as the case apps name it.
export const TEAMS = Object.freeze({
  Sales: 'Sales',
  SupplyPlanner: 'Supply Chain Planning',
  ProductionPlanner: 'Production Planning',
})

/** Middleware for the agent: makes the plugin's context available to sendCards(). */
export function cardsMiddleware() {
  return {
    name: 'orderAssistantCards',
    wrapToolCall: (request, handler) => turn.run({ context: cds.context }, () => handler(request)),
  }
}

/** True inside a tool call of an agent run, where sendCards() reaches the app. */
export const inAgentRun = () => !!turn.getStore()?.context?.['agent.eventBus']

/** Sends cards to the app of the running task. No-op outside an agent run (e.g. srv.send in a test script). */
export function sendCards(cards) {
  const context = turn.getStore()?.context
  const eventBus = context?.['agent.eventBus']
  const parts = cards.filter(Boolean).map(data => ({ kind: 'data', data }))
  if (!eventBus || !parts.length) return
  LOG.debug('cards', parts.map(p => p.data.key))
  eventBus.publish({
    kind: 'artifact-update',
    taskId: context['agent.task.id'],
    contextId: context['agent.context.id'],
    artifact: { artifactId: `data-card-${cds.utils.uuid()}`, name: 'cards', parts },
  })
}

// --- Builders ---------------------------------------------------------------------

const yesNo = value => (value ? 'Yes' : 'No')
const text = value => (value == null || value === '' ? '' : String(value))
const qty = (value, unit) => (value == null ? '' : `${value}${unit ? ` ${unit}` : ''}`)
const percent = value => (value == null ? '' : `${value}%`)

/** The case header card. f: the case from getCaseFacts(), plus statusText. */
export function caseCard(f, statusText) {
  return {
    card: 'case',
    key: `case:${f.caseId}`,
    caseId: f.caseId,
    salesOrder: f.salesOrder,
    item: f.item,
    material: f.material,
    quantity: f.quantity,
    quantityUnit: f.quantityUnit,
    lane: f.lane,
    status: f.status,
    statusText: statusText ?? f.status,
    waitingFor: TEAMS[f.waitingForRole] ?? null,
    requestedDate: f.requestedDate,
    confirmedDate: f.confirmedDate ?? null,
    penaltyRisk: !!f.penaltyRisk,
  }
}

/**
 * The deep links to the case apps in which the user may open the case: one per
 * role of the user that may read it (rule 8). Production opens the capacity
 * request, so it needs crId (the active one). caseRow: what canRead needs.
 */
export function caseLinks(user, caseRow, { caseId, crId }) {
  return CASE_ROLES.filter(role => user.is(role) && canRead(user, caseRow, [role]))
    .map(role => ({ role, app: CASE_APPS[role].app, intent: CASE_APPS[role].link({ caseId, crId }) }))
    .filter(l => l.intent)
    .map(({ role, app, intent }) => ({
      card: 'link',
      key: `link:${intent}`,
      label: `Open ${role === 'ProductionPlanner' ? crId : caseId} in ${app}`,
      app,
      intent,
    }))
}

/**
 * Table card of a list of cases (a query on Cases). rows: db cases with
 * intent, the link to the user's case app (caseLinks); total: all matches.
 */
export function casesCard(rows, total) {
  return {
    card: 'table',
    key: `cases:${rows.map(r => r.caseId).join(',')}`,
    title: total > rows.length ? `Cases (${rows.length} of ${total})` : 'Cases',
    columns: [{ label: 'Case' }, { label: 'Sales order' }, { label: 'Lane' }, { label: 'Status' }, { label: 'Waiting for' }, { label: 'Requested' }, { label: 'Penalty risk' }],
    rows: rows.map(r => ({
      intent: r.intent,
      cells: [
        r.caseId,
        `${r.salesOrder}/${r.item}`,
        r.lane_code === 'HIGH' ? { text: r.lane_code, state: 'Error' } : text(r.lane_code),
        text(r.status_code),
        text(TEAMS[r.waitingForRole]),
        text(r.requestedDate),
        r.penaltyRisk ? { text: 'Yes', state: 'Warning' } : 'No',
      ],
    })),
  }
}

/** Table card of the ranked supply options. picture: snapshots.SupplyPicture */
export function supplyOptionsCard(picture) {
  return {
    card: 'table',
    key: `supply-options:${picture.caseId}`,
    title: `Supply options for ${picture.caseId}`,
    columns: [{ label: 'Rank', align: 'End' }, { label: 'Option' }, { label: 'Feasible' }, { label: 'Confirmed date' }, { label: 'Note' }],
    rows: picture.options.map(o => ({
      highlight: o.recommended,
      cells: [
        text(o.rank),
        o.recommended ? `${o.optionId} (recommended)` : o.optionId,
        { text: yesNo(o.feasible), state: o.feasible ? 'Success' : 'None' },
        text(o.confirmedDate ?? o.earliestDate),
        text(o.reason ?? o.label),
      ],
    })),
  }
}

/** Table card of the bill of materials netted against stock. */
export function materialTreeCard(picture) {
  if (!picture.materialTree.length) return null
  return {
    card: 'table',
    key: `material-tree:${picture.caseId}`,
    title: `Material tree for ${picture.caseId} (plant ${picture.plant})`,
    columns: [{ label: 'Material' }, { label: 'Level', align: 'End' }, { label: 'Required', align: 'End' }, { label: 'Available', align: 'End' }, { label: 'Shortfall', align: 'End' }],
    rows: picture.materialTree.map(n => ({
      cells: [
        n.material,
        text(n.level),
        qty(n.requiredQty, n.unit),
        qty(n.availableQty, n.unit),
        n.shortfallQty > 0 ? { text: qty(n.shortfallQty, n.unit), state: 'Error' } : qty(n.shortfallQty, n.unit),
      ],
    })),
  }
}

/** Table card of the scored capacity options. result: snapshots.CapacityOptions */
export function capacityOptionsCard(result) {
  return {
    card: 'table',
    key: `capacity-options:${result.crId}`,
    title: `Capacity options for ${result.crId} (${qty(result.quantity, result.quantityUnit)} ${result.material} by ${result.needByDate})`,
    columns: [
      { label: 'Option' },
      { label: 'Finishes' },
      { label: 'Feasible' },
      { label: 'Score', align: 'End' },
      { label: 'Peak load', align: 'End' },
      { label: 'Override' },
      { label: 'Moved orders' },
    ],
    rows: result.options.map(o => ({
      highlight: o.recommended,
      cells: [
        o.recommended ? `${o.optionId} (recommended)` : o.optionId,
        text(o.finishDate),
        { text: yesNo(o.feasible), state: o.feasible ? 'Success' : 'Error' },
        text(o.score),
        percent(o.metrics?.peakUtilization),
        o.needsOverride ? { text: 'Needs override', state: 'Warning' } : 'No',
        o.movedOrders.map(m => `${m.salesOrder || m.order} ${m.fromDate} → ${m.toDate}`).join(', '),
      ],
    })),
  }
}

/** Table card of a sales order's items. order: the getSalesOrder result; intents: caseId → link to the user's case app */
export function salesOrderCard(order, intents = {}) {
  return {
    card: 'table',
    key: `sales-order:${order.salesOrder}`,
    title: `Sales order ${order.salesOrder}`,
    columns: [
      { label: 'Item', align: 'End' },
      { label: 'Material' },
      { label: 'Quantity', align: 'End' },
      { label: 'Requested' },
      { label: 'Lane' },
      { label: 'Case' },
      { label: 'Case status' },
    ],
    rows: order.items.map(i => ({
      intent: intents[i.caseId],
      cells: [i.item, i.material, qty(i.quantity, i.quantityUnit), text(i.requestedDate), text(i.lane), text(i.caseId), text(i.caseStatus)],
    })),
  }
}

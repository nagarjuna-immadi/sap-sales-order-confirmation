// Configuration the tools read (development plan 1.1 and 2.0): planning
// parameters and scoring weights per plant, the delivery priority → lane
// mapping and the lane ranks. Small tables, read on every call (they are
// demo data that resetDemo reseeds; no cache).

import cds from '@sap/cds'
import { mapLane } from '../../agents/feasibility-case-orchestrator/case-rules.js'
import { num } from '../s4/connection.js'

const { SELECT } = cds.ql

const DB = {
  PlanningParameters: 'order.conf.PlanningParameters',
  ScoringWeights: 'order.conf.ScoringWeights',
  DeliveryPriorityLane: 'order.conf.DeliveryPriorityLane',
  Lanes: 'order.conf.Lanes',
}

// Capacity load is known for D+1 … D+5 (§8.2, CapacityLoad). Simulations and
// the earliest date look only inside this window.
export const PLANNING_WINDOW = Object.freeze({ from: 1, to: 5 })

const missing = (what, plant) => cds.error(`No ${what} for plant ${plant}`, { status: 500, code: 'CONFIG_MISSING' })

/** { plant, frozenHorizonDays, excessThresholdDays, slowMovingAfterDays, shippingLeadDays } */
export async function getPlanningParameters(plant) {
  const row = await SELECT.one.from(DB.PlanningParameters).where({ plant })
  if (!row) throw missing('planning parameters', plant)
  return row
}

/** { w1 … w6 } as numbers (§7 A4). */
export async function getScoringWeights(plant) {
  const row = await SELECT.one.from(DB.ScoringWeights).where({ plant })
  if (!row) throw missing('scoring weights', plant)
  return Object.fromEntries(['w1', 'w2', 'w3', 'w4', 'w5', 'w6'].map(w => [w, num(row[w]) ?? 0]))
}

/** Lane of a delivery priority: HIGH | MEDIUM | NORMAL (blank and unknown keys → NORMAL). */
export async function laneOf(deliveryPriority) {
  const rows = await SELECT.from(DB.DeliveryPriorityLane).columns('deliveryPriority', 'lane_code')
  return mapLane(deliveryPriority, rows)
}

/** { HIGH: 1, MEDIUM: 2, NORMAL: 3 }: lower rank = more urgent (§2.2). */
export async function laneRanks() {
  const rows = await SELECT.from(DB.Lanes).columns('code', 'criticality')
  return Object.fromEntries(rows.map(r => [r.code, r.criticality]))
}

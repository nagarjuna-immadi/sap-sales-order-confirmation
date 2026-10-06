// Movement history for slow movers and excess stock (blueprint §7 A3,
// development plan 2.1).
//
// No standard API in §4.2 (it would come from material documents and
// consumption history), so this reads the local MaterialMovementStats mock
// (§8.1) in every profile.

import cds from '@sap/cds'
import { num } from './connection.js'
import { dateOf } from '../demo-clock.js'

const { SELECT } = cds.ql

const STATS = 'order.conf.MaterialMovementStats'

/**
 * Per plant: [{ material, plant, lastMovementDate, daysSinceMovement, monthlyDemand, unit, source: 'mock' }].
 * Plants without a row have no known history and are not returned.
 */
export async function getMovementStats(material, plants) {
  const where = { material }
  if (plants?.length) where.plant = { in: plants }
  const rows = await SELECT.from(STATS).where(where).orderBy('plant')
  return rows.map(row => ({
    material: row.material,
    plant: row.plant,
    lastMovementDate: dateOf(row.lastMovementOffset),
    daysSinceMovement: -row.lastMovementOffset,
    monthlyDemand: num(row.monthlyDemand),
    unit: row.unit,
    source: 'mock',
  }))
}

// Capacity load per work center and day (blueprint §4.2, development plan 2.1).
//
// No standard released API in §4.2, so this reads the local CapacityLoad mock
// (§8.2, pieces per day) in every profile. Its fields mirror
// A_WorkCenterCapPerBucket, which may replace it in the pilot (open decision 7).

import cds from '@sap/cds'
import { num } from './connection.js'
import { offsetOf, dateOf } from '../demo-clock.js'

const { SELECT } = cds.ql

const LOAD = 'order.conf.CapacityLoad'

/**
 * Load between two dates (YYYY-MM-DD, inclusive), by work center and date:
 * [{ plant, workCenter, date, dayOffset, availableCapacity, requirement,
 *    remainingCapacity, utilizationPercent, unit, orders: [], source: 'mock' }]
 * `workCenters` optionally narrows the result.
 */
export async function getLoad({ plant, workCenters, from, to }) {
  const where = { plant, dayOffset: { between: offsetOf(from), and: offsetOf(to) } }
  if (workCenters?.length) where.workCenter = { in: workCenters }
  const rows = await SELECT.from(LOAD).where(where).orderBy('workCenter', 'dayOffset')
  return rows.map(row => ({
    plant: row.plant,
    workCenter: row.workCenter,
    date: dateOf(row.dayOffset),
    dayOffset: row.dayOffset,
    availableCapacity: num(row.availableCapacity),
    requirement: num(row.requirement),
    remainingCapacity: num(row.remainingCapacity),
    utilizationPercent: num(row.utilizationPercent),
    unit: row.capacityUnit,
    orders: row.orders ? row.orders.split(/[,\s]+/).filter(Boolean) : [],
    source: 'mock',
  }))
}

// Work center adapter: API_WORK_CENTERS, plus the local ProductionRouting
// mock (blueprint §4.2, development plan 2.0 and 2.1).
//
// Work centers and their capacity header come from S/4. Which work centers
// make a material (primary and alternative production version) comes from
// the local routing mock in every profile: §4.2 has no routing API. Pieces
// per day are not here: S/4 capacity is in time units, and the demo's
// capacity in pieces is in CapacityLoad (capacity-load.js).

import cds from '@sap/cds'
import { connect, sourceOf, num } from './connection.js'
import { cached } from '../cache.js'

const { SELECT } = cds.ql

const SERVICE = 'API_WORK_CENTERS'
const ROUTING = 'order.conf.ProductionRouting'

/**
 * Work centers of a plant, cached:
 * [{ workCenter, internalId, typeCode, description, plant, capacityId, capacityUnit, source }]
 */
export function getWorkCenters(plant) {
  const source = sourceOf(SERVICE)
  return cached(`work-centers:${source}:${plant}`, async () => {
    const s4 = await connect(SERVICE)
    const { A_WorkCenters, A_WorkCenterCapacity } = s4.entities
    const centers = await s4.run(
      SELECT.from(A_WorkCenters)
        .columns('WorkCenterInternalID', 'WorkCenterTypeCode', 'WorkCenter', 'WorkCenterDesc', 'Plant', 'CapacityInternalID')
        .where({ Plant: plant }),
    )
    const capacities = centers.length
      ? await s4.run(
          SELECT.from(A_WorkCenterCapacity)
            .columns('CapacityInternalID', 'CapacityQuantityUnit')
            .where({ CapacityInternalID: { in: centers.map(c => c.CapacityInternalID) } }),
        )
      : []
    return centers
      .map(c => ({
        workCenter: c.WorkCenter,
        internalId: c.WorkCenterInternalID,
        typeCode: c.WorkCenterTypeCode,
        description: c.WorkCenterDesc,
        plant: c.Plant,
        capacityId: c.CapacityInternalID,
        capacityUnit: capacities.find(k => k.CapacityInternalID === c.CapacityInternalID)?.CapacityQuantityUnit ?? null,
        source,
      }))
      .sort((a, b) => a.workCenter.localeCompare(b.workCenter))
  })
}

/**
 * Production versions of a material, primary first, cached:
 * [{ productionVersion, isPrimary, operations: [{ sequence, operation, operationText, workCenter, qtyPerPiece }], source: 'mock' }]
 */
export function getRouting(material, plant) {
  return cached(`routing:${material}:${plant}`, async () => {
    const rows = await SELECT.from(ROUTING)
      .columns('productionVersion', 'sequence', 'isPrimary', 'operation', 'operationText', 'workCenter', 'qtyPerPiece')
      .where({ material, plant })
      .orderBy('productionVersion', 'sequence')
    const versions = new Map()
    for (const row of rows) {
      const version = versions.get(row.productionVersion) ?? {
        productionVersion: row.productionVersion,
        isPrimary: !!row.isPrimary,
        operations: [],
        source: 'mock',
      }
      version.operations.push({
        sequence: row.sequence,
        operation: row.operation,
        operationText: row.operationText,
        workCenter: row.workCenter,
        qtyPerPiece: num(row.qtyPerPiece) ?? 1,
      })
      versions.set(row.productionVersion, version)
    }
    return [...versions.values()].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
  })
}

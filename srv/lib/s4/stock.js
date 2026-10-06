// Stock adapter: API_MATERIAL_STOCK_SRV (blueprint §4.2, development plan 2.1).
//
// Unrestricted stock (InventoryStockType 01) of plain plant stock, summed over
// storage locations per plant. Filtered by material only, so every plant that
// has the material is returned (plant 1100 is not configured anywhere else).

import cds from '@sap/cds'
import { connect, sourceOf, num, qty } from './connection.js'

const { SELECT } = cds.ql

const SERVICE = 'API_MATERIAL_STOCK_SRV'
const UNRESTRICTED = '01'

/**
 * Stock per plant: [{ material, plant, unrestrictedQty, unit, source }],
 * sorted by plant. `plants` optionally narrows the result.
 */
export async function getStock(material, plants) {
  const s4 = await connect(SERVICE)
  const { A_MatlStkInAcctMod } = s4.entities
  const rows = await s4.run(
    SELECT.from(A_MatlStkInAcctMod)
      .columns('Material', 'Plant', 'StorageLocation', 'InventorySpecialStockType', 'MaterialBaseUnit', 'MatlWrhsStkQtyInMatlBaseUnit')
      .where({ Material: material, InventoryStockType: UNRESTRICTED }),
  )
  const source = sourceOf(SERVICE)
  const perPlant = new Map()
  for (const row of rows) {
    if (row.InventorySpecialStockType) continue // consignment, project, sales order stock: not free
    if (plants?.length && !plants.includes(row.Plant)) continue
    const entry = perPlant.get(row.Plant) ?? { material, plant: row.Plant, unrestrictedQty: 0, unit: row.MaterialBaseUnit, source }
    entry.unrestrictedQty = qty(entry.unrestrictedQty + (num(row.MatlWrhsStkQtyInMatlBaseUnit) ?? 0))
    perPlant.set(row.Plant, entry)
  }
  return [...perPlant.values()].sort((a, b) => a.plant.localeCompare(b.plant))
}

// Product adapter: API_PRODUCT_SRV (blueprint §4.2, development plan 2.1).
//
// Master data and MRP data per plant. The lot-size policy comes only from
// A_ProductSupplyPlanning (plan 2.0); A_ProductPlant repeats some fields and
// is not read.

import cds from '@sap/cds'
import { connect, sourceOf, num } from './connection.js'
import { cached } from '../cache.js'

const { SELECT } = cds.ql

const SERVICE = 'API_PRODUCT_SRV'

// S/4 lot-sizing procedures → the policies simulateLeftover() knows. Anything
// else is OTHER and is treated as exact lot size with its min/max/rounding.
const LOT_SIZE_POLICY = { EX: 'EXACT', FX: 'FIXED' }

/** { material, description, productType, baseUnit, source }, or null. Cached. */
export function getProduct(material, language = 'EN') {
  const source = sourceOf(SERVICE)
  return cached(`product:${source}:${material}:${language}`, async () => {
    const s4 = await connect(SERVICE)
    const { A_Product, A_ProductDescription } = s4.entities
    const product = await s4.run(SELECT.one.from(A_Product).columns('Product', 'ProductType', 'BaseUnit').where({ Product: material }))
    if (!product) return null
    const text = await s4.run(
      SELECT.one.from(A_ProductDescription).columns('ProductDescription').where({ Product: material, Language: language }),
    )
    return {
      material: product.Product,
      description: text?.ProductDescription ?? product.Product,
      productType: product.ProductType,
      baseUnit: product.BaseUnit,
      source,
    }
  })
}

/**
 * MRP data of a material in a plant, or null. Cached.
 * { material, plant, procurementType ('E' in-house | 'F' external),
 *   inHouseProductionDays, plannedDeliveryDays, safetyStock,
 *   lotSize: { procedure, policy: EXACT | FIXED | OTHER, fixedQty, minimumQty, maximumQty, roundingQty },
 *   source }
 */
export function getSupplyPlanning(material, plant) {
  const source = sourceOf(SERVICE)
  return cached(`supply-planning:${source}:${material}:${plant}`, async () => {
    const s4 = await connect(SERVICE)
    const { A_ProductSupplyPlanning } = s4.entities
    const row = await s4.run(
      SELECT.one.from(A_ProductSupplyPlanning)
        .columns(
          'Product',
          'Plant',
          'LotSizingProcedure',
          'FixedLotSizeQuantity',
          'MinimumLotSizeQuantity',
          'MaximumLotSizeQuantity',
          'LotSizeRoundingQuantity',
          'ProcurementType',
          'InHouseProductionTime',
          'PlannedDeliveryDurationInDays',
          'SafetyStockQuantity',
        )
        .where({ Product: material, Plant: plant }),
    )
    if (!row) return null
    return {
      material: row.Product,
      plant: row.Plant,
      procurementType: row.ProcurementType,
      inHouseProductionDays: num(row.InHouseProductionTime) ?? 0,
      plannedDeliveryDays: num(row.PlannedDeliveryDurationInDays) ?? 0,
      safetyStock: num(row.SafetyStockQuantity) ?? 0,
      lotSize: {
        procedure: row.LotSizingProcedure,
        policy: LOT_SIZE_POLICY[row.LotSizingProcedure] ?? 'OTHER',
        fixedQty: num(row.FixedLotSizeQuantity) ?? 0,
        minimumQty: num(row.MinimumLotSizeQuantity) ?? 0,
        maximumQty: num(row.MaximumLotSizeQuantity) ?? 0,
        roundingQty: num(row.LotSizeRoundingQuantity) ?? 0,
      },
      source,
    }
  })
}

// BOM adapter: API_BILL_OF_MATERIAL_SRV (blueprint §4.2, development plan 2.1).
//
// Explodes level by level over MaterialBOMItem in every profile. The
// ExplodeBOM function import is never called: the mock cannot run it.
// Production BOMs only (category M, usage 1); the first valid variant wins.

import cds from '@sap/cds'
import { connect, sourceOf, isoDate, num, qty } from './connection.js'
import { cached } from '../cache.js'
import { today } from '../demo-clock.js'

const { SELECT } = cds.ql

const SERVICE = 'API_BILL_OF_MATERIAL_SRV'
const MATERIAL_BOM = 'M'
const PRODUCTION_USAGE = '1'
const MAX_LEVELS = 10

const validToday = row => {
  const day = today()
  const from = isoDate(row.ValidityStartDate)
  const to = isoDate(row.ValidityEndDate)
  return (!from || from <= day) && (!to || to >= day)
}

/**
 * One BOM level, cached: [{ component, description, quantityPerPiece, unit, scrapPercent }],
 * where quantityPerPiece is per 1 piece of the header material, scrap included.
 * [] when the material has no BOM in the plant (bought-in or raw material).
 */
export function getBomItems(material, plant) {
  const source = sourceOf(SERVICE)
  return cached(`bom:${source}:${material}:${plant}`, async () => {
    const s4 = await connect(SERVICE)
    const { MaterialBOM, MaterialBOMItem } = s4.entities
    const headers = await s4.run(
      SELECT.from(MaterialBOM)
        .columns('BillOfMaterial', 'BillOfMaterialCategory', 'BillOfMaterialVariant', 'BillOfMaterialVariantUsage', 'BOMHeaderQuantityInBaseUnit', 'IsMarkedForDeletion')
        .where({ Material: material, Plant: plant, BillOfMaterialCategory: MATERIAL_BOM }),
    )
    const header = headers
      .filter(h => (h.BillOfMaterialVariantUsage ?? PRODUCTION_USAGE) === PRODUCTION_USAGE && !h.IsMarkedForDeletion)
      .sort((a, b) => String(a.BillOfMaterialVariant).localeCompare(String(b.BillOfMaterialVariant)))[0]
    if (!header) return []

    const items = await s4.run(
      SELECT.from(MaterialBOMItem)
        .columns('BillOfMaterialComponent', 'ComponentDescription', 'BillOfMaterialItemQuantity', 'BillOfMaterialItemUnit', 'ComponentScrapInPercent', 'ValidityStartDate', 'ValidityEndDate', 'BillOfMaterialItemNumber')
        .where({
          BillOfMaterial: header.BillOfMaterial,
          BillOfMaterialCategory: header.BillOfMaterialCategory,
          BillOfMaterialVariant: header.BillOfMaterialVariant,
          Material: material,
          Plant: plant,
        }),
    )
    const baseQty = num(header.BOMHeaderQuantityInBaseUnit) || 1
    return items
      .filter(validToday)
      .sort((a, b) => String(a.BillOfMaterialItemNumber).localeCompare(String(b.BillOfMaterialItemNumber)))
      .map(item => {
        const scrapPercent = num(item.ComponentScrapInPercent) ?? 0
        return {
          component: item.BillOfMaterialComponent,
          description: item.ComponentDescription,
          quantityPerPiece: ((num(item.BillOfMaterialItemQuantity) ?? 0) / baseQty) * (1 + scrapPercent / 100),
          unit: item.BillOfMaterialItemUnit,
          scrapPercent,
        }
      })
  })
}

/**
 * Multi-level explosion, breadth first:
 * [{ material, parent, level, requiredQty, unit, source }], level 0 = the header material.
 * FG-100 × 100 → SFG-200 100 → RAW-1 105, RAW-2 5 (§8.3).
 */
export async function explodeBom(material, plant, quantity) {
  const source = sourceOf(SERVICE)
  const result = [{ material, parent: null, level: 0, requiredQty: qty(Number(quantity)), unit: null, source }]
  let current = [result[0]]
  for (let level = 1; current.length && level <= MAX_LEVELS; level++) {
    const next = []
    for (const node of current) {
      for (const item of await getBomItems(node.material, plant)) {
        next.push({
          material: item.component,
          parent: node.material,
          level,
          requiredQty: qty(node.requiredQty * item.quantityPerPiece),
          unit: item.unit,
          source,
        })
      }
    }
    result.push(...next)
    current = next
  }
  return result
}

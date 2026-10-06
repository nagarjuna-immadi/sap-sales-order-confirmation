// Basic ATP adapter: API_PRODUCT_AVAILY_INFO_BASIC (blueprint §4.2, development plan 2.1).
//
// The service has function imports only, which the generic mock cannot run.
// - mock: computed from unrestricted stock in the plant (stock adapter) and
//   returned in the AvailabilityRecord shape of the real function. No
//   receipts: the demo story has none for the checked materials.
// - s4: GET DetermineAvailabilityOf (quantity → date), the read-only V2
//   function import. Both go through the same mapping.

import cds from '@sap/cds'
import { connect, isMocked, sourceOf, isoDate, num } from './connection.js'
import { getStock } from './stock.js'
import { today } from '../demo-clock.js'

const SERVICE = 'API_PRODUCT_AVAILY_INFO_BASIC'
// Checking rule of the sales order ATP check (SD: A). Customizing in the pilot.
const ATP_CHECKING_RULE = 'A'
// S/4 answers 9999-12-31 when the quantity is never available.
const NEVER = '9999'

const odataString = value => `'${String(value).replace(/'/g, "''")}'`

/** The AvailabilityRecord the mock would get from DetermineAvailabilityOf. */
async function mockRecord({ material, plant, quantity }) {
  const [stock] = await getStock(material, [plant])
  const onHand = stock?.unrestrictedQty ?? 0
  const date = onHand >= quantity ? today() : `${NEVER}-12-31`
  return {
    PeriodStartUTCDateTime: `${date}T00:00:00Z`,
    PeriodEndUTCDateTime: `${date}T23:59:59Z`,
    AvailableQuantityInBaseUnit: Math.min(onHand, quantity),
    BaseUnit: stock?.unit ?? 'PC',
  }
}

async function s4Record({ material, plant, quantity }) {
  const s4 = await connect(SERVICE)
  const params = [
    `Material=${odataString(material)}`,
    `SupplyingPlant=${odataString(plant)}`,
    `ATPCheckingRule=${odataString(ATP_CHECKING_RULE)}`,
    `RequestedQuantityInBaseUnit=${Number(quantity)}M`,
  ].join('&')
  const result = await s4.send({ method: 'GET', path: `/DetermineAvailabilityOf?${params}` })
  return result?.DetermineAvailabilityOf ?? result
}

/**
 * When is `quantity` of `material` available in `plant`?
 * Returns { material, plant, requestedQty, availableQty, availableDate, unit, source };
 * availableDate is YYYY-MM-DD, or null when the quantity is never available.
 */
export async function checkAvailability({ material, plant, quantity }) {
  const record = isMocked(SERVICE) ? await mockRecord({ material, plant, quantity }) : await s4Record({ material, plant, quantity })
  if (!record) throw cds.error(`No availability result for ${material} in plant ${plant}`, { status: 502 })
  const date = isoDate(record.PeriodStartUTCDateTime)
  return {
    material,
    plant,
    requestedQty: Number(quantity),
    availableQty: num(record.AvailableQuantityInBaseUnit) ?? 0,
    availableDate: date && !date.startsWith(NEVER) ? date : null,
    unit: record.BaseUnit,
    source: sourceOf(SERVICE),
  }
}

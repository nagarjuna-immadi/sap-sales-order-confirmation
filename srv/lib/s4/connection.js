// Shared plumbing for the S/4 adapters (blueprint §4.3, development plan 2.1).
//
// The mode is decided per data source, not per profile: a service without
// credentials in cds.requires is served from the CSV mocks (`mock`), one with
// credentials goes to the S/4HANA system (`s4`). Phase 8 keeps APIs that are
// not active in the CAL system mocked in production, so a profile check would
// be wrong there.
//
// Adapters return plain domain objects, never OData payloads. All values that
// differ between the SQLite mock and a V2 response are normalized here.

import cds from '@sap/cds'

const services = new Map()

/** True when the imported S/4 service runs on the local CSV mock. */
export function isMocked(serviceName) {
  return !cds.env.requires[serviceName]?.credentials
}

/** 'mock' or 's4', the `source` every adapter result carries. */
export function sourceOf(serviceName) {
  return isMocked(serviceName) ? 'mock' : 's4'
}

/** Connects once per service and returns it with its entities. */
export function connect(serviceName) {
  if (!services.has(serviceName)) services.set(serviceName, cds.connect.to(serviceName))
  return services.get(serviceName)
}

/**
 * A date as YYYY-MM-DD, or null. Accepts the mock's ISO dates, ISO timestamps
 * and the V2 wire format /Date(ms)/ in case a response is not converted.
 */
export function isoDate(value) {
  if (value == null || value === '') return null
  const v2 = /^\/Date\((-?\d+)(?:[+-]\d+)?\)\/$/.exec(String(value))
  if (v2) return new Date(Number(v2[1])).toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

/** A number, or null. SQLite returns decimals as strings ('1.000'). */
export function num(value) {
  return value == null || value === '' ? null : Number(value)
}

/** S/4 flags are 'X' or ''; the mock may also give booleans. */
export function flag(value) {
  return value === true || value === 'X'
}

/** Rounds quantities to the 3 decimals S/4 uses, so 100 × 1.05 is 105, not 105.00000000000001. */
export function qty(value) {
  return value == null ? null : Math.round(value * 1000) / 1000
}

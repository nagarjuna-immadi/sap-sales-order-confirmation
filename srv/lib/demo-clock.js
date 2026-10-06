// Demo clock: resolves the §8 offsets (D+n) against an injectable "today".
//
// Dates are calendar days in UTC, written as YYYY-MM-DD, as in
// scripts/gen-mock-data.js. "Today" is, in this order: the date set with
// setToday(), the DEMO_TODAY environment variable, the system date. Set it to
// the generator's --base date to keep the local mocks (CapacityLoad,
// MaterialMovementStats) in line with the S/4 mock CSVs.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000

let injected = null

const toDate = iso => {
  if (!ISO_DATE.test(iso ?? '')) throw new Error(`Expected a date as YYYY-MM-DD, got ${iso}`)
  return new Date(`${iso}T00:00:00Z`)
}

/** Sets "today" (YYYY-MM-DD); null goes back to DEMO_TODAY or the system date. */
export function setToday(iso) {
  if (iso != null) toDate(iso)
  injected = iso ?? null
}

/** Today as YYYY-MM-DD. */
export function today() {
  if (injected) return injected
  const env = process.env.DEMO_TODAY
  if (env) return toDate(env).toISOString().slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

/** D+n as YYYY-MM-DD (n may be negative). */
export function dateOf(offset) {
  if (!Number.isInteger(offset)) throw new Error(`Expected a whole day offset, got ${offset}`)
  return new Date(toDate(today()).getTime() + offset * DAY_MS).toISOString().slice(0, 10)
}

/** The n in D+n for a date (YYYY-MM-DD or the date part of a timestamp). */
export function offsetOf(date) {
  const iso = String(date).slice(0, 10)
  return Math.round((toDate(iso).getTime() - toDate(today()).getTime()) / DAY_MS)
}

/** "D+5", "D-120", "D+0": the label used in texts and logs. */
export function label(offset) {
  return offset < 0 ? `D${offset}` : `D+${offset}`
}

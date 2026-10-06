// Durations for the Case Timeline (db CaseTimeline view). The view gives each
// row the time of the previous row with the same outcome (previousAt); this
// turns it into seconds and a short text. In JS rather than SQL, because
// SQLite and HANA have no common date difference function.
// Refused rows get no duration: they are attempts, not steps.

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** 42 → "42 s", 3720 → "1 h 2 min", 93600 → "1 d 2 h". */
export function durationText(seconds) {
  if (seconds == null) return null
  if (seconds < MINUTE) return `${seconds} s`
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)} min`
  if (seconds < DAY) {
    const minutes = Math.floor((seconds % HOUR) / MINUTE)
    return `${Math.floor(seconds / HOUR)} h${minutes ? ` ${minutes} min` : ''}`
  }
  const hours = Math.floor((seconds % DAY) / HOUR)
  return `${Math.floor(seconds / DAY)} d${hours ? ` ${hours} h` : ''}`
}

const VIRTUALS = ['durationSeconds', 'durationText']

/** The virtual duration fields a READ asks for: all without $select, else the selected ones. */
export function requestedDurations(query) {
  const columns = query?.SELECT?.columns
  if (!columns || columns.some(c => c === '*')) return VIRTUALS
  return VIRTUALS.filter(name => columns.some(c => c.ref?.[0] === name))
}

/** Fills durationSeconds and durationText (only those in `fields`) on timeline rows. */
export function addDurations(result, fields = VIRTUALS) {
  if (!fields.length) return
  for (const row of [result ?? []].flat()) {
    if (!row) continue
    const done = row.outcome == null || row.outcome === 'DONE'
    const seconds =
      done && row.at && row.previousAt
        ? Math.max(0, Math.round((new Date(row.at) - new Date(row.previousAt)) / 1000))
        : null
    if (fields.includes('durationSeconds')) row.durationSeconds = seconds
    if (fields.includes('durationText')) row.durationText = durationText(seconds)
  }
}

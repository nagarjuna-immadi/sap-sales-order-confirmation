// Number check for agent texts (blueprint §5.1, §5.2; development plan 6.1).
//
// Every number, date and ID in a text Claude wrote must appear in the facts
// of that run: the results of its function calls. Pure functions, no CAP, so
// the Order Assistant uses the same check on its answers (phase 7).
//
// - Dates are compared as ISO dates. Besides 2026-10-11 the text may write
//   11.10.2026, 11 October 2026, 11. Oktober 2026 or October 11, 2026 (the
//   customer drafts are in the customer's language); facts are ISO.
// - IDs are upper-case tokens with a hyphen: FC-0001, CR-0002, SO-5004,
//   FG-100, O-ALT, S-PRODUCE, C-1001. They must appear as they are.
// - Numbers are compared by value, so 100, 100.000 and 1,000 / 1.000 match
//   when one reading is in the facts. A percent sign is ignored (30% ↔ 30).
//
// missingIn() is the other direction: the key facts a text must mention
// (e.g. the confirmed date in a customer confirmation).

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  januar: 1, februar: 2, märz: 3, maerz: 3, mai: 5, juni: 6, juli: 7, oktober: 10, dezember: 12,
}
const MONTH = Object.keys(MONTHS).join('|')

const pad = n => String(n).padStart(2, '0')
const iso = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null)

// Each pattern turns a match into an ISO date (null: not a valid date).
const DATE_PATTERNS = [
  [/\b(\d{4})-(\d{2})-(\d{2})\b/g, m => iso(+m[1], +m[2], +m[3])],
  [/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g, m => iso(+m[3], +m[2], +m[1])],
  [new RegExp(`\\b(\\d{1,2})\\.?\\s+(${MONTH})\\s+(\\d{4})\\b`, 'giu'), m => iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1])],
  [new RegExp(`\\b(${MONTH})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'giu'), m => iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2])],
]

const ID = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/g
const NUMBER = /(?<![\w])\d+(?:[.,]\d+)*(?![\w])/g

/** Replaces each match with spaces, so later patterns don't see it again. */
const blank = (text, start, length) => text.slice(0, start) + ' '.repeat(length) + text.slice(start + length)

/** The values a number token can mean: 1,000.5 / 1.000,5 / 100.000 (a decimal). */
function readings(token) {
  const values = new Set()
  const english = Number(token.replace(/,/g, ''))
  const german = Number(token.replace(/\./g, '').replace(',', '.'))
  if (Number.isFinite(english)) values.add(english)
  if (Number.isFinite(german) && /^\d+(?:\.\d{3})*(?:,\d+)?$/.test(token)) values.add(german)
  // a comma alone as the decimal separator: 2,5
  if (/^\d+,\d+$/.test(token)) values.add(Number(token.replace(',', '.')))
  return [...values]
}

/** All string and number leaves of a value (objects, arrays, JSON or TOON text). */
function leaves(value, out = []) {
  if (value == null) return out
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out.push(String(value))
  else if (Array.isArray(value)) value.forEach(v => leaves(v, out))
  else if (typeof value === 'object') Object.values(value).forEach(v => leaves(v, out))
  return out
}

/**
 * Splits a text into the dates, IDs and numbers it mentions:
 * { dates: [{ token, iso }], ids: [token], numbers: [token] }.
 */
export function tokensOf(text) {
  let rest = String(text ?? '')
  const dates = []
  for (const [pattern, toIso] of DATE_PATTERNS) {
    for (const m of [...rest.matchAll(pattern)]) {
      const value = toIso(m)
      if (!value) continue
      dates.push({ token: m[0], iso: value })
      rest = blank(rest, m.index, m[0].length)
    }
  }
  const ids = []
  for (const m of [...rest.matchAll(ID)]) {
    ids.push(m[0])
    rest = blank(rest, m.index, m[0].length)
  }
  const numbers = [...rest.matchAll(NUMBER)].map(m => m[0])
  return { dates, ids, numbers }
}

/** The numeric values written in a text, e.g. the rate in a contract clause. */
export function numbersIn(text) {
  return new Set(tokensOf(text).numbers.flatMap(readings))
}

/** The dates, IDs and numbers the facts contain, for checkText. */
export function factsOf(facts) {
  const dates = new Set()
  const ids = new Set()
  const numbers = new Set()
  for (const leaf of leaves(facts)) {
    const t = tokensOf(leaf)
    t.dates.forEach(d => dates.add(d.iso))
    t.ids.forEach(id => ids.add(id))
    // TOON writes table rows comma-separated (…,30,100), so each part counts on its own too
    t.numbers.flatMap(n => [n, ...n.split(',')]).flatMap(readings).forEach(n => numbers.add(n))
    // an ID's or a date's own digits may be quoted on their own (order 5004, day 11)
    for (const token of [...t.ids, ...t.dates.map(d => d.token)]) for (const n of token.match(/\d+/g) ?? []) numbers.add(Number(n))
  }
  return { dates, ids, numbers }
}

/**
 * Checks a text against the facts of a run. facts: any value (tool results
 * as objects or text). Returns { ok, unknown: [token] }: unknown are the
 * dates, IDs and numbers of the text that are not in the facts.
 */
export function checkText(text, facts) {
  const known = facts?.dates instanceof Set ? facts : factsOf(facts)
  const { dates, ids, numbers } = tokensOf(text)
  const unknown = [
    ...dates.filter(d => !known.dates.has(d.iso)).map(d => d.token),
    ...ids.filter(id => !known.ids.has(id)),
    ...numbers.filter(n => !readings(n).some(v => known.numbers.has(v))),
  ]
  return { ok: unknown.length === 0, unknown }
}

/**
 * The values of `required` that a text does not mention: ISO dates (in any
 * format tokensOf reads), IDs and numbers. Empty values are skipped.
 */
export function missingIn(text, required = []) {
  const mentioned = factsOf(text)
  return required.filter(value => {
    if (value == null || value === '') return false
    const s = String(value)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return !mentioned.dates.has(s)
    if (typeof value === 'number' || /^\d+(?:\.\d+)?$/.test(s)) return !mentioned.numbers.has(Number(s))
    return !mentioned.ids.has(s) && !String(text).includes(s)
  })
}

// Computed fields for the case apps (development plan 3). Two kinds of
// elements cannot come from the database:
// - virtual elements (e.g. which actions the status allows, the latest
//   recommendation's text), filled after READ;
// - associations to @cds.persistence.skip entities, i.e. lists built from the
//   JSON the agents store (material tree, ranked options). As $expand they are
//   taken out of the database query and filled after READ; as a navigation
//   (Cases('FC-0001')/supplyTree) the service's own READ handler builds them.
//   The caller names them: at runtime, auto-exposed code lists look like
//   persistence.skip targets too.
// Both are filled only when the client asks for them ($select / $expand, or
// everything without $select), so the worklist does not pay for the object page.

import { TRANSITIONS } from '../agents/feasibility-case-orchestrator/case-rules.js'

/** canConfirmFromStock, … for each action: the field that says whether the status allows it. */
export const flagOf = action => `can${action[0].toUpperCase()}${action.slice(1)}`

/** { canConfirmFromStock: true, … }: which of `actions` the case-rules status table allows in `status`. */
export function actionFlags(status, actions) {
  return Object.fromEntries(actions.map(action => [flagOf(action), TRANSITIONS[action].from.includes(status)]))
}

/** The page of `rows` a READ asks for ($skip / $top), with $count. */
export function page(rows, query) {
  const { offset, rows: top } = query?.SELECT?.limit ?? {}
  const start = offset?.val ?? 0
  const result = top?.val == null ? rows.slice(start) : rows.slice(start, start + top.val)
  result.$count = rows.length
  return result
}

/**
 * srv:    the service
 * entity: the entity with virtual elements or JSON-backed associations
 * inputs: columns fill() needs, added to an explicit $select
 * lists:  the associations to JSON-backed (@cds.persistence.skip) entities
 * fill:   async (rows, requested) => void; requested is a Set of element names
 *         (virtual elements, and the lists that were expanded)
 */
export function registerComputedFields(srv, entity, { inputs = [], lists = [], fill }) {
  const virtuals = Object.values(entity.elements).filter(e => e.virtual).map(e => e.name)
  const requested = new WeakMap()

  srv.before('READ', entity, req => {
    const select = req.query.SELECT
    const columns = select.columns
    const all = !columns || columns.some(c => c === '*')
    const names = new Set(all ? virtuals : virtuals.filter(name => columns.some(c => c.ref?.[0] === name)))
    if (columns) {
      for (const c of columns) if (lists.includes(c.ref?.[0]) && c.expand) names.add(c.ref[0])
      select.columns = columns.filter(c => !lists.includes(c.ref?.[0]))
      if (!all) for (const name of inputs) if (!select.columns.some(c => c.ref?.[0] === name && !c.as)) select.columns.push({ ref: [name] })
    }
    requested.set(req, names)
  })

  srv.after('READ', entity, async (result, req) => {
    const names = requested.get(req)
    if (!names?.size || !result || typeof result !== 'object') return
    await fill([result].flat().filter(Boolean), names)
  })
}

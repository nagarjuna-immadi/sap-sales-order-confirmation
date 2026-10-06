// Read access to cases (blueprint §7 A1, rule 8). One rule for the three case
// services and the Order Assistant tools (phase 7):
//   Sales              every case (the demo has one sales team and no owner
//                      on the case; the pilot narrows this to the user's orders)
//   SupplyPlanner      every case that reached Supply Planning: not NEW, not AUTO_CONFIRMED
//   ProductionPlanner  every case with at least one capacity request
// A user with several roles sees the union. A case the user may not see is
// "not found", never "forbidden".
//
// canRead is pure (plain objects). scopeOf gives the same rule as a CQL
// condition for queries; `prefix` is the path from the queried entity to the
// case ('' on cases, 'parentCase.' on CRs, recommendations and the timeline).

const CASE_ROLES = ['Sales', 'SupplyPlanner', 'ProductionPlanner']
const NOT_FOR_SUPPLY = ['NEW', 'AUTO_CONFIRMED']

const RULES = {
  Sales: () => true,
  SupplyPlanner: caseRow => !NOT_FOR_SUPPLY.includes(caseRow.status_code ?? caseRow.status?.code ?? caseRow.status),
  ProductionPlanner: caseRow => !!(caseRow.hasCapacityRequest ?? caseRow.capacityRequests?.length),
}

const SCOPES = {
  Sales: () => null,
  SupplyPlanner: prefix => `${prefix}status.code not in (${NOT_FOR_SUPPLY.map(s => `'${s}'`).join(', ')})`,
  ProductionPlanner: prefix => `exists ${prefix}capacityRequests`,
}

const rolesOf = (user, roles) => (roles ?? CASE_ROLES).filter(role => user?.is?.(role) ?? user?.roles?.includes?.(role))

/**
 * May the user read this case? caseRow: { status_code | status, hasCapacityRequest | capacityRequests }.
 * roles limits the check to some roles (e.g. the one role of a service); default all case roles.
 */
export function canRead(user, caseRow, roles) {
  if (!caseRow) return false
  return rolesOf(user, roles).some(role => RULES[role](caseRow))
}

/**
 * The read rule as a CQL condition string, or null for "all cases" and
 * 'false' for "none". Combine with the query: req.query.where(scope).
 */
export function scopeOf(user, roles, prefix = '') {
  const conditions = []
  for (const role of rolesOf(user, roles)) {
    const condition = SCOPES[role](prefix)
    if (condition === null) return null
    conditions.push(`(${condition})`)
  }
  return conditions.length ? conditions.join(' or ') : '1 = 0'
}

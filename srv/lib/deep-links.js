// Semantic-object intents of the three case apps, one inbound per app
// (manifest crossNavigation, development plan 4). Used for the Communication
// agent's notifications and the Order Assistant's deep links (phase 7).

export const INTENTS = Object.freeze({
  supply: caseId => `#FeasibilityCase-plan?caseId=${caseId}`,
  production: crId => `#CapacityRequest-decide?crId=${crId}`,
  sales: caseId => `#FeasibilityCase-track?caseId=${caseId}`,
})

// The case app of each role: its title and the intent that opens a case in it
// (Production opens the capacity request, so it needs one).
export const CASE_APPS = Object.freeze({
  Sales: { app: 'Sales Order Feasibility', link: ({ caseId }) => INTENTS.sales(caseId) },
  SupplyPlanner: { app: 'Supply Planning Workbench', link: ({ caseId }) => INTENTS.supply(caseId) },
  ProductionPlanner: { app: 'Production Capacity Workbench', link: ({ crId }) => crId && INTENTS.production(crId) },
})

// Demo scenarios (development plan 2.4): overrides on the local CapacityLoad
// mock, applied where the load is read (capacity-load.js), so A3 and A4 see
// them without knowing about scenarios. The stored rows never change.
//
// Process memory: a restart (or resetDemo) goes back to 'default'. Set a
// scenario before the production check is requested: A4 computes the options
// when the CR is created.

const SCENARIOS = Object.freeze({
  default: null,
  // §8.3 scenario 4: WC-ASSY-02 down for maintenance, no capacity at all
  'sc4-assy02-down': row =>
    row.workCenter === 'WC-ASSY-02' ? { ...row, availableCapacity: 0, remainingCapacity: 0, utilizationPercent: null } : row,
})

let current = 'default'

export const SCENARIO_NAMES = Object.freeze(Object.keys(SCENARIOS))

/** The active scenario's name. */
export function getScenario() {
  return current
}

/** Switches the scenario; throws on an unknown name. */
export function setScenario(name) {
  if (!(name in SCENARIOS)) throw new Error(`Unknown scenario ${name}; use ${SCENARIO_NAMES.join(' or ')}`)
  current = name
}

/** Load rows as the active scenario sees them. */
export function applyScenario(rows) {
  const override = SCENARIOS[current]
  return override ? rows.map(override) : rows
}

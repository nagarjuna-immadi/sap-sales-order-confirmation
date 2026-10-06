// Registers the agents that react to case events (development plan 2.3).
// Sales Order Intake (A2) is called directly by DemoService and SalesService;
// the Feasibility Case Orchestrator (A1) emits the events.

import { register as supplyInventory } from './supply-inventory/supply-inventory.js'
import { register as productionCapacityBalancing } from './production-capacity-balancing/production-capacity-balancing.js'
import { register as communication } from './communication/communication.js'

let registered = false

/** Subscribes A3, A4 and A5 to case.statusChanged, once per process. */
export function registerAgents() {
  if (registered) return
  registered = true
  supplyInventory()
  productionCapacityBalancing()
  communication()
}

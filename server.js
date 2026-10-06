// CAP server bootstrap (cds watch and cds-serve load it from the project root).
// Registers the agents on the case event bus once all services are served
// (development plan 2.3).

import cds from '@sap/cds'
import { registerAgents } from './srv/agents/index.js'

cds.once('served', registerAgents)

export default cds.server

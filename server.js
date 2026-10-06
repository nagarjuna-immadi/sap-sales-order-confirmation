// CAP server bootstrap (cds watch and cds-serve load it from the project root).
//
// - Registers the agents on the case event bus once all services are served
//   (development plan 2.3).
// - The app manifests use relative data source URIs (odata/v4/...), so the
//   apps also run under the Work Zone managed approuter (phase 8). Locally,
//   cds-plugin-ui5 serves each app under /order.conf.<app>/, so strip that
//   prefix from OData calls before CAP routes them (development plan 3).

import cds from '@sap/cds'
import { registerAgents } from './srv/agents/index.js'

cds.on('bootstrap', app => {
  app.use((req, res, next) => {
    const match = /^\/order\.conf\.[^/]+(\/odata\/.*)$/.exec(req.url)
    if (match) req.url = match[1]
    next()
  })
})

cds.once('served', registerAgents)

export default cds.server

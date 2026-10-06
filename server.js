// CAP server bootstrap (cds watch and cds-serve load it from the project root).
//
// - Registers the agents on the case event bus once all services are served
//   (development plan 2.3).
// - The app manifests use relative data source URIs (odata/v4/..., and
//   a2a/order-assistant/ for the Order Assistant), so the apps also run under
//   the Work Zone managed approuter (phase 8). Locally, cds-plugin-ui5 serves
//   each app under /order.conf.<app>/, so strip that prefix from OData and A2A
//   calls before CAP routes them (development plan 3, 7.2).
// - With mocked (basic) auth, the A2A adapter answers 401 as a JSON-RPC error
//   without a WWW-Authenticate header. The browser then never resends the
//   login it cached for the agent card (…/.well-known/), because the A2A
//   endpoint is its parent path. Add the challenge, with CAP's realm, so the
//   Order Assistant's POSTs carry the cached credentials (as in the TM project).
// - The approuter (standalone and Work Zone managed) gzips text/event-stream,
//   and the gzip stream holds the SSE events back until the answer is
//   complete. Cache-Control: no-transform makes its compression skip the
//   response, so the progress steps arrive live.

import cds from '@sap/cds'
import { registerAgents } from './srv/agents/index.js'

const basicAuth = ['mocked', 'basic'].includes(cds.env.requires.auth?.kind)

cds.on('bootstrap', app => {
  app.use((req, res, next) => {
    const match = /^\/order\.conf\.[^/]+(\/(?:odata|a2a)\/.*)$/.exec(req.url)
    if (match) req.url = match[1]
    if (req.url.startsWith('/a2a/')) {
      const writeHead = res.writeHead
      res.writeHead = function (status, ...args) {
        if (basicAuth && status === 401 && !res.getHeader('www-authenticate')) res.setHeader('WWW-Authenticate', 'Basic realm="Users"')
        if (String(res.getHeader('content-type')).startsWith('text/event-stream')) res.setHeader('Cache-Control', 'no-cache, no-transform')
        return writeHead.call(this, status, ...args)
      }
    }
    next()
  })
})

cds.once('served', registerAgents)

export default cds.server

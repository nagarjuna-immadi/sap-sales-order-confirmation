# Phase 10: Extras (optional, real S/4)

[← Development plan](README.md) · Previous: [Phase 9](phase-9-demo-readiness.md)

These steps need a real S/4HANA Private Cloud system, a paid BTP subaccount, or both. None of them is needed for the demo. Data privacy approval is required before any real S/4 data is sent to the Claude API (§4.4, §10.6).

- [ ] **`s4` against the Private Cloud:** destination `S4_PRIVATE_CLOUD` through the Cloud Connector (principal propagation or technical user), replacing `S4_CAL` from phase 6. The `srv/lib/s4/` modules stay the same; only the `[production]` credentials change. Activate the OData services in S/4.
- [ ] **Capacity load API:** first try the standard `API_WORK_CENTERS` capacity evaluation (`A_WorkCenterCapPerBucket`, daily buckets, converted from time units to pieces), see open decision 7. Only if it does not fit, build a custom CDS view + RAP/OData service in S/4 for load per work center per day (§4.2). Either one replaces the local `CapacityLoad` mock.
- [ ] **Real events:** Enterprise Event Enablement (`/IWXBE/CONFIG`) → SAP Event Mesh → CAP subscriber, using the payload format already accepted by `simulateS4Event`.
- [ ] **HANA Cloud** (if phase 6 stayed on SQLite): `cds add hana`, retention for audit log and cases.
- [ ] **Intent-based navigation** to *Manage Sales Orders*, *Monitor Material Coverage* and *Manage Work Center Capacity*, replacing the placeholders from phase 5.
- [ ] **Write-back proposals** behind a profile flag (off by default), refused against `S4_CAL` (its technical user is display-only): approved stock transfer → STO proposal, chosen capacity option → task or planned order change through an approved API. The order is then re-confirmed by the standard ATP check (§4.3). Each call writes an audit row with the S/4 document number.
- [ ] **AI Core mode:** an `aicore` provider in `srv/lib/llm/` (SAP Cloud SDK for AI), if the paid account has AI Core (§5.2). Agents, prompts and checks stay the same.
- [ ] **MCP server for local development:** expose the Order Assistant's read-only tools through `@cap-js/mcp` (as in the TM project), so Claude Code can query cases during development. Read-only, not routed through the approuter, never a path to an action.
- [ ] **More channels for A5:** email, Microsoft Teams, My Inbox / SAP Task Center (§7 A5).
- [ ] **Joule** front end on the same read-only CAP tools (§5.3).

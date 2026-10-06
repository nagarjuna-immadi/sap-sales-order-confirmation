// CAP loads only the .cds files directly in srv/, so the agent services in
// srv/agents/<agent>/ are pulled in here (development plan 6.2, 7.1). Each is a
// CAP agent (@cap-js/agents) with its persona AGENTS.md next to it: A2–A5 are
// internal agents called from CAP code, the Order Assistant is served to users
// over A2A (/a2a/order-assistant).
using from './agents/sales-order-intake/sales-order-intake-agent-service';
using from './agents/supply-inventory/supply-inventory-agent-service';
using from './agents/production-capacity-balancing/production-capacity-balancing-agent-service';
using from './agents/communication/communication-agent-service';
using from './agents/order-assistant/order-assistant-service';

# Sales-to-Planning Order Confirmation Agents on SAP BTP

**Solution blueprint · Demo phase**

## 0. Confirmed landscape

| Topic | Decision |
|---|---|
| ERP | **SAP S/4HANA Private Cloud** |
| APIs and events for the demo | Available on the **SAP Business Accelerator Hub sandbox** (api.sap.com) |
| Advanced ATP (Backorder Processing, Product Allocation) | **Not active.** Basic ATP only. |
| Embedded PP/DS | **Not active.** Classic PP capacity planning only. |
| Priority source | Sales order **delivery priority** (see §7 A2 for the mapping) |

---

## 1. Problem today

### 1.1 Current process

```
Customer ──order──▶ Sales ──phone / email / chat──▶ Supply Chain Planning ──phone / email / meetings──▶ Production Planning
                      ▲                                   │                                               │
                      └──────────── answer (hours to days, often incomplete) ◀─────────────────────────────┘
```

- Sales asks Supply Chain Planning about stock availability by phone, email or internal chat.
- Supply Chain Planning asks the Production Planner about resource capacity by phone, email or in meetings.
- Each team works in its own SAP GUI transactions (sales orders, stock/requirements list, MRP, capacity planning). Nobody sees the whole picture.
- There is no shared record of the question, the answer, who decided what, or how long it took.

### 1.2 Pain points and root causes

| # | Pain point | Root cause |
|---|---|---|
| P1 | Communication gap between Sales, Supply Chain Planning and Production | Requests are unstructured and live in inboxes and phone calls. There is no shared case. |
| P2 | Sales order confirmations to customers are delayed | Every request waits in a queue. Each team assembles the same data again by hand. |
| P3 | Too much inventory in the warehouse | Shortages are solved by producing more instead of first using stock in other plants, open receipts or slow-moving stock. Lot sizes overshoot the real need. |
| P4 | Production resources are badly load-balanced | Urgent orders are squeezed onto the usual machine. Alternative work centers with free capacity are not considered. |
| P5 | Near-term production plans keep being disrupted | Orders already fixed for the next few days are moved ad hoc to make room for urgent orders. |
| P6 | Late confirmations lead to customer penalties | High-priority orders get no faster path than normal ones. Nobody sees the penalty risk while the order is being decided. |

---

## 2. Target process

### 2.1 Principles

1. **One digital case per order question.** Phone and email are replaced by an **Order Feasibility Case** that all three teams see, with the same ID, data and timeline.
2. **Priority lanes.** HIGH, MEDIUM and NORMAL orders follow different paths. HIGH cases always come first in every team's worklist.
3. **Agents prepare, people decide.** AI agents collect the data, run the checks, simulate options and draft answers. Confirming to the customer, approving a stock transfer and changing the production plan are always explicit human actions.
4. **Use what exists before producing more.** Every production request first passes an inventory check (avoids P3).
5. **Balance load and protect the frozen horizon.** Capacity options are scored for load balance, and changes to orders inside the near-term frozen window need explicit approval from the Production Planner (avoids P4 and P5).
6. **Measure everything.** Every step is time-stamped, so lead time per step and penalties avoided are visible.

### 2.2 Priority lanes

| Lane | Trigger | Path |
|---|---|---|
| **HIGH (fast lane)** | Delivery priority mapped to HIGH, or the customer has a penalty clause | A case is created automatically and sent to Supply Chain Planning at once, at the top of their worklist. If needed, the Production Planner is asked with ready-made options. Sales confirms to the customer. |
| **MEDIUM (standard lane)** | Delivery priority mapped to MEDIUM | A case is created. Supply Chain Planning reviews it in its worklist after HIGH cases. Production is asked only if there is no stock or supply. |
| **NORMAL (auto lane)** | Delivery priority mapped to NORMAL (or blank) | The standard availability check confirms the order. A case is created **only** if the check fails (exception). Normal orders may be moved to make room for HIGH orders, but only if their own delivery date still holds. No human step when there is no exception. |

Worklists in every app are sorted by lane (HIGH → MEDIUM → NORMAL), then by the customer's requested delivery date.

### 2.3 Target flow (HIGH lane)

```
 Sales order (High) created in S/4HANA
        │ business event
        ▼
 [A2 Order Intake Agent]  classify priority, check penalty risk, open case FC-0001
        ▼
 [A3 Supply & Inventory Agent]  ATP + BOM explosion + multi-plant stock + excess-stock check
        │  recommendation: (a) confirm from stock   (b) stock transfer   (c) needs production   (d) reject
        ▼
 Supply Chain Planner ── decides in the Supply Planning Workbench ──┐
        │ (c) Request production check                              │ (a)(b) Confirm / (d) Reject
        ▼                                                            │
 [A4 Capacity & Load Balancing Agent]  simulate options per work      │
        center, score load balance, check the frozen horizon         │
        ▼                                                            │
 Production Planner ── chooses option / rejects in Production       │
        Capacity Workbench                                           │
        ▼                                                            │
 Supply Chain Planner ── confirms date to Sales ◀────────────────────┘
        ▼
 Sales ── reviews and sends the confirmation to the customer (draft written by A5)
        ▼
 Case CONFIRMED_TO_CUSTOMER · audit trail recorded by A1
```

[A1 Case Orchestrator] runs underneath every step. It enforces statuses and business rules, routes tasks and is the only component allowed to change the case status.

---

## 3. What exists in SAP standard (and the gap)

### 3.1 Standard Fiori apps relevant to this flow

These are SAP S/4HANA apps. Availability and app IDs depend on your release and whether you run Cloud or on-premise. **Check each one in the SAP Fiori Apps Reference Library for your exact release.**

| Team | Standard app | What it gives you |
|---|---|---|
| Sales | **Manage Sales Orders** (incl. Version 2) | Create, change and list sales orders, including the availability check result |
| Sales | **Track Sales Orders** | Status of an order through the process |
| Sales | **Sales Order Fulfillment – Analyze and Resolve Issues** | Orders blocked or incomplete, with fixes |
| Sales | **My Sales Overview** | Overview page for sales reps |
| Supply Chain Planning | **Monitor Material Coverage**, **Manage Material Coverage** | Shortages and coverage per material, with solution proposals |
| Supply Chain Planning | **Stock/Requirements List** (MD04, also as a GUI-for-HTML tile) | Element-by-element supply and demand |
| Supply Chain Planning | **Schedule MRP Runs** | MRP Live runs |
| Supply Chain Planning / Inventory | **Stock – Multiple Materials**, **Stock – Single Material**, **Slow or Non-Moving Materials** | Stock per plant/location and slow movers (input for avoiding excess stock) |
| Production | **Manage Production Orders**, **Manage Planned Orders** | Order lists and changes |
| Production | **Manage Work Center Capacity**, **Capacity Scheduling Board** | Load per work center and graphical rescheduling |
| Cross-team | **My Inbox** (Flexible Workflow), **Situation Handling** (My Situations), launchpad notifications | Tasks, alerts and notifications |

### 3.2 The gap

There is **no single standard Fiori app that runs the cross-team request → answer → confirmation conversation** between Sales, Supply Chain Planning and Production with one shared case, priority lanes and audit trail. Standard apps give each team *its own data*. They don't connect the teams' *decisions*.

That gap is what this solution fills: **a side-by-side extension on SAP BTP** (custom Fiori apps + AI agents) that reads from and links to the standard apps above rather than replacing them.

### 3.3 Standard levers to use alongside the agents

Advanced ATP and embedded PP/DS are not active. That means **S/4HANA itself will not prefer high-priority orders when stock is scarce**, and capacity planning is classic and infinite (it shows overloads but doesn't prevent them). The agents fill exactly that gap: A3 finds stock that can be reassigned, and A4 scores load balance. The agents work better if these classic settings are in order:

- **Delivery priority maintained consistently** in the customer master (sales area data) so it defaults correctly into sales order items, and controlled by Sales when it is changed on the order.
- **Classic rescheduling of sales documents** (transaction V_V2), which re-runs ATP for open orders sorted by delivery priority. Use it for periodic re-confirmation, and check its status for your release in the S/4HANA simplification list.
- **MRP lot-sizing review** (exact lot vs fixed lot) for materials with chronic excess stock.
- **Planning time fence / firming** in MRP for the near-term frozen horizon.
- **Work center capacities and alternative production versions** maintained, so A4 can offer alternative resources.

Later options, not in scope now: Advanced ATP (Backorder Processing with *Win / Gain / Redistribute / Fill* strategies, Product Allocation) and embedded PP/DS would move part of the agents' logic into standard S/4HANA. The agent design keeps that path open, because the tool layer can switch to those engines without changing the case flow.

---

## 4. Solution architecture on SAP BTP

```
┌──────────────────────────── SAP Build Work Zone (launchpad, role-based spaces) ────────────────────────────┐
│  Sales Order            Supply Planning           Production Capacity             Joule                │
│  Feasibility (Sales)    Workbench (SCP)           Workbench (Production)          (chat entry, later)  │
│  └─ links to standard apps: Manage Sales Orders · Monitor Material Coverage · Manage Work Center Capacity │
└───────────────┬──────────────────────────────────────────────────────────────────────────────▲───────────┘
                │ OData V4 (actions: Submit / Confirm / Reject / Choose option)                │ notifications
                ▼                                                                              │
┌──────────────────────────── CAP application (Node.js) on Cloud Foundry ─────────────────────────────────────┐
│  A1 Case Orchestrator (state machine, business rules, authorization, audit log, case timeline)            │
│  A2 Order Intake · A3 Supply & Inventory · A4 Capacity & Load Balancing · A5 Communication              │
│  Tool layer: deterministic functions (ATP, BOM, stock, capacity, simulate) ── Adapters (mock|sandbox|s4) │
└──────┬──────────────────────┬─────────────────────────────┬───────────────────────────┬────────────────────┘
       │ persistence           │ LLM calls                   │ events                    │ S/4 APIs
       ▼                       ▼                             ▼                           ▼
 SAP HANA Cloud         SAP AI Core – Generative AI    SAP Event Mesh /          Destination service +
 (cases, audit;         Hub (orchestration: prompt     Advanced Event Mesh       Cloud Connector →
  vector engine for     templates, grounding, data    (S/4 business events:     SAP S/4HANA OData APIs
  grounding docs)       masking, content filtering)   sales order created/changed)
```

### 4.1 BTP services

| Service | Purpose here | Demo | Pilot / Production |
|---|---|---|---|
| **SAP Business Application Studio** | Development of CAP + Fiori apps | ✔ | ✔ |
| **CAP (Cloud Application Programming Model)**, Cloud Foundry runtime | Case service, agents' tools, orchestrator | ✔ | ✔ |
| **SAP HANA Cloud** | Cases and audit. Vector engine for grounding documents (e.g. customer penalty terms) | SQLite in-memory is fine | ✔ |
| **SAP AI Core + Generative AI Hub** (orchestration service) | LLM reasoning for agents, via SAP Cloud SDK for AI. Choice of models incl. Anthropic Claude, OpenAI GPT and Google Gemini | ✔ (needs the *extended* service plan) | ✔ |
| **SAP Build Work Zone, standard edition** | Launchpad, role-based spaces, notifications | ✔ | ✔ |
| **SAP Fiori elements / SAPUI5** | The three apps (§6) | ✔ | ✔ |
| **Joule + Joule Studio (in SAP Build)** | Conversational entry point. Low-code agent builder option (§5.2) | Optional | ✔ (license dependent) |
| **SAP Event Mesh** or **Advanced Event Mesh** | S/4HANA sales order events → case creation | Simulated | ✔ |
| **Destination + Connectivity services, Cloud Connector** | Secure access to S/4HANA Private Cloud. Also holds the sandbox URL + API key for the demo | ✔ (sandbox destination) | ✔ |
| **SAP Build Process Automation** | Optional: low-code approval tasks in My Inbox / SAP Task Center, if preferred over CAP actions | Optional | Optional |
| **Authorization & Trust Management (XSUAA)** + SAP Cloud Identity Services | Role collections per team | ✔ | ✔ |

**Check your global account's entitlements** for AI Core (extended plan), HANA Cloud, Work Zone and Joule before the demo build.

### 4.2 S/4HANA APIs the agents will use

API names below are from the SAP S/4HANA (private cloud / on-premise) API package on SAP Business Accelerator Hub. Confirm the version of each one against your release.

| Data | S/4HANA API | Used by |
|---|---|---|
| Sales orders, items, schedule lines, **delivery priority** | `API_SALES_ORDER_SRV` (Sales Order A2X) | A2, A3 |
| Product availability (basic ATP) | `API_PRODUCT_AVAILY_INFO_BASIC` (Product Availability Information) | A2, A3 |
| Stock per plant / storage location | `API_MATERIAL_STOCK_SRV` | A3 |
| BOM | `API_BILL_OF_MATERIAL_SRV` | A3 |
| Product master incl. MRP data (lot size) | `API_PRODUCT_SRV` | A3 |
| Planned / production orders | `API_PLANNED_ORDERS`, `API_PRODUCTION_ORDER_2_SRV` | A3, A4 |
| Work centers and capacity | `API_WORK_CENTERS` | A4 |
| Capacity **load per day** | Usually not a standard released API. Pilot: custom CDS view + RAP/OData service in S/4HANA Private Cloud | A4 |
| Events | Sales order business events (created / changed) | A2 |

### 4.3 Data adapter modes

Every tool reads through an adapter with three modes. The mode is set per data source (CAP `cds.requires` profiles), so the demo can mix them.

| Mode | Source | When |
|---|---|---|
| `mock` | Local CSV/JSON with the demo data in §8 | Scripted demo scenarios. Unit tests. |
| `sandbox` | `sandbox.api.sap.com`, using the base URL from each API's *Try out* page; API key sent in the `APIKey` header | Showing that real S/4HANA APIs and payloads work end to end |
| `s4` | Your S/4HANA Private Cloud through a BTP destination + Cloud Connector (principal propagation or technical user) | Pilot and rollout |

What the sandbox can and cannot do for this demo:
- ✔ Real **read** calls with real S/4HANA payload shapes, so the adapters and field mappings are proven before the pilot.
- ✘ **Shared, read-only, fixed data.** The sandbox will not contain our demo story (FG-100, SO-5005, overloaded work center, excess stock in plant 1100), and we can't create it there. So the **scripted scenarios run in `mock` mode**, and a "live data" view in each app shows the same tools working against the sandbox.
- ✘ **No live event stream.** Business Accelerator Hub documents the event specifications (topics and payloads), but it doesn't push events into your Event Mesh. In the demo, a "Simulate S/4 event" button posts a payload in exactly that format to the CAP event handler. In the pilot, events come from S/4HANA via **Enterprise Event Enablement** (channel to SAP Event Mesh, configured in `/IWXBE/CONFIG`).
- ✘ Capacity load per day is probably not in the sandbox (see the table above), so A4 load data stays `mock` until the custom CDS service exists.
- Keep the API key in a BTP destination (additional header) or a local `.env` that is never committed, not in code.

**Write-back rule:** the agents never write confirmed quantities or dates directly into sales order schedule lines. After a person approves a supply or production change, the change is executed in S/4HANA (planned order or stock transfer), and the **standard ATP check re-confirms the order**. S/4HANA stays the system of record.

---

## 5. How the agents are built

### 5.1 Agent anatomy

Every agent (A2–A5) follows the same pattern. That makes them testable and lets the demo run even if the LLM is unavailable.

```
 Trigger (event / user opens case)
     ▼
 Tools: deterministic CAP functions (read S/4 or mock data, calculate, simulate)  ← all numbers come from here
     ▼
 Reasoning: Generative AI Hub orchestration call
     • prompt template with the tool results as the only facts
     • data masking of customer names / prices
     • structured JSON output (schema-validated)
     ▼
 Recommendation record on the case (labelled "Suggested by agent", with rationale + confidence)
     ▼
 Human action in Fiori (Confirm / Reject / Choose option) → A1 Case Orchestrator
```

Rules that apply to all agents:
- **Agents never change a case status.** Only A1 does, and only in response to a human action (or an S/4 event).
- **Numbers, dates and quantities come only from tools**, never from LLM text. Output is checked: every number in the narrative must appear in the tool result. If not, the template text is used instead.
- **Every recommendation is stored**: inputs snapshot, output, model and prompt version, so we can later measure how often people accept suggestions.

### 5.2 Build option: pro-code vs Joule Studio

| | **Pro-code (recommended for the demo)** | **Joule Studio agent builder (low-code)** |
|---|---|---|
| Where the agent logic lives | CAP service + SAP Cloud SDK for AI (`@sap-ai-sdk/orchestration`, optional LangGraph) | Joule agent with instructions and skills in SAP Build |
| Tools | CAP functions | Same CAP functions, exposed as actions/skills via destinations |
| Strength | Full control, unit tests, works on a standard BTP account with AI Core | Native Joule chat experience, faster for business-led changes |
| Constraint | More code | Requires Joule / SAP Build licensing. Check feature availability in your region and release. |

**Recommendation:** build the **tool layer once as CAP APIs**. Run the agents pro-code for the demo. Expose the same tools to a Joule agent in the next phase, so users can also ask in chat, e.g. *"What's blocking FC-0001?"*. Before building, also check the SAP Business AI catalog / SAP Discovery Center for prebuilt Joule agents in order-to-cash and supply chain that could cover part of this scope in your release.

---

## 6. Fiori apps for the demo (custom, on BTP)

| App | Users | Floorplan | Key content | Actions |
|---|---|---|---|---|
| **Sales Order Feasibility** | Sales reps / Customer Service | Fiori elements List Report + Object Page | My open orders by priority, case status, waiting-for team, penalty-risk flag. Object page: agent recommendation, confirmed date, timeline, **drafted customer confirmation text** | Open case · Confirm to customer · Close |
| **Supply Planning Workbench** | Supply Chain Planners | List Report (worklist sorted by lane, then requested date) + Object Page with tree table | Material tree FG → SFG → RAW with required/available, **stock in other plants, open receipts, excess and slow-moving flags**, agent recommendation | Confirm from stock · Propose stock transfer · Request production check · Reject (reason required) · Confirm date to Sales |
| **Production Capacity Workbench** | Production Planners | Object Page with custom section (SAPUI5 chart or `sap.gantt`) | Load per work center per day **before vs after** for each option, frozen-horizon marker, load-balance score, impact on other orders | Choose option · Override frozen horizon (reason required) · Reject (reason required) |

All apps show the **same case ID (FC-nnnn)** and child request IDs (CR-nnnn) in the header, plus a shared **Case Timeline** section. In the connected phase, each app links to the matching standard app (e.g. the sales order in *Manage Sales Orders*, the material in *Monitor Material Coverage*, the work center in *Manage Work Center Capacity*) through intent-based navigation.

---

## 7. Agent blueprints

| ID | Agent | Main user | Pain points |
|---|---|---|---|
| A1 | Case Orchestrator | All (system) | P1, P2, P5, P6 |
| A2 | Order Intake & Prioritization Agent | Sales | P2, P6 |
| A3 | Supply & Inventory Agent | Supply Chain Planning | P2, P3 |
| A4 | Capacity & Load Balancing Agent | Production Planning | P4, P5 |
| A5 | Communication Agent | All | P1, P2, P6 |

A1 also owns the audit log and the case timeline.

---

### A1 · Case Orchestrator

**Mission.** Hold the single source of truth for each Order Feasibility Case: who has to act, by when, and what they are allowed to do.

**Type.** Deterministic CAP service. **No LLM.**

**Triggers.** Human actions from the Fiori apps (OData V4 bound actions), S/4 events (from A2).

**Case model**

```
OrderFeasibilityCase  FC-nnnn
  salesOrder, item, customer, material, plant, quantity, requestedDate, priority, lane
  penaltyRisk (amount/flag), status, waitingForRole
  supplyResult        (snapshot from A3)
  recommendation[]    (from A2/A3/A4)
  decision[]          (human decisions)
  capacityRequests[]  → CapacityRequest CR-nnnn (parentCase REQUIRED)
                          options[], chosenOption, status, decidedBy/At, reason
  confirmedDate, confirmedQty, version
```

**Status model**

| Status | Waiting for | Allowed next | Triggered by |
|---|---|---|---|
| `NEW` | (system) | `WITH_SUPPLY_PLANNING`, `AUTO_CONFIRMED` | A2 on intake |
| `AUTO_CONFIRMED` | none | final | NORMAL lane, ATP confirmed in full on time |
| `WITH_SUPPLY_PLANNING` | Supply Chain Planner | `SUPPLY_CONFIRMED`, `WITH_PRODUCTION`, `REJECTED` | Planner action |
| `WITH_PRODUCTION` | Production Planner | `PRODUCTION_CONFIRMED`, `PRODUCTION_REJECTED` | Production Planner action |
| `PRODUCTION_CONFIRMED` | Supply Chain Planner | `SUPPLY_CONFIRMED`, `REJECTED` | Planner action |
| `PRODUCTION_REJECTED` | Supply Chain Planner | `WITH_PRODUCTION` (new CR), `REJECTED` | Planner action |
| `SUPPLY_CONFIRMED` | Sales | `CONFIRMED_TO_CUSTOMER` | Sales action |
| `REJECTED` | Sales | `CLOSED` (Sales informs customer / proposes alternative date) | Sales action |
| `CONFIRMED_TO_CUSTOMER` | none | final | |
| `CLOSED` | none | final | |

**Business rules (enforced server-side, not just by hiding buttons)**
1. Only the role in `waitingForRole` can act on a case.
2. *Confirm to customer* is only allowed in `SUPPLY_CONFIRMED`.
3. *Confirm date to Sales* after a production check is only allowed when the active CR is `PRODUCTION_CONFIRMED`.
4. Every *Reject* and every *frozen-horizon override* requires a reason. *Confirm* takes an optional comment.
5. A `CapacityRequest` cannot exist without a parent case.
6. Every action writes an audit entry **in the same transaction**. No audit, no status change.
7. Optimistic locking (`version`) and an idempotency key on each action.

**Audit log.** Append-only table: case/CR, action, actor, role, timestamp, previous → new status, comment/reason, payload, and the agent recommendation shown with whether it was accepted. There is no update or delete.

**Case timeline.** A read-only view of the audit log per case, across all its child CRs: *Intake → Supply check → Production check → Supply decision → Customer confirmation*, with the time each step took. It is shown as a section on the object page of all three apps.

**Tests.** Every allowed and forbidden transition; wrong role per action; reject without reason; confirm to customer in every non-allowed status; CR without parent; concurrent update; exactly one audit row per status change.

---

### A2 · Order Intake & Prioritization Agent

**Mission.** Make sure no important order waits. Detect new or changed orders, assign the lane, flag penalty risk and open the case with everything the next team needs.

**Triggers.** S/4 event *SalesOrder Created/Changed* (demo: "Simulate new order" button), or Sales clicks *Check feasibility* on an order.

**Tools**

| Tool | Source |
|---|---|
| `getSalesOrder(so)` | `API_SALES_ORDER_SRV` / mock |
| `getCustomer(id)` incl. penalty terms | Business partner API / mock. Contract terms as grounding documents in HANA vector store |
| `runAvailabilityCheck(material, plant, qty, date)` | `API_PRODUCT_AVAILY_INFO_BASIC` / mock |
| `openCase(...)` | A1 |

**Priority mapping (delivery priority → lane)**

Delivery priority is an **item-level** field on the sales order (defaulted from the customer master's sales area data). Its values are customer-specific customizing (two-digit keys). So the mapping is a configuration table in the CAP app, not hard-coded:

| Delivery priority (example keys, **replace with your customizing values**) | Lane |
|---|---|
| `01` | HIGH |
| `02` | MEDIUM |
| `03` and above, or blank | NORMAL |

- One case per **sales order item** that needs attention. Different items of one order can be in different lanes. The Sales app groups them by order.
- In `API_SALES_ORDER_SRV` read the item entity's delivery priority field. Check the exact property name in the sandbox `$metadata` while building the adapter.
- If delivery priority changes on an open order (sales order *Changed* event), A2 re-evaluates the lane and A1 records the change in the audit log. An upgrade to HIGH moves the case into the fast lane and to the top of the worklists.

**Logic**
1. Read the order item and map its delivery priority to a lane (table above). If the customer has a penalty clause and the item is not HIGH, *suggest* raising the delivery priority (Sales decides and changes it in S/4HANA).
2. Run the availability check.
   - NORMAL and fully confirmed on time → `AUTO_CONFIRMED`. No people involved.
   - Otherwise → open case with the lane from the priority mapping.
3. **LLM step:** write a 2–3 line case summary for the planner (*"ABC Automotive needs 100 × FG-100 by D+5. No stock in plant 1000. Penalty clause: 2% of order value per day late."*) and, from the contract grounding, extract the penalty rule.

**Output.** Case `FC-nnnn` with lane, `penaltyRisk`, summary, ATP result.

**Guardrails.** Does not change the order priority itself; it only suggests. Penalty amounts come from contract data, not from the LLM's own guess. If grounding finds no clause, it says "no penalty clause found".

**Benefit.** Time from order creation to case in the planner's worklist: from hours/days to seconds.

---

### A3 · Supply & Inventory Agent

**Mission.** Give the Supply Chain Planner a complete supply picture in one screen and recommend the option that **meets the date with the least new inventory**.

**Triggers.** Case enters `WITH_SUPPLY_PLANNING`. Planner opens the case. A capacity request is answered.

**Tools**

| Tool | Purpose | Source |
|---|---|---|
| `explodeBom(material, plant, qty)` | FG → SFG → RAW requirements | `API_BILL_OF_MATERIAL_SRV` / mock |
| `getStock(material, plants[])` | Unrestricted stock per plant and storage location | `API_MATERIAL_STOCK_SRV` / mock |
| `getOpenReceipts(material, plant)` | Planned/production orders and POs not yet pegged | `API_PLANNED_ORDERS`, `API_PRODUCTION_ORDER_2_SRV` / mock |
| `getSlowMovers(material)` | Days since last movement, months of supply | Stock + consumption history / mock |
| `simulateLeftover(material, need, lotSizePolicy)` | Excess created by production lot size | Material master MRP data / mock |
| `findReallocationCandidates(material, needDate)` | Stock/receipts reserved for lower-priority orders whose own date would still hold | Sales orders + ATP / mock |

**Decision ladder.** Deterministic. The first option that meets the date is recommended. All feasible options are shown.

| Rank | Option | Why it ranks here |
|---|---|---|
| 1 | Confirm from local stock / open receipt | No new inventory, no transport |
| 2 | **Stock transfer** from another plant (prefer slow-moving / excess stock) | Turns excess into a sale (P3) |
| 3 | Reallocate from a lower-priority order whose own date still holds | No new inventory. Needs the planner's approval. Without Advanced ATP, S/4HANA won't do this itself: after approval, the confirmation is moved in S/4HANA (the lower-priority order is re-confirmed later, the HIGH order is re-checked). |
| 4 | Produce (→ production check). Show leftover from lot size and its value. | Last resort for inventory. Flags excess. |
| 5 | Reject / propose the earliest possible date | When nothing meets the date |

**Excess-inventory guard.** For option 4, if the lot-size leftover is above *X* days of supply (configurable), add a warning and propose exact lot size for this order. The planner decides.

**LLM step.** Explain the recommendation in plain words and draft the message to Sales or the production check question (*"Can we produce 100 × FG-100 by D+3? RAW-1 and RAW-2 are available. Plant 1100 has no FG-100 stock."*).

**Human actions (via A1).** Confirm from stock · Approve stock transfer · Request production check · Reject (reason) · Confirm date to Sales.

**Guardrails.** Doesn't create stock transfers or planned orders itself. In the connected phase, an approved transfer creates a **proposal** (e.g. an STO request) that is posted in S/4 by the planner or by an approved, auditable API call.

---

### A4 · Capacity & Load Balancing Agent

**Mission.** Give the Production Planner ready-made, scored options to fit the order in, preferring **free capacity on alternative resources** over disrupting the near-term plan.

**Triggers.** A capacity request `CR-nnnn` is created (case → `WITH_PRODUCTION`).

**Tools**

| Tool | Source |
|---|---|
| `getWorkCenters(material, plant)` incl. alternatives (production versions / alternative routings) | `API_WORK_CENTERS`, routing / production version data / mock |
| `getLoad(workCenter, from, to)` | Capacity load (CDS-based custom API) / mock |
| `getScheduledOrders(workCenter, from, to)` | Planned/production orders / mock |
| `simulate(option)` | Pure function: new load per day, moved orders, their new completion vs delivery date |
| `score(option)` | Pure function, see below |

**Options generated**
- **O-ALT:** produce on an alternative work center with free capacity (may split across days).
- **O-MOVE:** move one or more lower-priority orders later on the primary work center.
- **O-SPLIT:** partial quantity now, the rest later (only if Sales allows partial delivery).
- **O-OVERTIME:** extra shift (flagged as cost).

**Scoring** (lower is better; weights configurable)

```
score = w1 · peakUtilization(after)              // avoid overload
      + w2 · utilizationSpread(after)            // load balancing across work centers
      + w3 · frozenHorizonViolations             // near-term stability (P5)
      + w4 · daysLateForMovedOrders              // never break other customers' dates
      + w5 · setupChanges + w6 · overtimeHours
infeasible if HIGH order date missed or any moved order becomes late
```

**Frozen horizon.** Orders already scheduled in the next *N* days (demo: 3) are frozen. Options that move them are allowed but marked **"needs override"**, and choosing them requires a reason. New orders may use *free* capacity inside the frozen window.

**LLM step.** Compare the top options in 3–4 sentences (*"O-ALT keeps SO-5004 unchanged and lifts ASSY-02 from 30% to 100% on D+2. O-MOVE needs a frozen-horizon override."*). Draft the planner's comment.

**Human actions (via A1).** Choose option (+ comment) · Choose override option (+ reason) · Reject (reason).

**Guardrails.** Simulation only. Nothing is rescheduled in S/4. In the connected phase, the chosen option becomes a task for the planner to execute in *Manage Production Orders* / *Capacity Scheduling Board* (classic capacity planning), linked from the case.

---

### A5 · Communication Agent

**Mission.** Replace phone and email with short, complete, actionable messages, and give Sales a ready-to-send customer confirmation.

**Triggers.** Every status change from A1.

**Routing**

| Event | To | Message contains | Deep link |
|---|---|---|---|
| Case opened (HIGH/MEDIUM) | Supply Chain Planners (plant) | Summary, priority, requested date, penalty risk | Supply Planning Workbench → FC |
| Production check requested | Production Planners | Question, material status, need-by date, options ready | Production Capacity Workbench → CR |
| Production confirmed / rejected (+reason) | Supply Chain Planner | Chosen option, date, comment / reason | Supply Planning Workbench → FC |
| Supply confirmed | Sales rep | Confirmed date and qty, decision trail, **draft customer message** | Sales Order Feasibility → FC |
| Rejected (+reason) | Sales rep | Reason, earliest possible date, alternatives | Sales Order Feasibility → FC |
| Confirmed to customer | Supply Chain + Production | Closure info | Case Timeline |

**Channels.** Work Zone notifications (demo). Later: email, Microsoft Teams, My Inbox / SAP Task Center.

**LLM step.** Draft the customer confirmation (or delay) message in the customer's language and tone, using only case facts. Sales edits and sends it. The agent never sends to customers itself.

**Guardrails.** Dates, quantities, IDs and reasons are inserted from data and checked after generation. Notifications are informational. Actions are always re-validated by A1 when the user opens the link.

---

## 8. Demo storyline and data

All dates are relative to the demo day (D). Plant 1000 is the main plant; plant 1100 is the second plant.

### 8.1 Master data

| Object | Data |
|---|---|
| Customers | `C-1001` ABC Automotive (penalty 2%/day late), `C-1002` Delta Machines, `C-1003` Nova Retail |
| Materials | `FG-100` Gearbox Assembly · `SFG-200` Gear Housing · `RAW-1` Aluminium Casting · `RAW-2` Bearing Set · `FG-300` Pump Unit |
| BOM (per 1) | FG-100 → 1 SFG-200 · SFG-200 → 1.05 RAW-1 + 0.05 RAW-2 |
| Stock plant 1000 | FG-100: 0 · SFG-200: 0 · RAW-1: 150 · RAW-2: 20 · FG-300: 20 |
| Stock plant 1100 | FG-300: 200 (last movement 120 days ago, demand 25/month → 8 months of supply = **excess**) |
| Work centers plant 1000 | `WC-MACH-01` machining 200/day · `WC-ASSY-01` assembly 100/day (primary for FG-100) · `WC-ASSY-02` assembly 80/day (alternative production version) |
| Frozen horizon | D+0 … D+3 |

### 8.2 Load before the HIGH order

| Work center | D+1 | D+2 | D+3 | D+4 | D+5 |
|---|---|---|---|---|---|
| WC-MACH-01 | 40% | 50% | 30% | 30% | 20% |
| WC-ASSY-01 | 100% (SO-5001) | 100% (**SO-5004**, NORMAL, 100 × FG-100, due D+9) | 90% | 60% | 50% |
| WC-ASSY-02 | 40% | 30% | 25% | 20% | 20% |

### 8.3 Scenarios

**Scenario 1: HIGH order, production needed, load balancing (main demo)**
- `SO-5005`, C-1001, 100 × FG-100, priority HIGH, requested D+5 (must be produced by D+3).
- A2: HIGH lane, penalty risk flagged, case **FC-0001** at the top of the Supply Chain Planning worklist.
- A3: FG 0/100, SFG 0/100, RAW-1 150/105 ✔, RAW-2 20/5 ✔, no stock in plant 1100, no reallocation candidate → recommends **production check**. Lot size = exact, so no leftover.
- Planner requests the production check → **CR-0001**.
- A4 options:
  - **O-ALT** (recommended): machining 100 on WC-MACH-01 D+1 (40% → 90%), assembly on WC-ASSY-02 56 on D+2 + 44 on D+3 (30% → 100%, 25% → 80%). No order moved. Finishes D+3 ✔.
  - **O-MOVE**: SO-5004 moved D+2 → D+4 on WC-ASSY-01 (inside the frozen horizon → **needs override**). SO-5004 still on time for D+9. WC-ASSY-01 D+4 becomes 160%, so SO-5004 must be split or it is infeasible → shown with a lower score.
- Production Planner chooses O-ALT → case `PRODUCTION_CONFIRMED`. Planner confirms D+5 to Sales. A5 drafts the customer email. Sales confirms → `CONFIRMED_TO_CUSTOMER`.
- Case timeline: answered in minutes instead of days, frozen horizon untouched, load spread across both assembly lines.

**Scenario 2: MEDIUM order, excess stock used instead of production**
- `SO-5006`, C-1002, 50 × FG-300, MEDIUM, requested D+6. Plant 1000 has 20.
- A3 recommends a **stock transfer of 30 from plant 1100** (slow-moving excess) instead of producing → planner approves → Sales confirms. Result: 30 units of excess stock turned into a sale; no new production.

**Scenario 3: NORMAL order, no human step**
- `SO-5007`, C-1003, 10 × FG-300, NORMAL. ATP confirms from stock in plant 1000 → `AUTO_CONFIRMED`. Visible in the Sales Order Feasibility list only; no team gets a task.

**Scenario 4: rejection loop**
- Variant of scenario 1 where WC-ASSY-02 is down for maintenance. The Production Planner rejects with the reason *"No capacity before D+6 without moving frozen orders"*. A3 proposes the earliest date D+7 → planner rejects to Sales with that date → A5 drafts a delay message with the alternative date.

**Scenario 5: guardrail**
- Sales tries *Confirm to customer* while the case is `WITH_PRODUCTION` → refused by A1, shown in the timeline as a refused action.

---

## 9. Roadmap

| Phase | Scope | Data | Outcome |
|---|---|---|---|
| **0 · Prerequisites** (1–2 wks) | BTP subaccount, entitlements (AI Core extended, HANA Cloud, Work Zone), role collections. Business Accelerator Hub API key + sandbox destination. Delivery priority customizing values | – | Ready environment |
| **1 · Demo** (4–6 wks) | A1–A5 in CAP, 3 Fiori apps, Work Zone site, Generative AI Hub, scenarios 1–5, "live data" view against the sandbox, simulated S/4 events | `mock` for scenarios, `sandbox` for live reads (§4.3) | Clickable end-to-end demo for the business |
| **2 · Pilot** (6–8 wks) | S/4HANA Private Cloud via destination + Cloud Connector. Activate the OData services. Enterprise Event Enablement → Event Mesh. Custom CDS service for capacity load. Joule agent on the same tools. One plant, HIGH lane only | `s4` read-only | Measured lead time vs baseline |
| **3 · Rollout** | All lanes and plants. Controlled write-back (stock transfer proposals, planned order changes via approved APIs, ATP re-check). Teams / email channels. | S/4 read + controlled write | Production use |

**Baseline now.** To prove value, capture today's numbers before the pilot: average confirmation lead time per priority, penalty cost per quarter, excess-stock value and work center overload days.

---

## 10. Open decisions

Decided: S/4HANA Private Cloud · sandbox APIs for the demo · no Advanced ATP · no PP/DS · priority from delivery priority (§0).

1. **S/4HANA release** (e.g. 2022 / 2023) of the Private Cloud system. This fixes the API versions and Fiori app availability.
2. **Delivery priority values** used in your customizing, and which ones mean HIGH, MEDIUM and NORMAL (§7 A2).
3. Is delivery priority **maintained reliably** today (customer master default + manual changes on orders), or does it need a cleanup before the pilot?
4. **Frozen horizon** length per plant, and who may override it.
5. Where are **customer penalty terms** stored (contract documents, condition records, CRM)?
6. **Licensing:** AI Core / Generative AI Hub, Joule and Joule Studio, SAP Build. Is a Joule-based front end required for the demo, or is it a phase-2 item?
7. Allowed **LLM models** and data-privacy rules (e.g. customer names masked before LLM calls).

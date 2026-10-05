# Sales-to-Planning Order Confirmation Agents on SAP BTP (trial, without SAP AI Core)

**Solution blueprint · Demo phase · BTP trial variant**

This is the variant of `blueprint-with-aicore.md` for a **SAP BTP trial account**. The process, agents, apps, business rules and demo data are the same. What changes:

| Topic | `blueprint-with-aicore.md` | This variant |
|---|---|---|
| BTP account | Enterprise / pay-as-you-go | **BTP trial** (Cloud Foundry) |
| LLM access | SAP AI Core + Generative AI Hub (SAP Cloud SDK for AI) | **Anthropic Claude API called directly from the CAP app** (`@anthropic-ai/sdk`) |
| Masking, content filtering, output validation | Generative AI Hub orchestration modules | **Implemented in the CAP app** (§5.2) |
| Grounding documents | HANA Cloud vector engine | Contract clause text stored on the customer record and passed into the prompt (small, demo-sized) |
| Conversational entry point | Joule / Joule Studio (later phase) | **Order Assistant**, a simple chat Fiori app (§6.2) |
| Events | SAP Event Mesh | Simulated (Event Mesh is not available on trial) |

---

## 0. Confirmed landscape

| Topic | Decision |
|---|---|
| ERP | **SAP S/4HANA Private Cloud** |
| APIs and events for the demo | Available on the **SAP Business Accelerator Hub sandbox** (api.sap.com) |
| Advanced ATP (Backorder Processing, Product Allocation) | **Not active.** Basic ATP only. |
| Embedded PP/DS | **Not active.** Classic PP capacity planning only. |
| Priority source | Sales order **delivery priority** (see §7 A2 for the mapping) |
| BTP account for the demo | **SAP BTP trial**, Cloud Foundry environment. No SAP AI Core. |
| LLM | **Anthropic Claude models via the Claude API**, called from the CAP service |
| Chat | **Order Assistant** Fiori app instead of Joule |

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
        │ business event (simulated in the demo)
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

At any step, any user can ask the **Order Assistant** (§6.2) about a case, e.g. *"What's blocking FC-0001?"*. The assistant reads; it never acts.

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

## 4. Solution architecture on SAP BTP (trial)

```
┌──────────────────────────── SAP Build Work Zone, standard edition (launchpad, role-based spaces) ───────────────────────────┐
│  Sales Order            Supply Planning           Production Capacity           Order Assistant                         │
│  Feasibility (Sales)    Workbench (SCP)           Workbench (Production)        (chat, all roles, read-only)            │
│  └─ links to standard apps: Manage Sales Orders · Monitor Material Coverage · Manage Work Center Capacity                │
└───────────────┬────────────────────────────────────────────────────────────────────┬─────────────────────────▲────────────┘
                │ OData V4 (actions: Submit / Confirm / Reject / Choose option)       │ OData V4 action ask()   │ notifications
                ▼                                                                    ▼                         │
┌──────────────────────────── CAP application (Node.js) on Cloud Foundry (trial) ──────────────────────────────────────────────┐
│  A1 Case Orchestrator (state machine, business rules, authorization, audit log, case timeline)                             │
│  A2 Order Intake · A3 Supply & Inventory · A4 Capacity & Load Balancing · A5 Communication                               │
│  Order Assistant service (chat, read-only tools, uses A1 authorization)                                                   │
│  LLM client (anthropic | mock) · masking · output validation · prompt templates                                           │
│  Tool layer: deterministic functions (ATP, BOM, stock, capacity, simulate) ── Adapters (mock | sandbox | s4)              │
└──────┬─────────────────────────┬─────────────────────────────────┬───────────────────────────────┬──────────────────────────┘
       │ persistence             │ HTTPS (LLM calls)               │ simulated events              │ S/4 APIs
       ▼                         ▼                                 ▼                               ▼
 SQLite (demo, seeded      Anthropic Claude API            "Simulate S/4 event" button     Destination service →
 at start) or HANA Cloud   api.anthropic.com               posts the S/4 event payload     sandbox.api.sap.com
 trial                     (API key from a bound           to the CAP event handler        (APIKey header)
                           user-provided service)
```

### 4.1 BTP services

| Service | Purpose here | Available on trial | Demo (trial) | Pilot / Production |
|---|---|---|---|---|
| **SAP Business Application Studio** | Development of CAP + Fiori apps | ✔ | ✔ | ✔ |
| **CAP**, Cloud Foundry runtime | Case service, agents, tools, orchestrator, chat service | ✔ (limited memory quota) | ✔ | ✔ |
| **SQLite** (in the CAP app) | Cases, audit, chat history. Reseeded from the §8 data at app start | n/a | ✔ (default) | ✘ |
| **SAP HANA Cloud** | Persistent cases and audit | ✔ trial instance (stops every night, must be restarted) | Optional | ✔ |
| **Anthropic Claude API** (external, not a BTP service) | LLM reasoning for agents A2–A5 and the Order Assistant | n/a, needs an Anthropic Console account and API key | ✔ | ✔, or switch to AI Core (§5.2) |
| **SAP Build Work Zone, standard edition** | Launchpad, role-based spaces, notifications | ✔ | ✔ | ✔ |
| **SAP Fiori elements / SAPUI5** | The three case apps and the Order Assistant (§6) | ✔ | ✔ | ✔ |
| **HTML5 Application Repository** + managed approuter | Hosting the Fiori apps for Work Zone | ✔ | ✔ | ✔ |
| **Destination service** | Sandbox URL + API key (additional header). Later: S/4HANA | ✔ | ✔ | ✔ |
| **Connectivity service + Cloud Connector** | Access to S/4HANA Private Cloud | ✔ technically, but not for productive data | ✘ | ✔ |
| **Authorization & Trust Management (XSUAA)** | Role collections per team | ✔ | ✔ | ✔ |
| **SAP Event Mesh / Advanced Event Mesh** | S/4 sales order events → case creation | ✘ | Simulated | ✔ |
| **SAP AI Core + Generative AI Hub** | Not used in this variant | ✘ | ✘ | Optional (§5.2) |
| **Joule / Joule Studio** | Not used. The Order Assistant replaces it | ✘ | ✘ | Later option |

Trial limits change over time (account duration, regions, memory quota, which services are offered). **Check the current trial terms in the BTP cockpit before the build.**

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
| `mock` | Local CSV/JSON with the demo data in §8 | Scripted demo scenarios. Offline demo. |
| `sandbox` | `sandbox.api.sap.com`, using the base URL from each API's *Try out* page; API key sent in the `APIKey` header | Showing that real S/4HANA APIs and payloads work end to end |
| `s4` | Your S/4HANA Private Cloud through a BTP destination + Cloud Connector (principal propagation or technical user) | Pilot and rollout (not on trial) |

What the sandbox can and cannot do for this demo:
- ✔ Real **read** calls with real S/4HANA payload shapes, so the adapters and field mappings are proven before the pilot.
- ✘ **Shared, read-only, fixed data.** The sandbox will not contain our demo story (FG-100, SO-5005, overloaded work center, excess stock in plant 1100), and we can't create it there. So the **scripted scenarios run in `mock` mode**, and a "live data" view in each app shows the same tools working against the sandbox.
- ✘ **No live event stream.** Business Accelerator Hub documents the event specifications (topics and payloads), but it doesn't push events anywhere, and Event Mesh is not on trial. In the demo, a "Simulate S/4 event" button posts a payload in exactly that format to the CAP event handler. In the pilot, events come from S/4HANA via **Enterprise Event Enablement** (channel to SAP Event Mesh, configured in `/IWXBE/CONFIG`).
- ✘ Capacity load per day is probably not in the sandbox (see the table above), so A4 load data stays `mock` until the custom CDS service exists.
- Keep the API key in a BTP destination (additional header) or a local `.env` that is never committed, not in code.

**Write-back rule:** the agents never write confirmed quantities or dates directly into sales order schedule lines. After a person approves a supply or production change, the change is executed in S/4HANA (planned order or stock transfer), and the **standard ATP check re-confirms the order**. S/4HANA stays the system of record.

### 4.4 Connecting to the Claude API

| Topic | Decision |
|---|---|
| SDK | Official Anthropic TypeScript/JavaScript SDK, `@anthropic-ai/sdk`, in the CAP Node.js app. No hand-written HTTP calls. |
| Endpoint | `https://api.anthropic.com` (outbound HTTPS from Cloud Foundry; no Cloud Connector needed) |
| API key, deployed | A **user-provided service** (e.g. `anthropic-api`, created with `cf create-user-provided-service`) bound to the CAP app. The LLM client reads the key from the binding at start. Rotating the key = update the service + restage. |
| API key, local | `.env` / `default-env.json`, listed in `.gitignore`. **Never commit the key**, never put it in `mta.yaml` or `manifest.yml`. |
| Spend control | Separate Anthropic Console workspace for this demo, with a monthly spend limit. Usage per call is logged (§5.2). |
| Models | Configurable per agent in `cds.requires.llm` (§5.2). Default: `claude-opus-5-5`. Cheaper options (`claude-sonnet-5-5`, `claude-haiku-4-5`) are a configuration change, decided after measuring quality on the demo scenarios. |
| Data leaving BTP | Prompts go to Anthropic, outside SAP BTP. Customer names and prices are masked before the call (§5.2). Only demo data is used on trial. **Get the data-privacy officer's approval before any real S/4 data is sent** (§10). |

---

## 5. How the agents are built

### 5.1 Agent anatomy

Every agent (A2–A5) follows the same pattern. That makes them testable and lets the demo run even if the LLM is unavailable.

```
 Trigger (event / user opens case)
     ▼
 Tools: deterministic CAP functions (read S/4 or mock data, calculate, simulate)  ← all numbers come from here
     ▼
 Reasoning: LLM client → Claude Messages API
     • versioned prompt template; the tool results are the only facts
     • masking of customer names / prices before the call, unmasking after
     • structured JSON output (output_config.format with a JSON schema), validated again in CAP
     ▼
 Recommendation record on the case (labelled "Suggested by agent", with rationale + confidence)
     ▼
 Human action in Fiori (Confirm / Reject / Choose option) → A1 Case Orchestrator
```

Rules that apply to all agents:
- **Agents never change a case status.** Only A1 does, and only in response to a human action (or an S/4 event).
- **Numbers, dates and quantities come only from tools**, never from LLM text. Output is checked: every number in the narrative must appear in the tool result. If not, the template text is used instead.
- **Every recommendation is stored**: inputs snapshot, output, model ID and prompt version, so we can later measure how often people accept suggestions.

### 5.2 LLM client layer (replaces the Generative AI Hub orchestration)

On trial there is no orchestration service, so the CAP app has one small **LLM client module** that all agents and the Order Assistant call. Agents never import the Anthropic SDK directly.

| Concern | How it is handled |
|---|---|
| **Modes** | `anthropic` (real calls) and `mock` (deterministic template text, no network). The offline demo uses `mock`. Same switch pattern as the data adapters. |
| **Model and effort per agent** | Config, e.g. `cds.requires.llm.agents.A3 = { model, effort, maxTokens }`. Short drafts (A2 summary, A5 messages) run at low effort; A3/A4 explanations and the chat at medium. |
| **Structured output** | Each agent defines a JSON schema for its output and sends it as `output_config.format`. CAP validates the parsed result again before storing it. Invalid → template text. |
| **Masking** | Before the call: customer names, customer IDs and prices are replaced by tokens (`<CUSTOMER_1>`, `<PRICE_1>`). After the call: tokens are replaced back. Material, plant and order IDs stay (needed for the reasoning, not personal data). The masking map never leaves CAP. |
| **Content safety** | Check `stop_reason` before reading content. On `refusal` or `max_tokens`, use the template text and log it. Server-side model fallback (`fallbacks: "default"`) is enabled on the request. |
| **Number check** | Every number and date in the generated text must appear in the tool result snapshot (§5.1). Failures fall back to the template and are logged. |
| **Prompt injection** | User-entered text (comments, reject reasons, chat questions) is passed as clearly delimited data, never appended to the system prompt. The LLM has no write tools anywhere, so injected text can't trigger an action. |
| **Prompt caching** | System prompts and tool definitions are fixed per version and placed first, so repeated calls reuse the cache. |
| **Timeouts and retries** | SDK retries (429, 5xx, network) with a short timeout. If the LLM fails, the agent stores the recommendation with template text and the flag "LLM unavailable". The case flow never waits on the LLM. |
| **Logging** | Per call: agent, case ID, model ID, prompt version, input/output tokens, latency, fallback used yes/no. No API key, no unmasked customer data in logs. |

**Switching back to SAP AI Core later.** Generative AI Hub also offers Anthropic Claude models. If the pilot account has AI Core, add a third LLM client mode (`aicore`, via SAP Cloud SDK for AI). Agents, prompts, schemas and checks stay the same.

### 5.3 Order Assistant instead of Joule

| | `blueprint-with-aicore.md` | This variant |
|---|---|---|
| Chat front end | Joule (needs Joule / SAP Build licensing, not on trial) | **Order Assistant**: SAPUI5 chat app in Work Zone (§6.2) |
| Chat back end | Joule agent with skills calling the CAP tools | CAP service `OrderAssistantService` → Claude with tool use over **read-only** CAP tools |
| Tools | Same CAP functions | Same CAP functions, plus case read functions from A1 |

The tool layer is still built once as CAP functions, so a Joule front end can be added later on the same tools without changing the agents.

---

## 6. Fiori apps for the demo (custom, on BTP)

The demo has the **three case apps** from `blueprint-with-aicore.md` plus the **Order Assistant** chat app. No analytical apps, dashboards or KPI cockpit.

### 6.1 Case apps

| App | Users | Floorplan | Key content | Actions |
|---|---|---|---|---|
| **Sales Order Feasibility** | Sales reps / Customer Service | Fiori elements List Report + Object Page | My open orders by priority, case status, waiting-for team, penalty-risk flag. Object page: agent recommendation, confirmed date, timeline, **drafted customer confirmation text** | Open case · Confirm to customer · Close |
| **Supply Planning Workbench** | Supply Chain Planners | List Report (worklist sorted by lane, then requested date) + Object Page with tree table | Material tree FG → SFG → RAW with required/available, **stock in other plants, open receipts, excess and slow-moving flags**, agent recommendation | Confirm from stock · Propose stock transfer · Request production check · Reject (reason required) · Confirm date to Sales |
| **Production Capacity Workbench** | Production Planners | Object Page with custom section (SAPUI5 chart or `sap.gantt`) | Load per work center per day **before vs after** for each option, frozen-horizon marker, load-balance score, impact on other orders | Choose option · Override frozen horizon (reason required) · Reject (reason required) |

All apps show the **same case ID (FC-nnnn)** and child request IDs (CR-nnnn) in the header, plus a shared **Case Timeline** section. In the connected phase, each app links to the matching standard app (e.g. the sales order in *Manage Sales Orders*, the material in *Monitor Material Coverage*, the work center in *Manage Work Center Capacity*) through intent-based navigation.

Each case app also has an **"Ask about this case"** button that opens the Order Assistant with the case ID already in context.

### 6.2 Order Assistant (chat app)

**Mission.** Let any user ask questions about cases in plain language, instead of phoning another team. It answers from the same data the case apps show, and links to the app where the user can act.

**Users.** All three roles. Each user sees only the cases their role may see (same A1 authorization as the case apps).

**UI.** SAPUI5 freestyle app (a chat doesn't fit a Fiori elements floorplan), in its own Work Zone tile:
- Message list with the user's questions and the assistant's answers.
- Answers can contain **data cards** built from tool results, not from LLM text: a case header card (ID, lane, status, waiting for, requested/confirmed date), a small table (e.g. material tree or capacity options) and **deep links** ("Open FC-0001 in Supply Planning Workbench").
- Suggested questions as chips when the chat is empty.
- Start from a case: when opened from a case app, the case ID is shown as context at the top.
- "New conversation" button. Each answer is labelled "Generated by AI, check the data cards".

**Example questions**
- *"What's blocking FC-0001?"*
- *"Show my HIGH cases waiting for me."*
- *"Why did A3 recommend a production check for SO-5005?"*
- *"Compare the capacity options for CR-0001."*
- *"Which cases have penalty risk this week?"*

**Back end.** CAP service `OrderAssistantService` with one action `ask(conversationId, caseId?, message)` that returns `{ answerText, cards[], links[] }`.
- Claude is called with **tool use**. The tool loop runs in CAP with a maximum number of tool calls per question (e.g. 6).
- Tools (all **read-only**, all strict JSON schemas, all run with the user's identity and role):

| Tool | Returns |
|---|---|
| `listCases(filter)` | Cases the user may see, filtered by lane, status, waiting-for role, penalty risk, date range |
| `getCase(caseId)` | Case header, status, waiting for, latest recommendations and decisions |
| `getCaseTimeline(caseId)` | Timeline steps with time per step |
| `getSupplyPicture(caseId)` | A3 tool result: material tree, stock per plant, receipts, excess flags |
| `getCapacityOptions(crId)` | A4 tool result: options, load before/after, scores, frozen-horizon flags |
| `getSalesOrder(so)` | Order item, delivery priority, requested date (through the data adapter) |

- **No write tools.** The assistant cannot confirm, reject, choose options or change anything. When the user asks it to act (*"confirm FC-0001"*), it answers with the deep link to the app and the action to press there.
- **Conversation storage.** `ChatConversation` and `ChatMessage` entities per user (question, answer, tool calls made, model ID, tokens). Only the owner can read them. Demo retention: cleared on app restart.

**Guardrails**
- Same number check as the agents: every number, date and ID in the answer text must appear in the tool results of that turn. If not, the text is replaced by *"I couldn't verify this answer. See the data below."* and only the cards are shown.
- Same masking as §5.2. Same "LLM unavailable" fallback: the app shows the cards for the case ID in the question, without generated text.
- Out-of-scope questions (not about cases, orders, supply or capacity) get a short "I can only answer questions about order feasibility cases" reply.
- Never called "copilot" in the UI, texts or code. The name is **Order Assistant**.

**Benefit.** Answers like *"waiting for Production Planning since 10:42, two options ready, O-ALT recommended"* in seconds, without a phone call (P1, P2).

---

## 7. Agent blueprints

| ID | Agent | Main user | Pain points |
|---|---|---|---|
| A1 | Case Orchestrator | All (system) | P1, P2, P5, P6 |
| A2 | Order Intake & Prioritization Agent | Sales | P2, P6 |
| A3 | Supply & Inventory Agent | Supply Chain Planning | P2, P3 |
| A4 | Capacity & Load Balancing Agent | Production Planning | P4, P5 |
| A5 | Communication Agent | All | P1, P2, P6 |

A1 also owns the audit log and the case timeline. The Order Assistant (§6.2) is a read-only front end over the same tools, not a sixth agent: it produces no recommendations and is not part of the case flow.

---

### A1 · Case Orchestrator

**Mission.** Hold the single source of truth for each Order Feasibility Case: who has to act, by when, and what they are allowed to do.

**Type.** Deterministic CAP service. **No LLM.**

**Triggers.** Human actions from the Fiori apps (OData V4 bound actions), S/4 events (from A2; simulated in the demo).

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
8. Read access (case apps and Order Assistant tools) uses the same role checks. The Order Assistant has no path to any action.

**Audit log.** Append-only table: case/CR, action, actor, role, timestamp, previous → new status, comment/reason, payload, and the agent recommendation shown with whether it was accepted. There is no update or delete.

**Case timeline.** A read-only view of the audit log per case, across all its child CRs: *Intake → Supply check → Production check → Supply decision → Customer confirmation*, with the time each step took. It is shown as a section on the object page of all three case apps, and is available to the Order Assistant through `getCaseTimeline`.

**Checks (manual, no unit tests in the demo).** Every allowed and forbidden transition; wrong role per action; reject without reason; confirm to customer in every non-allowed status; CR without parent; concurrent update; exactly one audit row per status change; Order Assistant read tools return only cases the role may see.

---

### A2 · Order Intake & Prioritization Agent

**Mission.** Make sure no important order waits. Detect new or changed orders, assign the lane, flag penalty risk and open the case with everything the next team needs.

**Triggers.** S/4 event *SalesOrder Created/Changed* (demo: "Simulate new order" button), or Sales clicks *Check feasibility* on an order.

**Tools**

| Tool | Source |
|---|---|
| `getSalesOrder(so)` | `API_SALES_ORDER_SRV` / mock |
| `getCustomer(id)` incl. penalty terms | Business partner API / mock. Contract clause text stored on a `CustomerContract` entity in CAP (no vector store on trial; the clauses are short enough to pass in full) |
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
3. **LLM step (Claude):** write a 2–3 line case summary for the planner (*"ABC Automotive needs 100 × FG-100 by D+5. No stock in plant 1000. Penalty clause: 2% of order value per day late."*) and extract the penalty rule from the contract clause text into a structured field (rate, unit, basis).

**Output.** Case `FC-nnnn` with lane, `penaltyRisk`, summary, ATP result.

**Guardrails.** Does not change the order priority itself; it only suggests. The extracted penalty rule is checked against the clause text (the rate must appear in it); penalty amounts are then calculated by a tool, not by the LLM. If there is no clause, it says "no penalty clause found".

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

**LLM step (Claude).** Explain the recommendation in plain words and draft the message to Sales or the production check question (*"Can we produce 100 × FG-100 by D+3? RAW-1 and RAW-2 are available. Plant 1100 has no FG-100 stock."*). The ranking itself is never decided by the LLM.

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

**LLM step (Claude).** Compare the top options in 3–4 sentences (*"O-ALT keeps SO-5004 unchanged and lifts ASSY-02 from 30% to 100% on D+2. O-MOVE needs a frozen-horizon override."*). Draft the planner's comment. Scores and the recommended option come from `score()`, not from the LLM.

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

**Channels.** Demo: a `Notification` entity in CAP, shown as a notification list in each case app's header, plus Work Zone notifications if they are set up on the trial site. Later: email, Microsoft Teams, My Inbox / SAP Task Center.

**LLM step (Claude).** Draft the customer confirmation (or delay) message in the customer's language and tone, using only case facts. Sales edits and sends it. The agent never sends to customers itself.

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

**Scenario 6: Order Assistant**
- During scenario 1, while FC-0001 is `WITH_PRODUCTION`, the Sales rep asks the Order Assistant *"What's blocking FC-0001?"*. Answer: waiting for Production Planning on CR-0001, two options ready, O-ALT recommended, with a case card and a link to Sales Order Feasibility.
- The Production Planner asks *"Compare the options for CR-0001"* → table card with O-ALT and O-MOVE scores, O-MOVE flagged "needs override", link to Production Capacity Workbench.
- The Sales rep types *"Confirm FC-0001 to the customer"* → the assistant explains it can't act, that the case is not yet `SUPPLY_CONFIRMED`, and links to the case. No status change, nothing in the audit log.

---

## 9. Roadmap

| Phase | Scope | Data | Outcome |
|---|---|---|---|
| **0 · Prerequisites** (1 wk) | BTP trial account (Cloud Foundry), Work Zone standard edition subscription, role collections. Anthropic Console account, API key in a dedicated workspace with a spend limit. Business Accelerator Hub API key + sandbox destination. Delivery priority customizing values | – | Ready environment |
| **1 · Demo** (4–6 wks) | A1–A5 in CAP, LLM client (`anthropic` + `mock`), 3 case apps + Order Assistant, Work Zone site, scenarios 1–6, "live data" view against the sandbox, simulated S/4 events | `mock` for scenarios, `sandbox` for live reads (§4.3) | Clickable end-to-end demo for the business |
| **2 · Pilot** (6–8 wks) | Move to a **paid BTP subaccount** (trial is not for productive data). S/4HANA Private Cloud via destination + Cloud Connector. Activate the OData services. Enterprise Event Enablement → Event Mesh. Custom CDS service for capacity load. HANA Cloud. LLM: Claude API (after privacy approval) or AI Core `aicore` mode. One plant, HIGH lane only | `s4` read-only | Measured lead time vs baseline |
| **3 · Rollout** | All lanes and plants. Controlled write-back (stock transfer proposals, planned order changes via approved APIs, ATP re-check). Teams / email channels. Optional Joule front end on the same tools | S/4 read + controlled write | Production use |

**Baseline now.** To prove value, capture today's numbers before the pilot: average confirmation lead time per priority, penalty cost per quarter, excess-stock value and work center overload days.

---

## 10. Open decisions

Decided: S/4HANA Private Cloud · sandbox APIs for the demo · no Advanced ATP · no PP/DS · priority from delivery priority · BTP trial for the demo · Claude API instead of AI Core · Order Assistant instead of Joule (§0).

1. **S/4HANA release** (e.g. 2022 / 2023) of the Private Cloud system. This fixes the API versions and Fiori app availability.
2. **Delivery priority values** used in your customizing, and which ones mean HIGH, MEDIUM and NORMAL (§7 A2).
3. Is delivery priority **maintained reliably** today (customer master default + manual changes on orders), or does it need a cleanup before the pilot?
4. **Frozen horizon** length per plant, and who may override it.
5. Where are **customer penalty terms** stored (contract documents, condition records, CRM)?
6. **Data privacy for the Claude API:** may S/4 data (masked) be sent to Anthropic in the pilot, or must the pilot use SAP AI Core? Which data residency and retention terms are required?
7. **Models and budget:** which Claude models per agent after measuring the demo scenarios, and the monthly spend limit. Who owns the Anthropic account and key?
8. **Pilot account:** which paid BTP subaccount and entitlements (HANA Cloud, Event Mesh, optionally AI Core and Joule) replace the trial.

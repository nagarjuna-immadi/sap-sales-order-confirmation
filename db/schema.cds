// Domain model of the Order Feasibility Case (blueprint §7 A1, §6.2).
//
// The Feasibility Case Orchestrator is the only writer of case status, AuditLog and the
// capacity request status. The other agents write recommendations, supply
// snapshots and notifications; they never change a status.
//
// Code list values are the `code` column; criticality follows the Fiori
// convention 0 = neutral, 1 = red, 2 = yellow, 3 = green.

namespace order.conf;

using {
  cuid,
  managed,
  sap.common.CodeList
} from '@sap/cds/common';

type Role             : String(20) enum {
  Sales;
  SupplyPlanner;
  ProductionPlanner;
}

// The five agents of blueprint §7 (A1–A5 there).
type Agent            : String(40) enum {
  FEASIBILITY_CASE_ORCHESTRATOR_AGENT;
  SALES_ORDER_INTAKE_AGENT;
  SUPPLY_INVENTORY_AGENT;
  PRODUCTION_CAPACITY_BALANCING_AGENT;
  COMMUNICATION_AGENT;
}

type Quantity         : Decimal(13, 3);
type Amount           : Decimal(15, 2);

// JSON text. SQLite and HANA both store it as a large string; the shape is
// documented where the field is declared.
type Json             : LargeString;

// --- Code lists ---------------------------------------------------------------

aspect CriticalityCodeList : CodeList {
  criticality : Integer;
}

// criticality doubles as the lane rank for sorting worklists (§2.2):
// HIGH 1 → MEDIUM 2 → NORMAL 3.
entity Lanes : CriticalityCodeList {
  key code : String(10);
}

// Status model §7 A1.
entity CaseStatus : CriticalityCodeList {
  key code : String(25);
}

entity CapacityRequestStatus : CriticalityCodeList {
  key code : String(25);
}

entity RecommendationKinds : CodeList {
  key code : String(25);
}

// --- Order Feasibility Case ---------------------------------------------------

// One case per sales order item (§7 A2).
@assert.unique: {salesOrderItem: [
  salesOrder,
  item
]}
entity OrderFeasibilityCase : managed {
  key caseId           : String(10); // FC-nnnn
      salesOrder       : String(10) not null; // A_SalesOrderItem.SalesOrder
      item             : String(6) not null; // A_SalesOrderItem.SalesOrderItem
      customer         : Association to Customers; // A_SalesOrder.SoldToParty
      material         : String(40);
      plant            : String(4); // A_SalesOrderItem.ProductionPlant
      quantity         : Quantity;
      quantityUnit     : String(3);
      requestedDate    : Date; // first schedule line, else header
      deliveryPriority : String(2); // A_SalesOrderItem.DeliveryPriority
      lane             : Association to Lanes;
      laneRank         : Integer = lane.criticality;
      penaltyRisk      : Boolean default false;
      penaltyAmount    : Amount; // per day late, from calculatePenalty()
      currency         : String(3);
      penaltyRule      : String(255); // e.g. "2% of order value per day late"
      status           : Association to CaseStatus default 'NEW';
      waitingForRole   : Role; // null when nobody has to act
      summary          : String(1000); // Sales Order Intake summary
      atpResult        : Json; // Sales Order Intake: { availableQty, availableDate, confirmedInFull, source }
      confirmedDate    : Date;
      confirmedQty     : Quantity;
      customerDraft    : LargeString; // Communication: confirmation or delay draft
      version          : Integer default 0 @odata.etag;
      capacityRequests : Association to many CapacityRequest
                           on capacityRequests.parentCase = $self;
      supplyResults    : Association to many SupplyResult
                           on supplyResults.parentCase = $self;
      recommendations  : Association to many Recommendation
                           on recommendations.parentCase = $self;
      auditLog         : Association to many AuditLog
                           on auditLog.parentCase = $self;
      timeline         : Association to many CaseTimeline
                           on timeline.parentCase = $self;
}

// Child of a case; it cannot exist without one (rule 5).
entity CapacityRequest : managed {
  key crId         : String(10); // CR-nnnn
      parentCase   : Association to OrderFeasibilityCase not null;
      status       : Association to CapacityRequestStatus default 'OPEN';
      needByDate   : Date;
      quantity     : Quantity;
      options      : Json; // Production Capacity Balancing: [{ optionId, label, loadBefore, loadAfter, movedOrders, score, feasible, needsOverride }]
      chosenOption : String(20); // O-ALT, O-MOVE, …
      overrideUsed : Boolean default false;
      decidedBy    : String(255);
      decidedAt    : Timestamp;
      reason       : String(1000);
}

// Supply & Inventory picture at one point in time. The latest row is the current one.
entity SupplyResult : cuid, managed {
  parentCase      : Association to OrderFeasibilityCase not null;
  materialTree    : Json; // [{ material, level, parent, requiredQty, availableQty }]
  stockPerPlant   : Json; // [{ material, plant, unrestrictedQty }]
  openReceipts    : Json; // [{ order, type, material, plant, qty, date }]
  excessFlags     : Json; // [{ material, plant, daysSinceMovement, monthsOfSupply, slowMoving, excess }]
  leftoverQty     : Quantity; // simulateLeftover() for the produce option
  excessWarning   : Boolean default false;
  source          : String(4); // mock | s4
}

entity Recommendation : cuid, managed {
  parentCase        : Association to OrderFeasibilityCase not null;
  capacityRequest   : Association to CapacityRequest;
  agent             : Agent;
  kind              : Association to RecommendationKinds;
  options           : Json; // ranked options as returned by the tool
  recommendedOption : String(40);
  rationale         : LargeString;
  inputSnapshot     : Json; // tool inputs the recommendation was built from
  modelId           : String(60); // null when llmUsed = false
  promptVersion     : String(60);
  llmUsed           : Boolean default false;
  fallbackReason    : String(20) enum { // why the template text was kept; null when llmUsed
    LLM_UNAVAILABLE;
    SCHEMA;
    NUMBER_CHECK;
  };
  agentTaskId       : String(36); // cap.agent.Tasks row of the run (tokens, tool calls)
  accepted          : Boolean; // null until a human decided
}

// Append-only (rule 6): one row per action, written in the same transaction
// as the status change. It is also the decision trail: human decisions are
// the rows with a user as actor, and the chosen option goes in the payload. Refused actions get a row with outcome REFUSED in
// their own transaction. No service may update or delete rows.
entity AuditLog : cuid {
  parentCase             : Association to OrderFeasibilityCase not null;
  capacityRequest        : Association to CapacityRequest;
  action                 : String(40) not null;
  actor                  : String(255) not null; // user ID, or an Agent value for system steps
  role                   : String(20);
  at                     : Timestamp @cds.on.insert: $now;
  fromStatus             : String(25);
  toStatus               : String(25);
  comment                : String(1000);
  reason                 : String(1000);
  payload                : Json; // e.g. { chosenOption } for a decision
  recommendation         : Association to Recommendation;
  recommendationAccepted : Boolean;
  outcome                : String(10) not null enum {
    DONE;
    REFUSED;
  } default 'DONE';
  refusalCode            : String(40); // case-rules code when REFUSED
}

// Case timeline (§7 A1): the audit log of a case and its CRs, with the step
// of the flow each row belongs to. previousAt is the time of the previous row
// with the same outcome, so a refused attempt does not cut a step in two; the
// services turn it into durationSeconds and durationText (srv/lib/case-timeline.js).
// The step follows the status the action started from:
//   1 Intake                 NEW (and lane changes)
//   2 Supply check           WITH_SUPPLY_PLANNING
//   3 Production check       WITH_PRODUCTION
//   4 Supply decision        PRODUCTION_CONFIRMED, PRODUCTION_REJECTED
//   5 Customer confirmation  SUPPLY_CONFIRMED, REJECTED
view CaseTimeline as
  select from AuditLog {
    key ID,
        parentCase,
        parentCase.caseId as caseId,
        capacityRequest,
        case
          when action = 'openCase' or action = 'updateLane' or fromStatus = 'NEW' then 1
          when fromStatus = 'WITH_SUPPLY_PLANNING' then 2
          when fromStatus = 'WITH_PRODUCTION' then 3
          when fromStatus = 'PRODUCTION_CONFIRMED' or fromStatus = 'PRODUCTION_REJECTED' then 4
          else 5
        end as stepNo : Integer,
        case
          when action = 'openCase' or action = 'updateLane' or fromStatus = 'NEW' then 'Intake'
          when fromStatus = 'WITH_SUPPLY_PLANNING' then 'Supply check'
          when fromStatus = 'WITH_PRODUCTION' then 'Production check'
          when fromStatus = 'PRODUCTION_CONFIRMED' or fromStatus = 'PRODUCTION_REJECTED' then 'Supply decision'
          else 'Customer confirmation'
        end as step : String(30),
        action,
        actor,
        role,
        at,
        lag(at) over (partition by parentCase.caseId, outcome order by at) as previousAt : Timestamp,
        fromStatus,
        toStatus,
        comment,
        reason,
        payload,
        recommendation,
        recommendationAccepted,
        outcome,
        refusalCode,
        virtual null as durationSeconds : Integer,
        virtual null as durationText : String(20),
  };

// Communication agent notifications (phase 2), shown in each case app's header.
entity Notification : cuid, managed {
  recipientRole   : Role;
  plant           : String(4);
  parentCase      : Association to OrderFeasibilityCase;
  capacityRequest : Association to CapacityRequest;
  event           : String(40);
  title           : String(255);
  text            : String(1000);
  deepLink        : String(255); // semantic object intent, e.g. #SupplyPlanningCase-display?caseId=FC-0001
  isRead          : Boolean default false;
}

// --- Configuration ------------------------------------------------------------

// Delivery priority (item level, customer customizing) → lane (§7 A2).
// Keys not in the table, and blank, map to NORMAL.
entity DeliveryPriorityLane {
  key deliveryPriority : String(2);
      lane             : Association to Lanes not null;
}

entity PlanningParameters {
  key plant               : String(4);
      frozenHorizonDays   : Integer; // D+0 … D+n are frozen
      excessThresholdDays : Integer; // leftover or stock above this many days of supply = excess
      slowMovingAfterDays : Integer; // no movement for this many days = slow-moving
}

// Production Capacity Balancing score weights (§7 A4), lower score is better.
entity ScoringWeights {
  key plant : String(4);
      w1    : Decimal(9, 3); // peak utilization after
      w2    : Decimal(9, 3); // utilization spread across work centers
      w3    : Decimal(9, 3); // frozen-horizon violations
      w4    : Decimal(9, 3); // days late for moved orders
      w5    : Decimal(9, 3); // setup changes
      w6    : Decimal(9, 3); // overtime hours
}

entity LotSizePolicy {
  key material      : String(40);
  key plant         : String(4);
      policy        : String(10) enum {
        EXACT;
        FIXED;
        MINIMUM;
      };
      lotSizeQty    : Quantity; // FIXED: lot size; MINIMUM: minimum lot
      roundingQty   : Quantity;
}

// --- Local mocks for data without a standard S/4 API (§4.2) -------------------

// Capacity load per work center and day, in pieces per day (§8.2). Field
// names mirror A_WorkCenterCapPerBucket (open decision 7), which reports the
// same figures in time units:
//   availableCapacity  ↔ WorkCenterAvailableCapacity
//   requirement        ↔ WorkCenterCapRqmtInCapUnit
//   remainingCapacity  ↔ WrkCtrRmngCapInCapUnit
//   utilizationPercent ↔ WorkCenterTotUtilznInTmePerd
//   capacityUnit       ↔ WorkCenterCapacityUnit
// dayOffset is n in D+n; srv/lib/demo-clock.js turns it into a date.
entity CapacityLoad {
  key plant              : String(4);
  key workCenter         : String(10);
  key dayOffset          : Integer;
      availableCapacity  : Quantity;
      requirement        : Quantity;
      remainingCapacity  : Quantity;
      utilizationPercent : Decimal(5, 1);
      capacityUnit       : String(3);
      orders             : String(255); // orders behind the requirement, e.g. SO-5004
}

// Movement history for slow-mover and excess checks (§8.1). lastMovementOffset
// is n in D+n (negative = in the past).
entity MaterialMovementStats {
  key material           : String(40);
  key plant              : String(4);
      lastMovementOffset : Integer;
      monthlyDemand      : Quantity;
      unit               : String(3);
}

// Customers (business partner, sold-to party). ID = A_SalesOrder.SoldToParty.
entity Customers {
  key ID       : String(10);
      name     : String(80);
      contract : Association to one CustomerContract
                   on contract.customer = $self;
}

// Contract terms per customer. clauseText is null when there is no penalty
// clause. The structured penalty fields are read by Sales Order Intake until phase 7 extracts
// them from the clause text.
entity CustomerContract {
  key customer         : Association to Customers;
      clauseText       : String(1000);
      language         : String(2); // for the Communication agent's customer drafts
      tone             : String(20); // formal | neutral | friendly
      penaltyRate      : Decimal(5, 2); // percent
      penaltyPer       : String(10); // DAY
      penaltyBasis     : String(20); // ORDER_VALUE
}

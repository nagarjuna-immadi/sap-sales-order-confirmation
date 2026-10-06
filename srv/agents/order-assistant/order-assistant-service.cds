// Order Assistant (blueprint §5.3, §6.2; development plan 7.1).
//
// A CAP agent (@cap-js/agents) for users, served over A2A at
// /a2a/order-assistant and used by the Order Assistant chat app. It is not
// one of A1–A5: it makes no recommendations and has no path to any action.
//
// - No actions on the service, so nothing can pause for approval and nothing
//   can change. Read-only projections (the plugin's query tool) and functions.
// - @agent.connect 'none': only this service's tools, never the other agent
//   services or the case services.
// - Every read is limited to the cases the user may see (case-access.js, rule
//   8): the projections in a before READ handler, the functions with canRead.
//   A case the user may not see is "not found".
// - Explicit columns; code lists flattened to their codes (the doc comments
//   name the values); caseId on every entity, so a question about one case
//   needs no join. No prices (penaltyAmount, order value): the plugin masks
//   text fields only. Customer name and ID are @PersonalData, so Claude gets
//   pseudonyms and the user the real values. No free texts that may carry
//   customer data (case summary, customer draft, audit payload), no user IDs.
// - The functions also send the data cards and deep links to the app as A2A
//   data artifacts (order-assistant-service.js); Claude never writes them.
// - Doc comments (/** … */) are what Claude reads: the one on the service goes
//   into the system prompt, the others become the tool descriptions. Notes for
//   developers go in line comments like these.
// - Persona in AGENTS.md next to this file, skills in skills/.

using { order.conf as db } from '../../../db/schema';
using { order.conf.snapshots } from '../../lib/case-snapshots';

/**
 * Order feasibility cases of the Sales-to-Planning order confirmation process.
 * Each Order Feasibility Case (ID FC-nnnn) is one sales order item that
 * needed a check before the delivery date can be confirmed to the customer.
 * Sales, Supply Chain Planning and Production Planning work on the same case:
 * the supply planner checks stock and receipts and may ask Production with a
 * capacity request (ID CR-nnnn); the production planner chooses a production
 * option; the supply planner confirms a date to Sales; Sales confirms it to
 * the customer. Agents suggest options, people decide in the case apps. This
 * service only reads: the user sees only the cases their role may see.
 */
@path    : 'order-assistant'
@requires: ['Sales', 'SupplyPlanner', 'ProductionPlanner']
@agent
@agent.connect: 'none'
service OrderAssistantService {

  // --- read-only projections (query tool) ---------------------------------------------

  /**
   * Order feasibility cases, one per sales order item, with lane, status and who
   * the case is waiting for. Only the cases the user may see are listed.
   */
  @readonly
  entity Cases as projection on db.OrderFeasibilityCase {
        /** Order Feasibility Case ID, e.g. FC-0001. */
    key caseId,
        /** Sales order number in SAP S/4HANA, e.g. SO-5005. */
        salesOrder,
        /** Item number within the sales order, e.g. 10. */
        item,
        /** Customer (sold-to party) ID. */
        @PersonalData.IsPotentiallyPersonal
        customer.ID      as customerId   : String(10),
        /** Customer name. */
        @PersonalData.IsPotentiallyPersonal
        customer.name    as customerName : String(80),
        /** Ordered material, e.g. FG-100. */
        material,
        /** Delivering plant, e.g. 1000. */
        plant,
        /** Ordered quantity. */
        quantity,
        /** Unit of the quantity, e.g. PC. */
        quantityUnit,
        /** Delivery date the customer asked for (YYYY-MM-DD). */
        requestedDate,
        /** Delivery priority of the item in S/4HANA; it sets the lane. */
        deliveryPriority,
        /** Priority lane: HIGH, MEDIUM or NORMAL. HIGH is handled first. */
        lane.code        as lane         : String(10),
        /** Case status: NEW, AUTO_CONFIRMED (confirmed from stock without a human step), WITH_SUPPLY_PLANNING, WITH_PRODUCTION (a capacity request is open), PRODUCTION_CONFIRMED, PRODUCTION_REJECTED, SUPPLY_CONFIRMED (a date is ready for Sales to confirm to the customer), REJECTED, CONFIRMED_TO_CUSTOMER or CLOSED. */
        status.code      as status       : String(25),
        /** Role the case is waiting for: Sales, SupplyPlanner or ProductionPlanner; empty when nobody has to act. */
        waitingForRole,
        /** True when the customer's contract has a penalty for late delivery. */
        penaltyRisk,
        /** The contract's penalty rule as text, e.g. "2% of order value per day late". */
        penaltyRule,
        /** Delivery date confirmed by Supply Planning (YYYY-MM-DD); empty until then. */
        confirmedDate,
        /** Quantity confirmed by Supply Planning. */
        confirmedQty,
        /** When the case was opened (UTC). */
        createdAt        as openedAt,
        /** When the case last changed (UTC). */
        modifiedAt       as lastChangedAt,
  };

  /**
   * Capacity requests: questions from Supply Planning to Production Planning
   * whether a quantity can be produced by a need-by date. A case can have
   * several; the latest one is the active one.
   */
  @readonly
  entity CapacityRequests as projection on db.CapacityRequest {
        /** Capacity request ID, e.g. CR-0001. */
    key crId,
        /** Order Feasibility Case ID the request belongs to. */
        parentCase.caseId as caseId : String(10),
        /** OPEN (waiting for Production Planning), PRODUCTION_CONFIRMED (an option was chosen) or PRODUCTION_REJECTED. */
        status.code       as status : String(25),
        /** Date by which production must finish (YYYY-MM-DD). */
        needByDate,
        /** Quantity to produce. */
        quantity,
        /** Option the production planner chose, e.g. O-ALT or O-MOVE; empty while open. */
        chosenOption,
        /** True when the chosen option needed a frozen-horizon override. */
        overrideUsed,
        /** When the production planner decided (UTC). */
        decidedAt,
        /** Reason the production planner gave for a rejection or an override. */
        reason,
        /** When Supply Planning asked (UTC). */
        createdAt         as requestedAt,
  };

  /**
   * Suggestions of the agents for a case: the ranked supply options and the
   * scored capacity options, each with the option the agent recommends.
   * People decide; accepted tells what they did with the suggestion.
   */
  @readonly
  entity Recommendations as projection on db.Recommendation {
        /** Technical ID of the recommendation. */
    key ID,
        /** Order Feasibility Case ID. */
        parentCase.caseId      as caseId : String(10),
        /** Capacity request ID for capacity options; empty otherwise. */
        capacityRequest.crId   as crId   : String(10),
        /** SUPPLY_INVENTORY_AGENT (supply options) or PRODUCTION_CAPACITY_BALANCING_AGENT (capacity options). */
        agent,
        /** SUPPLY_OPTIONS or CAPACITY_OPTIONS. */
        kind.code              as kind   : String(25),
        /** Option ID the agent recommends, e.g. S-PRODUCE or O-ALT. */
        recommendedOption,
        /** The agent's explanation of the recommendation. */
        rationale,
        /** True when the planner followed the recommendation, false when not; empty until decided. */
        accepted,
        /** When the agent made the suggestion (UTC). */
        createdAt              as suggestedAt,
  } // the other kinds (case summary, customer draft, priority raise) are texts about the customer
    where kind.code in ('SUPPLY_OPTIONS', 'CAPACITY_OPTIONS');

  /**
   * Case timeline: every action on a case and its capacity requests, oldest
   * first, with the step of the flow (Intake, Supply check, Production check,
   * Supply decision, Customer confirmation) and the time it took. Refused
   * attempts are listed with outcome REFUSED and get no duration.
   */
  @readonly
  entity CaseTimeline as projection on db.CaseTimeline {
        /** Technical ID of the row. */
    key ID,
        /** Order Feasibility Case ID. */
        caseId,
        /** Capacity request ID when the action was on one. */
        capacityRequest.crId as crId : String(10),
        /** Number of the step, 1 to 5. */
        stepNo,
        /** Intake, Supply check, Production check, Supply decision or Customer confirmation. */
        step,
        /** The action, e.g. openCase, requestProductionCheck, chooseOption, confirmDateToSales, confirmToCustomer. */
        action,
        /** Role that acted: Sales, SupplyPlanner, ProductionPlanner, or system for agent steps. */
        role,
        /** When it happened (UTC). */
        at,
        /** When the previous step ended (UTC). */
        previousAt,
        /** Case status before the action. */
        fromStatus,
        /** Case status after the action; same as fromStatus when it did not change it. */
        toStatus,
        /** Comment entered with the action. */
        comment,
        /** Reason entered with a rejection or an override. */
        reason,
        /** DONE, or REFUSED when the case rules did not allow the action. */
        outcome,
        /** Why the action was refused, e.g. STATUS_NOT_ALLOWED. */
        refusalCode,
        /** Time the step took, in seconds. */
        durationSeconds,
        /** Time the step took as text, e.g. "2 min" or "1 h 5 min". */
        durationText,
  };

  // --- functions ----------------------------------------------------------------------

  type MyContext {
    /** The user's roles in this process: Sales, SupplyPlanner and/or ProductionPlanner. */
    roles     : many String(20);
    /** The case apps the user works in. */
    caseApps  : many String(40);
    /** Today's date (YYYY-MM-DD). */
    today     : Date;
    /** Monday of this week (YYYY-MM-DD). */
    weekStart : Date;
    /** Sunday of this week (YYYY-MM-DD). */
    weekEnd   : Date;
  }

  type NextAction {
    /** The action, e.g. chooseOption. */
    action : String(40);
    /** Name of the button in the case app, e.g. "Choose Option". */
    label  : String(60);
    /** Role that may take it: Sales, SupplyPlanner or ProductionPlanner. */
    role   : String(20);
    /** Case app where the button is. */
    app    : String(40);
    /** Case status after the action. */
    to     : String(25);
  }

  type CaseCapacityRequest {
    /** Capacity request ID, e.g. CR-0001. */
    crId              : String(10);
    /** OPEN, PRODUCTION_CONFIRMED or PRODUCTION_REJECTED. */
    status            : String(25);
    /** Date by which production must finish (YYYY-MM-DD). */
    needByDate        : Date;
    /** Quantity to produce. */
    quantity          : Decimal(13, 3);
    /** Number of production options simulated for the request. */
    optionCount       : Integer;
    /** Number of those options that are feasible. */
    feasibleOptionCount : Integer;
    /** Option ID the capacity agent recommends, e.g. O-ALT. */
    recommendedOption : String(20);
    /** Option the production planner chose; empty while open. */
    chosenOption      : String(20);
    /** True when the chosen option needed a frozen-horizon override. */
    overrideUsed      : Boolean;
    /** When Supply Planning asked (UTC). */
    requestedAt       : Timestamp;
    /** When the production planner decided (UTC). */
    decidedAt         : Timestamp;
  }

  type CaseRecommendation {
    /** SUPPLY_INVENTORY_AGENT or PRODUCTION_CAPACITY_BALANCING_AGENT. */
    agent             : String(40);
    /** SUPPLY_OPTIONS or CAPACITY_OPTIONS. */
    kind              : String(25);
    /** Capacity request ID for capacity options. */
    crId              : String(10);
    /** Option ID the agent recommends. */
    recommendedOption : String(40);
    /** The agent's explanation. */
    rationale         : LargeString;
    /** True when the planner followed it, false when not; empty until decided. */
    accepted          : Boolean;
    /** When the agent made the suggestion (UTC). */
    suggestedAt       : Timestamp;
  }

  type Decision {
    /** When it happened (UTC). */
    at          : Timestamp;
    /** Step of the flow, e.g. Production check. */
    step        : String(30);
    /** The action, e.g. chooseOption. */
    action      : String(40);
    /** Role that acted: Sales, SupplyPlanner, ProductionPlanner, or system. */
    role        : String(20);
    /** Capacity request ID when the action was on one. */
    crId        : String(10);
    /** Case status before. */
    fromStatus  : String(25);
    /** Case status after. */
    toStatus    : String(25);
    /** DONE or REFUSED. */
    outcome     : String(10);
    /** Why the action was refused. */
    refusalCode : String(40);
    /** Option chosen with the action, e.g. O-ALT. */
    chosenOption : String(40);
    /** Comment entered with the action. */
    comment     : String(1000);
    /** Reason entered with a rejection or an override. */
    reason      : String(1000);
    /** Time the step took, e.g. "2 min"; empty for refused attempts. */
    durationText : String(20);
  }

  type CaseDetails {
    /** Order Feasibility Case ID. */
    caseId           : String(10);
    /** Sales order number. */
    salesOrder       : String(10);
    /** Item number. */
    item             : String(6);
    /** Customer (sold-to party) ID. */
    customerId       : String(10) @PersonalData.IsPotentiallyPersonal;
    /** Customer name. */
    customerName     : String(80) @PersonalData.IsPotentiallyPersonal;
    /** Ordered material. */
    material         : String(40);
    /** Delivering plant. */
    plant            : String(4);
    /** Ordered quantity. */
    quantity         : Decimal(13, 3);
    /** Unit of the quantity. */
    quantityUnit     : String(3);
    /** Delivery date the customer asked for (YYYY-MM-DD). */
    requestedDate    : Date;
    /** HIGH, MEDIUM or NORMAL. */
    lane             : String(10);
    /** Case status code, e.g. WITH_PRODUCTION. */
    status           : String(25);
    /** Case status in words, e.g. "With Production". */
    statusText       : String(60);
    /** Role the case is waiting for: Sales, SupplyPlanner or ProductionPlanner; empty when nobody has to act. */
    waitingForRole   : String(20);
    /** The team the case is waiting for in words, e.g. "Production Planning". */
    waitingFor       : String(40);
    /** Since when the case has been in this status (UTC). */
    waitingSince     : Timestamp;
    /** True when the customer's contract has a penalty for late delivery. */
    penaltyRisk      : Boolean;
    /** The penalty rule as text. */
    penaltyRule      : String(255);
    /** Delivery date confirmed by Supply Planning (YYYY-MM-DD); empty until then. */
    confirmedDate    : Date;
    /** Quantity confirmed by Supply Planning. */
    confirmedQty     : Decimal(13, 3);
    /** Actions the status allows next, who may take them and in which app. Empty when the case is final. */
    nextActions      : many NextAction;
    /** Capacity requests of the case, latest first. */
    capacityRequests : many CaseCapacityRequest;
    /** The latest supply and capacity recommendations. */
    recommendations  : many CaseRecommendation;
    /** Every action on the case, oldest first, including refused attempts. */
    decisionTrail    : many Decision;
    /** Case apps in which the user can open this case; the app shows the links. */
    openIn           : many String(40);
  }

  type SalesOrderItem {
    /** Item number. */
    item             : String(6);
    /** Material. */
    material         : String(40);
    /** Plant. */
    plant            : String(4);
    /** Ordered quantity. */
    quantity         : Decimal(13, 3);
    /** Unit. */
    quantityUnit     : String(3);
    /** Requested delivery date (YYYY-MM-DD). */
    requestedDate    : Date;
    /** Confirmed delivery date in S/4HANA (YYYY-MM-DD); empty when none. */
    confirmedDate    : Date;
    /** Confirmed quantity in S/4HANA. */
    confirmedQty     : Decimal(13, 3);
    /** Delivery priority of the item. */
    deliveryPriority : String(2);
    /** Lane the delivery priority maps to: HIGH, MEDIUM or NORMAL. */
    lane             : String(10);
    /** Order Feasibility Case of the item; empty when it has none or the user may not see it. */
    caseId           : String(10);
    /** Status of that case. */
    caseStatus       : String(25);
  }

  type SalesOrder {
    /** Sales order number. */
    salesOrder : String(10);
    /** Customer (sold-to party) ID. */
    customerId : String(10) @PersonalData.IsPotentiallyPersonal;
    /** mock (demo data) or s4 (read from SAP S/4HANA). */
    source     : String(4);
    /** The items of the order. */
    items      : many SalesOrderItem;
  }

  /**
   * Who the user is in this process (roles and case apps) and today's date with
   * this week's Monday and Sunday. Call it for questions about "my" cases or
   * about dates relative to today, such as "this week".
   */
  function getMyContext() returns MyContext;

  /**
   * Everything about one case: header, status and who it is waiting for since
   * when, the actions the status allows next, its capacity requests, the latest
   * supply and capacity recommendations, and the decision trail from the audit
   * log. Use it for "what's blocking …", status and "why" questions, and before
   * answering a request to act on a case.
   */
  function getCase(
    /** Order Feasibility Case ID, e.g. FC-0001. */
    caseId : String(10) @mandatory
  ) returns CaseDetails;

  /**
   * The supply picture of a case as the supply check stored it: the ranked
   * supply options with the recommended one, the bill of materials netted
   * against stock, stock per plant, open receipts and excess or slow-moving
   * flags.
   */
  function getSupplyPicture(
    /** Order Feasibility Case ID, e.g. FC-0001. */
    caseId : String(10) @mandatory
  ) returns snapshots.SupplyPicture;

  /**
   * The production options of a capacity request as the capacity check
   * stored them: finish date, scores, load before and after per work center
   * and day, moved orders and frozen-horizon override flags, recommended
   * option first.
   */
  function getCapacityOptions(
    /** Capacity request ID, e.g. CR-0001. */
    crId : String(10) @mandatory
  ) returns snapshots.CapacityOptions;

  /**
   * A sales order from SAP S/4HANA with its items: material, quantity,
   * requested and confirmed date, delivery priority and lane, and the case
   * of each item.
   */
  function getSalesOrder(
    /** Sales order number, e.g. SO-5005. */
    salesOrder : String(10) @mandatory
  ) returns SalesOrder;
}

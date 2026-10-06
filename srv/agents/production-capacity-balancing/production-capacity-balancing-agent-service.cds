// Production Capacity Balancing agent service (A4; blueprint §5.1, §5.2, development plan 6.2).
//
// Internal CAP agent: production-capacity-balancing.js calls it with srv.chat
// after it has stored the scored options of a capacity request with a
// template comparison. Claude compares the top options and drafts the
// planner's comment; scores and the recommended option are inputs, never
// outputs. @requires internal-user (the A2A endpoint answers 403), read-only
// functions, no actions; persona in AGENTS.md next to this file. No customer
// data and no prices in any result.

/**
 * Production check of the Sales-to-Planning order confirmation process. A
 * capacity request (ID CR-nnnn) asks the production planner whether a quantity
 * of a material can be produced by a need-by date for an Order Feasibility
 * Case (FC-nnnn). The function returns the simulated and scored options for it.
 */
@path    : 'production-capacity-balancing-agent'
@requires: 'internal-user'
@agent
@agent.connect: 'none'
service ProductionCapacityBalancingAgentService {

  type MovedOrder {
    /** Production or planned order that is moved. */
    order      : String(20);
    /** Sales order the moved order produces for; empty for make-to-stock. */
    salesOrder : String(10);
    /** Work center it is moved on. */
    workCenter : String(10);
    /** Quantity moved. */
    qty        : Decimal(13, 3);
    /** Day it was planned (YYYY-MM-DD). */
    fromDate   : Date;
    /** Day it is moved to (YYYY-MM-DD). */
    toDate     : Date;
    /** True when the move is inside the frozen horizon and needs an override. */
    insideFrozenHorizon : Boolean;
    /** Days the moved order's own sales order becomes late; 0 when it stays on time. */
    daysLate   : Integer;
  }

  type LoadChange {
    /** Work center. */
    workCenter        : String(10);
    /** Day (YYYY-MM-DD). */
    date              : Date;
    /** Utilization in percent before the option. */
    utilizationBefore : Decimal(5, 1);
    /** Utilization in percent with the option. */
    utilizationAfter  : Decimal(5, 1);
  }

  type Metrics {
    /** Highest utilization in percent on any work center and day after the option. */
    peakUtilization         : Decimal(9, 1);
    /** Difference in average utilization between the work centers, in percentage points. */
    utilizationSpread       : Decimal(9, 1);
    /** Number of moves inside the frozen horizon. */
    frozenHorizonViolations : Integer;
    /** Days late summed over the moved orders. */
    daysLateForMovedOrders  : Integer;
    /** Number of setups. */
    setupChanges            : Integer;
    /** Overtime hours. */
    overtimeHours           : Decimal(9, 1);
  }

  type CapacityOption {
    /** Option ID: O-ALT (alternative production version), O-ALT-2 …, O-MOVE (move lower-priority orders on the primary work centers). */
    optionId          : String(20);
    /** The option in one line. */
    label             : String(255);
    /** Production version used. */
    productionVersion : String(4);
    /** Day production finishes (YYYY-MM-DD). */
    finishDate        : Date;
    /** True when the option meets the need-by date without making another order late. */
    feasible          : Boolean;
    /** Why the option is not feasible. */
    infeasibleReason  : String(255);
    /** True when the option moves an order inside the frozen horizon, which needs an override with a reason. */
    needsOverride     : Boolean;
    /** Weighted score; lower is better. */
    score             : Decimal(9, 2);
    /** True for the option the scoring recommends: the lowest score among the feasible options. */
    recommended       : Boolean;
    /** The parts of the score. */
    metrics           : Metrics;
    /** Orders the option moves. */
    movedOrders       : many MovedOrder;
    /** Work centers and days whose load the option changes. */
    loadChanges       : many LoadChange;
  }

  type CapacityOptions {
    /** Capacity request ID, CR-nnnn. */
    crId              : String(10);
    /** Order Feasibility Case ID, FC-nnnn. */
    caseId            : String(10);
    /** Sales order the production is for. */
    salesOrder        : String(10);
    /** Material to produce. */
    material          : String(40);
    /** Plant. */
    plant             : String(4);
    /** Quantity to produce. */
    quantity          : Decimal(13, 3);
    /** Unit of the quantity. */
    quantityUnit      : String(3);
    /** Date by which production must finish (YYYY-MM-DD). */
    needByDate        : Date;
    /** Priority lane of the case: HIGH, MEDIUM or NORMAL. */
    lane              : String(10);
    /** Status of the capacity request, e.g. OPEN. */
    status            : String(25);
    /** Option ID of the recommended option; empty when no option is feasible. */
    recommendedOption : String(20);
    /** The options, recommended first, then by score. */
    options           : many CapacityOption;
  }

  /**
   * The simulated and scored options of a capacity request, with the
   * recommended one, as the capacity check stored them.
   */
  function getCapacityOptions(
    /** Capacity request ID, e.g. CR-0001. */
    crId : String(10) @mandatory
  ) returns CapacityOptions;
}

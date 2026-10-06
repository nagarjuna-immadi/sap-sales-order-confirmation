using {order.conf as db} from '../db/schema';

/**
 * Production Capacity Workbench (blueprint §6.1, development plan 1.4 and 4).
 * The production planner works on capacity requests, HIGH first, then by
 * need-by date; each shows its parent case (read-only). The actions are bound
 * to the CR, but they change the case, so the CR's ETag is the case version
 * (caseVersion). Reasons are checked by the orchestrator (rule 4), so a
 * refusal is audited.
 */
@path    : '/odata/v4/production'
@requires: 'ProductionPlanner'
service ProductionService {

  @readonly
  entity CapacityRequests as
    select from db.CapacityRequest
    mixin {
      timeline        : Association to many CaseTimeline
                          on timeline.caseId = $projection.caseId;
      capacityOptions : Association to many CapacityOptions
                          on capacityOptions.crId = $projection.crId;
      movedOrders     : Association to many MovedOrders
                          on movedOrders.crId = $projection.crId;
      loadRows        : Association to many OptionLoad
                          on loadRows.crId = $projection.crId;
    }
    into {
      *,
      parentCase.caseId           as caseId,
      @odata.etag
      parentCase.version          as caseVersion,
      parentCase.status.code      as caseStatus,
      parentCase.waitingForRole   as waitingForRole,
      parentCase.salesOrder       as salesOrder,
      parentCase.item             as item,
      parentCase.customer.name    as customerName,
      parentCase.material         as material,
      parentCase.plant            as plant,
      parentCase.quantityUnit     as quantityUnit,
      parentCase.requestedDate    as requestedDate,
      parentCase.lane.code        as lane,
      parentCase.lane.name        as laneName,
      parentCase.lane.criticality as laneRank,
      parentCase.penaltyRisk      as penaltyRisk,
      timeline,
      capacityOptions,
      movedOrders,
      loadRows,
      // Filled after READ by production-service.js, only when selected (phase 4),
      // from the CR's options and its latest CAPACITY_OPTIONS recommendation:
      virtual null as recommendedOption       : String(20),
      virtual null as recommendedOptionLabel  : String(255),
      virtual null as overrideOption          : String(20), // the best option that needs an override
      virtual null as comparison              : LargeString,
      virtual null as comparisonSource        : String(20), // Agent (Claude) | Template text
      virtual null as frozenHorizon           : String(20), // e.g. "D+0 … D+3"
      // Which actions the case status allows (case-rules.js TRANSITIONS) on an
      // OPEN CR, for @Core.OperationAvailable. The orchestrator still checks.
      virtual null as canChooseOption         : Boolean, // also needs an option without needsOverride
      virtual null as canChooseOverrideOption : Boolean, // also needs an option with needsOverride
      virtual null as canRejectProduction     : Boolean,
    }
    actions {
      action chooseOption(optionId : String(20), comment : String(1000))        returns CapacityRequests;
      // an option inside the frozen horizon; reason required
      action chooseOverrideOption(optionId : String(20), reason : String(1000)) returns CapacityRequests;
      action rejectProduction(reason : String(1000))                            returns CapacityRequests;
    };

  /**
   * The options of a CR as the Production Capacity Balancing agent stored them
   * (CapacityRequest.options), best score first. Built in production-service.js;
   * readable as CapacityRequests(…)/capacityOptions, and as the value list of
   * the choose actions (then the options of the OPEN CRs).
   */
  @readonly
  @cds.persistence.skip
  @Capabilities: {
    SearchRestrictions.Searchable: false,
    SortRestrictions.Sortable    : false,
  }
  entity CapacityOptions {
    key crId                    : String(10);
    key optionId                : String(20);
        rank                    : Integer;
        label                   : String(255);
        productionVersion       : String(4);
        feasible                : Boolean;
        infeasibleReason        : String(255);
        feasibility             : String(255); // "Yes", or "No: <reason>"
        feasibilityCriticality  : Integer; // 1 not feasible, else 0
        score                   : Decimal(9, 2);
        needsOverride           : Boolean;
        finishDate              : Date;
        movedOrders             : String(255); // e.g. "SO-5004 2026-10-08 → 2026-10-10"
        peakUtilization         : Decimal(5, 1);
        frozenHorizonViolations : Integer;
        recommended             : Boolean;
        suggestion              : String(30); // "Suggested by agent" on the recommended option
        suggestionCriticality   : Integer; // 3 on the recommended option, else 0
        criticality             : Integer; // 3 recommended, 2 needs override, 0 feasible, 1 not feasible
  }

  /**
   * Other orders an option moves (impact on other customers), with their old
   * and new date against their due date. Readable as CapacityRequests(…)/movedOrders.
   */
  @readonly
  @cds.persistence.skip
  @Capabilities: {
    SearchRestrictions.Searchable: false,
    SortRestrictions.Sortable    : false,
    FilterRestrictions.Filterable: false,
  }
  entity MovedOrders {
    key crId                : String(10);
    key optionId            : String(20);
    key order               : String(12);
        salesOrder          : String(10);
        workCenter          : String(10);
        qty                 : db.Quantity;
        fromDate            : Date;
        toDate              : Date;
        dueDate             : Date;
        daysLate            : Integer;
        insideFrozenHorizon : Boolean;
        onTime              : Boolean;
        criticality         : Integer; // 1 late, 2 on time but inside the frozen horizon, 3 on time
  }

  /**
   * Load per option, work center and day, before and after (the Load before /
   * after chart). Readable as CapacityRequests(…)/loadRows.
   */
  @readonly
  @cds.persistence.skip
  @Capabilities: {
    SearchRestrictions.Searchable: false,
    SortRestrictions.Sortable    : false,
    FilterRestrictions.Filterable: false,
  }
  entity OptionLoad {
    key crId               : String(10);
    key optionId           : String(20);
    key workCenter         : String(10);
    key dayOffset          : Integer;
        date               : Date;
        dayLabel           : String(20); // "D+2", "D+2 frozen"
        frozen             : Boolean;
        availableCapacity  : Double;
        requirementBefore  : Double;
        requirementAfter   : Double;
        utilizationBefore  : Double; // percent
        utilizationAfter   : Double; // percent
  }

  @readonly
  entity Cases            as
    projection on db.OrderFeasibilityCase {
      *,
      customer.name as customerName,
    }
    excluding {
      auditLog
    };

  @readonly
  entity SupplyResults    as projection on db.SupplyResult;

  @readonly
  entity Recommendations  as projection on db.Recommendation;

  @readonly
  entity CaseTimeline     as projection on db.CaseTimeline;

  // Communication agent notifications for this role (phase 2.3; header list in the apps)
  @readonly
  entity Notifications    as projection on db.Notification;

  @readonly
  entity Customers        as projection on db.Customers excluding { contract };
}

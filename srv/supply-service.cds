using {order.conf as db} from '../db/schema';

/**
 * Supply Planning Workbench (blueprint §6.1, development plan 1.4 and 3). The
 * supply planner's worklist: every case that reached Supply Planning, HIGH
 * first, then by requested date. All actions go to the Feasibility Case
 * Orchestrator, which checks role, status and reason (case-rules.js) and
 * writes the audit row; a refusal is a 400 or 403 and shows in the timeline.
 * Every action needs the case version as If-Match.
 */
@path    : '/odata/v4/supply'
@requires: 'SupplyPlanner'
service SupplyPlanningService {

  @readonly
  entity Cases            as
    select from db.OrderFeasibilityCase
    mixin {
      supplyTree    : Association to many SupplyTreeNodes
                        on supplyTree.caseId = $projection.caseId;
      supplyOptions : Association to many SupplyOptions
                        on supplyOptions.caseId = $projection.caseId;
    }
    into {
      *,
      customer.name                          as customerName,
      case when penaltyRisk = true then 1 else 0 end as penaltyCriticality : Integer,
      supplyTree,
      supplyOptions,
      // Filled after READ by supply-service.js, only when selected (phase 3).
      // The latest capacity request, the latest supply picture and the
      // latest SUPPLY_OPTIONS recommendation of the case:
      virtual null as activeCrId              : String(10),
      virtual null as dataSource              : String(4),
      virtual null as dataSourceCriticality   : Integer,
      virtual null as recommendedOption       : String(20),
      virtual null as recommendedOptionLabel  : String(255),
      virtual null as recommendationRationale : LargeString,
      virtual null as rationaleSource         : String(20), // Agent (Claude) | Template text
      virtual null as productionCheckQuestion : String(1000),
      virtual null as summarySource           : String(20), // of the Sales Order Intake summary
      virtual null as excessWarning           : Boolean,
      // Which actions the case status allows (case-rules.js TRANSITIONS), for
      // @Core.OperationAvailable. The orchestrator still checks on every call.
      virtual null as canConfirmFromStock     : Boolean,
      virtual null as canApproveStockTransfer : Boolean,
      virtual null as canApproveReallocation  : Boolean,
      virtual null as canRequestProductionCheck : Boolean,
      virtual null as canReject               : Boolean,
      virtual null as canConfirmDateToSales   : Boolean,
    }
    excluding {
      auditLog
    }
    actions {
      action confirmFromStock(comment : String(1000))       returns Cases;
      action approveStockTransfer(comment : String(1000))   returns Cases;
      action approveReallocation(comment : String(1000))    returns Cases;
      // creates the capacity request CR-nnnn
      action requestProductionCheck(comment : String(1000)) returns Cases;
      // reason required (rule 4), checked by the orchestrator so a refusal is
      // audited; the app marks it mandatory in its local annotations only
      action reject(reason : String(1000))                  returns Cases;
      // only when the active CR is PRODUCTION_CONFIRMED (rule 3)
      action confirmDateToSales(comment : String(1000))     returns Cases;
    };

  /**
   * The material tree of the case's latest supply picture (SupplyResult),
   * one row per node in tree order, with stock in other plants, open
   * receipts and the slow-mover / excess flags. Built from the stored JSON in
   * supply-service.js; only readable as Cases(…)/supplyTree.
   */
  @readonly
  @cds.persistence.skip
  @Capabilities: {
    SearchRestrictions.Searchable: false,
    SortRestrictions.Sortable    : false,
    FilterRestrictions.Filterable: false,
  }
  entity SupplyTreeNodes {
    key caseId           : String(10);
    key nodeNo           : Integer;
        level            : Integer;
        material         : String(40);
        materialTree     : String(80); // the material, indented by level
        parent           : String(40);
        requiredQty      : db.Quantity;
        availableQty     : db.Quantity;
        shortfallQty     : db.Quantity;
        shortfallCriticality : Integer;
        unit             : String(3);
        stockOtherPlants : db.Quantity;
        otherPlants      : String(255); // e.g. "1100: 30"
        openReceiptsQty  : db.Quantity;
        openReceipts     : String(255); // e.g. "PLO-9001: 50 on 2026-10-09"
        slowMoving       : Boolean;
        excess           : Boolean;
        excessInfo       : String(255); // per plant, e.g. "1100: slow-moving (120 days), 1.2 months of supply"
  }

  /**
   * The ranked options of the latest SUPPLY_OPTIONS recommendation (§7 A3
   * ladder, ranks 1–5; S-CONFIRM-DATE after production confirmed). The ranking
   * comes from the tools; only readable as Cases(…)/supplyOptions.
   */
  @readonly
  @cds.persistence.skip
  @Capabilities: {
    SearchRestrictions.Searchable: false,
    SortRestrictions.Sortable    : false,
    FilterRestrictions.Filterable: false,
  }
  entity SupplyOptions {
    key caseId        : String(10);
    key optionId      : String(20);
        rank          : Integer;
        label         : String(255);
        feasible      : Boolean;
        reason        : String(255);
        recommended   : Boolean;
        criticality   : Integer; // 3 recommended, 0 feasible, 1 not possible
        confirmedDate : Date;
        confirmedQty  : db.Quantity;
  }

  @readonly
  entity CapacityRequests as projection on db.CapacityRequest;

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

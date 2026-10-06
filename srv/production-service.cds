using {order.conf as db} from '../db/schema';

/**
 * Production Capacity Workbench (blueprint §6.1, development plan 1.4). The
 * production planner works on capacity requests; each shows its parent case
 * (read-only). The actions are bound to the CR, but they change the case, so
 * the CR's ETag is the case version (caseVersion). Reasons are checked by the
 * orchestrator (rule 4), so a refusal is audited.
 */
@path    : '/odata/v4/production'
@requires: 'ProductionPlanner'
service ProductionService {

  @readonly
  entity CapacityRequests as
    select from db.CapacityRequest
    mixin {
      timeline : Association to many CaseTimeline
                   on timeline.caseId = $projection.caseId;
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
      parentCase.requestedDate    as requestedDate,
      parentCase.lane.code        as lane,
      parentCase.lane.criticality as laneRank,
      parentCase.penaltyRisk      as penaltyRisk,
      timeline,
    }
    actions {
      action chooseOption(optionId : String(20), comment : String(1000))        returns CapacityRequests;
      // an option inside the frozen horizon; reason required
      action chooseOverrideOption(optionId : String(20), reason : String(1000)) returns CapacityRequests;
      action rejectProduction(reason : String(1000))                            returns CapacityRequests;
    };

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

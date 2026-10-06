using {order.conf as db} from '../db/schema';

/**
 * Supply Planning Workbench (blueprint §6.1, development plan 1.4). The supply
 * planner's worklist: every case that reached Supply Planning, HIGH first,
 * then by requested date. All actions go to the Feasibility Case Orchestrator,
 * which checks role, status and reason (case-rules.js) and writes the audit
 * row; a refusal is a 400 or 403 and shows in the timeline. Every action needs
 * the case version as If-Match.
 */
@path    : '/odata/v4/supply'
@requires: 'SupplyPlanner'
service SupplyPlanningService {

  @readonly
  entity Cases            as
    projection on db.OrderFeasibilityCase {
      *,
      customer.name as customerName,
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
      // reason required (rule 4), checked by the orchestrator so a refusal is audited
      action reject(reason : String(1000))                  returns Cases;
      // only when the active CR is PRODUCTION_CONFIRMED (rule 3)
      action confirmDateToSales(comment : String(1000))     returns Cases;
    };

  @readonly
  entity CapacityRequests as projection on db.CapacityRequest;

  @readonly
  entity SupplyResults    as projection on db.SupplyResult;

  @readonly
  entity Recommendations  as projection on db.Recommendation;

  @readonly
  entity CaseTimeline     as projection on db.CaseTimeline;

  @readonly
  entity Customers        as projection on db.Customers excluding { contract };
}

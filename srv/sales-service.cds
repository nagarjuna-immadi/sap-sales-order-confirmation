using {order.conf as db} from '../db/schema';

/**
 * Sales Order Feasibility (blueprint §6.1, development plan 1.4). Sales sees
 * all its order items with a case, AUTO_CONFIRMED ones included, ordered by
 * sales order and item. Confirm to customer only in SUPPLY_CONFIRMED (rule 2);
 * the orchestrator refuses it otherwise and the refusal shows in the timeline
 * (scenario 5). Every action needs the case version as If-Match.
 */
@path    : '/odata/v4/sales'
@requires: 'Sales'
service SalesService {

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
      // re-runs Sales Order Intake for the item (phase 2); no status change
      action checkFeasibility()                        returns Cases;
      action confirmToCustomer(comment : String(1000)) returns Cases;
      // after a rejection: Sales has informed the customer
      action close(comment : String(1000))             returns Cases;
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

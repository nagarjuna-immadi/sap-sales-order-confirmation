using {order.conf as db} from '../db/schema';

/**
 * Sales Order Feasibility (blueprint §6.1, development plan 1.4 and 5). Sales
 * sees all its order items with a case, AUTO_CONFIRMED ones included, ordered
 * by sales order and item. Confirm to customer only in SUPPLY_CONFIRMED (rule 2);
 * the orchestrator refuses it otherwise and the refusal shows in the timeline
 * (scenario 5). Every action needs the case version as If-Match.
 */
@path    : '/odata/v4/sales'
@requires: 'Sales'
service SalesService {

  @readonly
  entity Cases            as
    select from db.OrderFeasibilityCase {
      *,
      customer.name                          as customerName,
      case when penaltyRisk = true then 1 else 0 end as penaltyCriticality : Integer,
      // Filled after READ by sales-service.js, only when selected (phase 5).
      // The latest decision recommendation of the case (supply or capacity
      // options, or the suggestion to raise the delivery priority):
      virtual null as recommendationAgent     : String(40),
      virtual null as recommendationKind      : String(40),
      virtual null as recommendedOptionLabel  : String(255),
      virtual null as recommendationRationale : LargeString,
      virtual null as rationaleSource         : String(20), // Agent (Claude) | Template text
      virtual null as recommendationAt        : Timestamp,
      virtual null as summarySource           : String(20), // of the Sales Order Intake summary
      // The Communication agent's draft: "Confirmation" or "Delay", and who wrote it
      virtual null as draftKind               : String(20),
      virtual null as draftSource             : String(20),
      // Which actions the case status allows (case-rules.js TRANSITIONS), for
      // @Core.OperationAvailable. The orchestrator still checks on every call.
      virtual null as canConfirmToCustomer    : Boolean,
      virtual null as canClose                : Boolean,
      // Confirm to customer is offered on every open case, so that Sales can
      // try it too early and see the orchestrator refuse it (scenario 5).
      virtual null as offerConfirmToCustomer  : Boolean,
      virtual null as canCheckFeasibility     : Boolean, // not on a final case
    }
    excluding {
      auditLog
    }
    actions {
      // re-runs Sales Order Intake for the item (phase 2); no status change
      action checkFeasibility()                                                      returns Cases;
      // customerDraft: the draft as Sales edited it; stored in the audit payload, never sent
      action confirmToCustomer(customerDraft : LargeString, comment : String(1000)) returns Cases;
      // after a rejection: Sales has informed the customer
      action close(comment : String(1000))                                           returns Cases;
    };

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

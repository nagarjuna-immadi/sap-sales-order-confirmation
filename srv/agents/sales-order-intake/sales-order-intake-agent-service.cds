// Sales Order Intake agent service (A2; blueprint §5.1, §5.2, development plan 6.2).
//
// Internal CAP agent: sales-order-intake.js calls it with srv.chat after the
// intake has stored its template summary. No business user can reach it
// (@requires internal-user; the A2A endpoint answers 403). Read-only functions
// only, no actions. The persona is AGENTS.md next to this file, doc comments
// (/** … */) are what Claude reads, line comments are for developers.
//
// No prices in any result (masking covers text fields only): the order value
// stays out, the penalty amount is calculated by calculatePenalty() after the
// run. Customer ID and name are pseudonymized for Claude (cds.agents.masking).

/**
 * Sales order intake for the Sales-to-Planning order confirmation process. Each
 * Order Feasibility Case (ID FC-nnnn) is one sales order item that may not be
 * deliverable as requested. The functions read the case's order item with its
 * availability check, and the customer's contract clause on late delivery.
 */
@path    : 'sales-order-intake-agent'
@requires: 'internal-user'
@agent
@agent.connect: 'none'
service SalesOrderIntakeAgentService {

  type Availability {
    /** Quantity the order item asks for. */
    requestedQty    : Decimal(13, 3);
    /** Quantity the basic availability check (ATP) finds in the delivering plant. */
    availableQty    : Decimal(13, 3);
    /** Date from which availableQty is available in the plant (YYYY-MM-DD); empty when nothing is. */
    availableDate   : Date;
    /** Earliest delivery date to the customer: availableDate plus the shipping lead time. */
    deliveryDate    : Date;
    /** True when the full quantity can be delivered by the requested date. */
    confirmedInFull : Boolean;
  }

  type OrderItem {
    /** Order Feasibility Case ID, FC-nnnn. */
    caseId              : String(10);
    /** Sales order number in SAP S/4HANA. */
    salesOrder          : String(10);
    /** Item number within the sales order. */
    item                : String(6);
    /** Customer (sold-to party) ID. */
    customerId          : String(10) @PersonalData.IsPotentiallyPersonal;
    /** Customer name. */
    customerName        : String(80) @PersonalData.IsPotentiallyPersonal;
    /** Material number of the ordered product. */
    material            : String(40);
    /** Product description. */
    materialDescription : String(80);
    /** Delivering plant. */
    plant               : String(4);
    /** Ordered quantity. */
    quantity            : Decimal(13, 3);
    /** Unit of the quantity, e.g. PC. */
    quantityUnit        : String(3);
    /** Delivery date the customer asked for (YYYY-MM-DD). */
    requestedDate       : Date;
    /** Delivery priority of the item in S/4HANA. */
    deliveryPriority    : String(2);
    /** Priority lane from the delivery priority: HIGH, MEDIUM or NORMAL. */
    lane                : String(10);
    /** True when the customer has a late-delivery penalty clause and the item is not confirmed in full on time. */
    penaltyRisk         : Boolean;
    /** Result of the basic availability check for the item. */
    availability        : Availability;
  }

  type ContractClause {
    /** Customer (sold-to party) ID. */
    customerId : String(10) @PersonalData.IsPotentiallyPersonal;
    /** True when the contract has a late-delivery penalty clause. */
    found      : Boolean;
    /** Text of the late-delivery penalty clause, as written in the contract; empty when there is none. */
    clauseText : String(1000);
  }

  /**
   * The sales order item of a case: customer, material, quantity, requested
   * date, delivery priority and lane, and the availability check (ATP) in the
   * delivering plant.
   */
  function getOrderItem(
    /** Order Feasibility Case ID, e.g. FC-0001. */
    caseId : String(10) @mandatory
  ) returns OrderItem;

  /**
   * The customer's contract clause on late delivery. found is false and
   * clauseText empty when the contract has no penalty clause.
   */
  function getContractClause(
    /** Customer ID, as customerId from getOrderItem. */
    customerId : String(10) @mandatory
  ) returns ContractClause;
}

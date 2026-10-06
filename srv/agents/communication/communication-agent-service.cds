// Communication agent service (A5; blueprint §5.1, §5.2, development plan 6.2).
//
// Internal CAP agent: communication.js calls it with srv.chat after it has
// stored the template customer draft (confirmation or delay). Claude writes
// the draft in the customer's language and tone; Sales edits and sends it,
// the agent never sends anything. Notification texts stay templates.
// @requires internal-user (the A2A endpoint answers 403), read-only
// functions, no actions; persona in AGENTS.md next to this file. Customer ID
// and name are pseudonymized for Claude (cds.agents.masking); no prices.

/**
 * Customer communication of the Sales-to-Planning order confirmation process.
 * Each Order Feasibility Case (ID FC-nnnn) is one sales order item. When
 * planning has confirmed or rejected it, Sales sends the customer a
 * confirmation or a delay message. The functions return the outcome of the
 * case and the customer's language and tone.
 */
@path    : 'communication-agent'
@requires: 'internal-user'
@agent
@agent.connect: 'none'
service CommunicationAgentService {

  type CaseOutcome {
    /** Order Feasibility Case ID, FC-nnnn. */
    caseId              : String(10);
    /** Sales order number, as the customer knows it. */
    salesOrder          : String(10);
    /** Item number within the sales order. */
    item                : String(6);
    /** Customer (sold-to party) ID. */
    customerId          : String(10) @PersonalData.IsPotentiallyPersonal;
    /** Material number of the ordered product. */
    material            : String(40);
    /** Product description. */
    materialDescription : String(80);
    /** Ordered quantity. */
    quantity            : Decimal(13, 3);
    /** Unit of the quantity, e.g. PC. */
    quantityUnit        : String(3);
    /** Delivery date the customer asked for (YYYY-MM-DD). */
    requestedDate       : Date;
    /** confirmation: the order is confirmed; delay: it cannot be delivered by the requested date. */
    draftKind           : String(20);
    /** Confirmation: the confirmed delivery date (YYYY-MM-DD). */
    confirmedDate       : Date;
    /** Confirmation: the confirmed quantity. */
    confirmedQty        : Decimal(13, 3);
    /** Delay: the earliest possible delivery date (YYYY-MM-DD); empty when there is none in the planning window. */
    earliestDate        : Date;
    /** Delay: the planner's reason for the rejection, internal wording. */
    reason              : String(1000);
  }

  type CustomerPreferences {
    /** Customer (sold-to party) ID. */
    customerId   : String(10) @PersonalData.IsPotentiallyPersonal;
    /** Customer name, for the greeting. */
    customerName : String(80) @PersonalData.IsPotentiallyPersonal;
    /** Language for messages to this customer, ISO 639-1 in upper case, e.g. EN or DE. */
    language     : String(2);
    /** Tone for messages to this customer: formal, neutral or friendly. */
    tone         : String(20);
  }

  /**
   * The outcome of a case that is ready for the customer: confirmed (date and
   * quantity) or delayed (earliest possible date and the planner's reason).
   */
  function getCaseOutcome(
    /** Order Feasibility Case ID, e.g. FC-0001. */
    caseId : String(10) @mandatory
  ) returns CaseOutcome;

  /** The customer's name, language and tone for messages. */
  function getCustomerPreferences(
    /** Customer ID, as customerId from getCaseOutcome. */
    customerId : String(10) @mandatory
  ) returns CustomerPreferences;
}

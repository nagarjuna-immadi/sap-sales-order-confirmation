// Supply & Inventory agent service (A3; blueprint §5.1, §5.2, development plan 6.2).
//
// Internal CAP agent: supply-inventory.js calls it with srv.chat after it has
// stored the supply picture and the ranked options with a template text.
// Claude explains the ranking and drafts the question to Production or the
// message to Sales; it never chooses or reorders an option. @requires
// internal-user (the A2A endpoint answers 403), read-only functions, no
// actions; persona in AGENTS.md next to this file. No customer data and no
// prices in any result.

/**
 * Supply check of the Sales-to-Planning order confirmation process. Each Order
 * Feasibility Case (ID FC-nnnn) is one sales order item; the supply check has
 * looked at stock, open receipts and production for it and ranked the ways to
 * supply it. The function returns that picture with the ranked options.
 */
@path    : 'supply-inventory-agent'
@requires: 'internal-user'
@agent
@agent.connect: 'none'
service SupplyInventoryAgentService {

  type SupplyOption {
    /** Option ID: S-LOCAL (stock and receipts in the plant), S-TRANSFER (stock transfer from other plants), S-REALLOCATE (supply of a lower-priority order), S-PRODUCE (production check), S-CONFIRM-DATE (confirm the date production gave), S-REJECT (reject with the earliest date). */
    optionId             : String(20);
    /** Rank on the supply ladder, 1 first; 0 for S-CONFIRM-DATE. Options are tried in this order. */
    rank                 : Integer;
    /** The option in one line. */
    label                : String(255);
    /** True when the option can supply the full quantity on time. */
    feasible             : Boolean;
    /** Why the option is not possible, or a note on it. */
    reason               : String(255);
    /** True for the option the supply check recommends: the first feasible one in rank order. */
    recommended          : Boolean;
    /** Date to confirm to Sales with this option (YYYY-MM-DD). */
    confirmedDate        : Date;
    /** Quantity to confirm to Sales with this option. */
    confirmedQty         : Decimal(13, 3);
    /** S-PRODUCE: quantity to produce. */
    produceQty           : Decimal(13, 3);
    /** S-PRODUCE: date by which production must finish (YYYY-MM-DD). */
    needByDate           : Date;
    /** S-PRODUCE: quantity left over after production because of the lot size. */
    leftoverQty          : Decimal(13, 3);
    /** S-PRODUCE: true when the leftover is above the excess threshold. */
    excessWarning        : Boolean;
    /** S-REJECT: earliest possible delivery date (YYYY-MM-DD); empty when none fits in the planning window. */
    earliestDate         : Date;
    /** S-CONFIRM-DATE: capacity request whose production option was chosen. */
    crId                 : String(10);
    /** S-CONFIRM-DATE: the production option chosen by the production planner. */
    chosenOption         : String(20);
    /** S-CONFIRM-DATE: date production finishes (YYYY-MM-DD). */
    productionFinishDate : Date;
  }

  type MaterialNode {
    /** Material number. */
    material     : String(40);
    /** Parent material in the bill of materials; empty for the ordered product. */
    parent       : String(40);
    /** Level in the bill of materials, 0 for the ordered product. */
    level        : Integer;
    /** Quantity needed for this order. */
    requiredQty  : Decimal(13, 3);
    /** Quantity available in the plant. */
    availableQty : Decimal(13, 3);
    /** Quantity missing. */
    shortfallQty : Decimal(13, 3);
    /** Unit. */
    unit         : String(3);
  }

  type PlantStock {
    /** Material number. */
    material        : String(40);
    /** Plant. */
    plant           : String(4);
    /** Unrestricted-use stock. */
    unrestrictedQty : Decimal(13, 3);
    /** Unit. */
    unit            : String(3);
  }

  type Receipt {
    /** Planned or production order number. */
    order    : String(20);
    /** Receipt type, e.g. planned order or production order. */
    type     : String(20);
    /** Material number. */
    material : String(40);
    /** Plant. */
    plant    : String(4);
    /** Quantity received. */
    qty      : Decimal(13, 3);
    /** Receipt date (YYYY-MM-DD). */
    date     : Date;
  }

  type StockFlag {
    /** Material number. */
    material          : String(40);
    /** Plant. */
    plant             : String(4);
    /** Days since the last goods movement. */
    daysSinceMovement : Integer;
    /** Stock divided by monthly demand. */
    monthsOfSupply    : Decimal(9, 1);
    /** True when the stock has not moved for a long time. */
    slowMoving        : Boolean;
    /** True when the stock is above the excess threshold. */
    excess            : Boolean;
  }

  type SupplyPicture {
    /** Order Feasibility Case ID, FC-nnnn. */
    caseId            : String(10);
    /** Sales order number in SAP S/4HANA. */
    salesOrder        : String(10);
    /** Item number within the sales order. */
    item              : String(6);
    /** Ordered material. */
    material          : String(40);
    /** Delivering plant. */
    plant             : String(4);
    /** Ordered quantity. */
    quantity          : Decimal(13, 3);
    /** Unit of the quantity. */
    quantityUnit      : String(3);
    /** Delivery date the customer asked for (YYYY-MM-DD). */
    requestedDate     : Date;
    /** Priority lane: HIGH, MEDIUM or NORMAL. */
    lane              : String(10);
    /** Case status, e.g. WITH_SUPPLY_PLANNING, PRODUCTION_CONFIRMED, PRODUCTION_REJECTED. */
    status            : String(25);
    /** Option ID of the recommended option. */
    recommendedOption : String(20);
    /** The options in rank order. */
    options           : many SupplyOption;
    /** Bill of materials netted against stock in the plant. */
    materialTree      : many MaterialNode;
    /** Stock of the materials per plant. */
    stockPerPlant     : many PlantStock;
    /** Open receipts free for this order. */
    openReceipts      : many Receipt;
    /** Slow-moving and excess stock of the ordered material per plant. */
    stockFlags        : many StockFlag;
  }

  /**
   * The supply picture of a case with the ranked options and the recommended
   * one, as the supply check stored it last.
   */
  function getSupplyPicture(
    /** Order Feasibility Case ID, e.g. FC-0001. */
    caseId : String(10) @mandatory
  ) returns SupplyPicture;
}

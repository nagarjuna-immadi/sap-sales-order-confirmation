// Types of the stored agent results in case-snapshots.js (development plan
// 6.2, 7.1), shared by the A3 and A4 agent services and the Order Assistant.
// The doc comments are what Claude reads in the function results.
namespace order.conf.snapshots;

// --- Supply & Inventory: getSupplyPicture -----------------------------------------

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

// --- Production Capacity Balancing: getCapacityOptions ----------------------------

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

/* checksum : 45eb93b79aa6e14ea3e8581a20c40fa4 */
@cds.external : true
@m.IsDefaultEntityContainer : 'true'
@sap.message.scope.supported : 'true'
@sap.supported.formats : 'atom json xlsx'
service API_PLANNED_ORDERS {
  @cds.external : true
  @cds.persistence.skip : true
  @sap.content.version : '1'
  @sap.label : 'Planned Order'
  entity A_PlannedOrder {
    @sap.display.format : 'UpperCase'
    @sap.label : 'Planned Order'
    key PlannedOrder : String(10) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Planned Order Type'
    PlannedOrderType : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Plnned order profile'
    @sap.quickinfo : 'Planned order profile'
    PlannedOrderProfile : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Material'
    @sap.quickinfo : 'Planning material'
    Material : String(40);
    @sap.label : 'Material Description'
    MaterialName : String(40);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Production Plant'
    ProductionPlant : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Planning Plant'
    MRPPlant : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'MRP Area'
    MRPArea : String(10);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Production Version'
    ProductionVersion : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Procurement Category'
    @sap.quickinfo : 'Material Procurement Category'
    MaterialProcurementCategory : String(1);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Procurement Type'
    @sap.quickinfo : 'Material Procurement Type'
    MaterialProcurementType : String(1);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Storage Location'
    StorageLocation : String(4);
    @sap.label : 'Base Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    BaseUnit : String(3);
    @sap.unit : 'BaseUnit'
    @sap.label : 'Total Order Quantity'
    @sap.quickinfo : 'Planned Total Order Quantity'
    TotalQuantity : Decimal(13, 3);
    @sap.unit : 'BaseUnit'
    @sap.label : 'Scrap Quantity'
    @sap.quickinfo : 'Planned Scrap Quantity'
    PlndOrderPlannedScrapQty : Decimal(13, 3);
    @sap.unit : 'BaseUnit'
    @sap.label : 'Quantity Received'
    @sap.quickinfo : 'Quantity of Goods Received'
    GoodsReceiptQty : Decimal(13, 3);
    @sap.unit : 'BaseUnit'
    @sap.label : 'Issued Quantity'
    IssuedQuantity : Decimal(13, 3);
    @sap.display.format : 'Date'
    @sap.label : 'Order Start Date'
    @sap.quickinfo : 'Planned Order Start Date'
    PlndOrderPlannedStartDate : Date;
    @sap.label : 'Order Start Time'
    @sap.quickinfo : 'Planned Order Start Time'
    PlndOrderPlannedStartTime : Time;
    @sap.display.format : 'Date'
    @sap.label : 'Order End Date'
    @sap.quickinfo : 'Planned Order End Date'
    PlndOrderPlannedEndDate : Date;
    @sap.label : 'Order End Time'
    @sap.quickinfo : 'Planned Order End Time'
    PlndOrderPlannedEndTime : Time;
    @sap.display.format : 'Date'
    @sap.label : 'Order Opening Date'
    @sap.quickinfo : 'Planned Opening Date in Planned Order'
    PlannedOrderOpeningDate : Date;
    @odata.Type : 'Edm.DateTimeOffset'
    @sap.label : 'Change Time Stamp'
    @sap.quickinfo : 'Last Change to Planned Order: Time Stamp'
    LastChangeDateTime : DateTime;
    @sap.display.format : 'Date'
    @sap.label : 'Production Start Date'
    @sap.quickinfo : 'Start Date for Production'
    ProductionStartDate : Date;
    @sap.display.format : 'Date'
    @sap.label : 'Production End Date'
    @sap.quickinfo : 'End Date for Production'
    ProductionEndDate : Date;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Sales Order'
    SalesOrder : String(10);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Sales Order Item'
    SalesOrderItem : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Customer'
    @sap.quickinfo : 'Customer Number'
    Customer : String(10);
    @sap.display.format : 'NonNegative'
    @sap.label : 'WBS Element Internal'
    @sap.quickinfo : 'Work Breakdown Structure Element Internal ID'
    WBSElementInternalID : String(24);
    @sap.display.format : 'UpperCase'
    @sap.label : 'WBS Element'
    WBSElement : String(24);
    @sap.label : 'WBS Element Name'
    @sap.quickinfo : 'Work Breakdown Structure Element Name'
    WBSDescription : String(40);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Account Assignment Category'
    AccountAssignmentCategory : String(1);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Reservation'
    @sap.quickinfo : 'Number of reservation/dependent requirements'
    Reservation : String(10);
    @sap.display.format : 'UpperCase'
    @sap.label : 'MRP Controller'
    MRPController : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Production Supervisor'
    ProductionSupervisor : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Purchasing Group'
    PurchasingGroup : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Purch. Organization'
    @sap.quickinfo : 'Purchasing Organization'
    PurchasingOrganization : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Fixed Vendor'
    FixedSupplier : String(10);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Purchase Agreement'
    @sap.quickinfo : 'Purchase Schedule/Outline Agreement'
    PurchasingDocument : String(10);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Agreement Item'
    @sap.quickinfo : 'Purchase Schedule/Outline Agreement Item'
    PurchasingDocumentItem : String(5);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Quota Arrangement'
    QuotaArrangement : String(10);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Quota Arrangement Item'
    QuotaArrangementItem : String(3);
    @sap.label : 'Name of Supplier'
    SupplierName : String(80);
    @sap.label : 'Firming Indicator'
    @sap.quickinfo : 'Firming Indicator for Planned Order Data'
    PlannedOrderIsFirm : Boolean;
    @sap.label : 'Conversion Indicator'
    @sap.quickinfo : 'Planned Order Conversion Indicator'
    PlannedOrderIsConvertible : Boolean;
    @sap.label : 'BOM Fixing Indicator'
    @sap.quickinfo : 'Fixing Indicator for BOM Explosion'
    PlannedOrderBOMIsFixed : Boolean;
    @sap.label : 'Capacity Dispatched'
    @sap.quickinfo : 'Indicator: Capacity for Planned Order is Dispatched'
    PlannedOrderCapacityIsDsptchd : Boolean;
    @sap.label : 'Material Goods Receipt Duration'
    @sap.quickinfo : 'Material Goods Receipt Duration in Days'
    MaterialGoodsReceiptDuration : Decimal(3, 0);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity Requirement'
    @sap.quickinfo : 'ID of the Capacity Requirements Record'
    CapacityRequirement : String(12);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Capacity Requirement Origin'
    CapacityRequirementOrigin : String(1);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Task List Type'
    BillOfOperationsType : String(1);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Group'
    @sap.quickinfo : 'Key for Task List Group'
    BillOfOperationsGroup : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Group Counter'
    BillOfOperations : String(2);
    @sap.display.format : 'Date'
    @sap.label : 'Scheduled on'
    @sap.quickinfo : 'Date of the Last Scheduling'
    LastScheduledDate : Date;
    @sap.display.format : 'Date'
    @sap.label : 'Scheduled finish'
    ScheduledBasicEndDate : Date;
    @sap.label : 'Earliest finish'
    @sap.quickinfo : 'Earliest finish of operation (time)'
    ScheduledBasicEndTime : Time;
    @sap.display.format : 'Date'
    @sap.label : 'Scheduled start'
    ScheduledBasicStartDate : Date;
    @sap.label : 'Earliest start time'
    @sap.quickinfo : 'Earliest scheduled start: Execution (time)'
    ScheduledBasicStartTime : Time;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Scheduling Type'
    SchedulingType : String(1);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Master Plnd Ord.'
    @sap.quickinfo : 'Master Planned Order Number'
    MasterPlannedOrder : String(12);
    to_PlannedOrderCapacity : Association to many A_PlannedOrderCapacity {  };
    to_PlannedOrderComponent : Association to many A_PlannedOrderComponent {  };
  } actions {
    action PlannedOrderSchedule() returns A_PlannedOrder;
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Planned Order Capacity'
  entity A_PlannedOrderCapacity {
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity Requirement'
    @sap.quickinfo : 'ID of the Capacity Requirements Record'
    key CapacityRequirement : String(12) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity Requirement Item'
    key CapacityRequirementItem : String(8) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity Requirement Item Capacity'
    @sap.quickinfo : 'Individual Capacity of a Capacity Requirement Item'
    key CapacityRqmtItemCapacity : String(4) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Planned Order'
    PlannedOrder : String(10);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Planned Order Type'
    PlannedOrderType : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Sequence'
    Sequence : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Activity'
    @sap.quickinfo : 'Activity Number'
    Operation : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Suboperation'
    SubOperation : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center'
    WorkCenter : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Capacity Category'
    CapacityCategoryCode : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Capacity'
    @sap.quickinfo : 'Capacity name'
    Capacity : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'MRP Controller'
    MRPController : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Planning Plant'
    MRPPlant : String(4);
    @sap.display.format : 'Date'
    @sap.label : 'Latest Start Date'
    OperationLatestStartDate : Date;
    @sap.label : 'Latest Start Time'
    OperationLatestStartTime : Time;
    @sap.display.format : 'Date'
    @sap.label : 'Latest End Date'
    OperationLatestEndDate : Date;
    @sap.label : 'Latest End Time'
    OperationLatestEndTime : Time;
    @sap.display.format : 'Date'
    @sap.label : 'Earliest Start Date'
    OperationEarliestStartDate : Date;
    @sap.label : 'Earliest Start Time'
    OperationEarliestStartTime : Time;
    @sap.display.format : 'Date'
    @sap.label : 'Earliest End Date'
    OperationEarliestEndDate : Date;
    @sap.label : 'Earliest End Time'
    OperationEarliestEndTime : Time;
    @sap.display.format : 'Date'
    @sap.label : 'Processing Start Dte'
    @sap.quickinfo : 'Latest Scheduled Processing Start Date'
    OpLtstSchedldProcgStrtDte : Date;
    @sap.label : 'Processing Start Tme'
    @sap.quickinfo : 'Latest Scheduled Processing Start Time'
    OpLtstSchedldProcgStrtTme : Time;
    @sap.display.format : 'Date'
    @sap.label : 'Teardown Start Date'
    @sap.quickinfo : 'Latest Scheduled Teardown Start Date'
    OpLtstSchedldTrdwnStrtDte : Date;
    @sap.label : 'Teardown Start Time'
    @sap.quickinfo : 'Latest Scheduled Teardown Start Time'
    OpLtstSchedldTrdwnStrtTme : Time;
    @sap.label : 'Earliest finish'
    @sap.quickinfo : 'Earliest finish of operation (time)'
    ScheduledBasicEndTime : Time;
    @sap.label : 'Earliest start time'
    @sap.quickinfo : 'Earliest scheduled start: Execution (time)'
    ScheduledBasicStartTime : Time;
    @sap.label : 'Capacity Unit'
    @sap.quickinfo : 'Unit of Measure for Capacity Requirements'
    @sap.semantics : 'unit-of-measure'
    CapacityRequirementUnit : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'ISO Code'
    @sap.quickinfo : 'ISO Code for Unit of Measurement'
    UnitOfMeasureISOCode : String(3);
    @sap.label : 'Scheduled Setup'
    @sap.quickinfo : 'Scheduled Capacity Requirements for Setup'
    ScheduledCapReqOpSegSetupDurn : Double;
    @sap.label : 'Remaining Setup'
    @sap.quickinfo : 'Remaining Capacity Requirements for Setup'
    RemainingCapReqOpSegSetupDurn : Double;
    @sap.label : 'Scheduled Processing'
    @sap.quickinfo : 'Scheduled Capacity Requirements for Processing'
    ScheduledCapReqOpSegProcgDurn : Double;
    @sap.label : 'Remaining Processing'
    @sap.quickinfo : 'Remaining Capacity Requirements for Processing'
    RemainingCapReqOpSegProcgDurn : Double;
    @sap.label : 'Scheduled Teardown'
    @sap.quickinfo : 'Scheduled Capacity Requirements for the Teardown'
    ScheduledCapReqOpSegTrdwnDurn : Double;
    @sap.label : 'Remaining Teardown'
    @sap.quickinfo : 'Remaining Capacity Requirements for Teardown'
    RemainingCapReqOpSegTrdwnDurn : Double;
    WrkCntrHasLeadingCap : String(1);
    @sap.label : 'Operation Short Text'
    OperationText : String(40);
    @odata.Type : 'Edm.DateTimeOffset'
    @sap.label : 'Change Time Stamp'
    @sap.quickinfo : 'Last Change to Planned Order: Time Stamp'
    LastChangeDateTime : DateTime;
  } actions {
    action SchedulePlannedOrderOperation(
      @sap.label : 'Planned Order'
      PlannedOrder : String(10) not null,
      @odata.Type : 'Edm.DateTime'
      @sap.label : 'Latest Start Date'
      OpSchedldStartDate : DateTime,
      @sap.label : 'Latest Start Time'
      OpSchedldStartTime : Time,
      @odata.Type : 'Edm.DateTime'
      @sap.label : 'Latest End Date'
      OpSchedldEndDate : DateTime,
      @sap.label : 'Latest End Time'
      OpSchedldEndTime : Time,
      @sap.label : 'Scheduling Type'
      OpSchedulingMode : String(1) not null,
      @sap.label : 'Status'
      OpSchedulingStatus : String(4),
      @sap.label : 'Component of the Version Number'
      OpSchedulingStrategy : String(4) not null
    ) returns SchedldProdOrdOpMessage;
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.content.version : '1'
  @sap.label : 'Planned Order Components'
  entity A_PlannedOrderComponent {
    @sap.display.format : 'NonNegative'
    @sap.label : 'Reservation'
    @sap.quickinfo : 'Number of reservation/dependent requirements'
    key Reservation : String(10) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Reservation Item'
    key ReservationItem : String(4) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Planned Order'
    PlannedOrder : String(10);
    @sap.display.format : 'NonNegative'
    @sap.label : 'BOM Item'
    @sap.quickinfo : 'Bill of Material Item'
    BOMItem : String(8);
    @sap.label : 'Item Text'
    @sap.quickinfo : 'BOM Item Text (Line 1)'
    BOMItemDescription : String(40);
    @sap.label : 'Item Text 2'
    @sap.quickinfo : 'BOM Item Text (Line 2)'
    BOMItemDescriptionLine2 : String(40);
    @sap.display.format : 'UpperCase'
    @sap.label : 'BOM Category'
    @sap.quickinfo : 'Bill of Material Category Code'
    BillOfMaterialCategory : String(1);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Sort String'
    SortField : String(10);
    @sap.display.format : 'UpperCase'
    @sap.label : 'BOM Item'
    @sap.quickinfo : 'BOM item number'
    BillOfMaterialItemNumber : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Bill of Material'
    BillOfMaterialInternalID : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Alternative BOM'
    BillOfMaterialVariant : String(2);
    @sap.display.format : 'UpperCase'
    @sap.label : 'BOM Item Category'
    @sap.quickinfo : 'Bill of Material Item Category'
    BOMItemCategory : String(1);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Material'
    @sap.quickinfo : 'Material Number'
    Material : String(40);
    @sap.display.format : 'Date'
    @sap.label : 'Requirement Date'
    @sap.quickinfo : 'Material Component Requirement Date'
    MatlCompRequirementDate : Date;
    @sap.unit : 'EntryUnit'
    @sap.label : 'Quantity in Unit of Entry'
    GoodsMovementEntryQty : Decimal(13, 3);
    @sap.label : 'Unit of Entry'
    @sap.quickinfo : 'Unit of entry'
    @sap.semantics : 'unit-of-measure'
    EntryUnit : String(3);
    @sap.unit : 'BaseUnit'
    @sap.label : 'Requirement Quantity'
    RequiredQuantity : Decimal(13, 3);
    @sap.label : 'Base Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    BaseUnit : String(3);
    @sap.unit : 'BaseUnit'
    @sap.label : 'Withdrawn Quantity'
    WithdrawnQuantity : Decimal(13, 3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Debit Credit Code'
    @sap.quickinfo : 'Debit/Credit Code'
    DebitCreditCode : String(1);
    @sap.label : 'Component Scrap (%)'
    @sap.quickinfo : 'Component Scrap in Percent'
    ComponentScrapInPercent : Decimal(5, 2);
    @sap.label : 'Quantity is fixed'
    QuantityIsFixed : Boolean;
    @sap.label : 'Phantom Item'
    @sap.quickinfo : 'Phantom Item Indicator'
    MaterialComponentIsPhantomItem : Boolean;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Plant'
    Plant : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Storage Location'
    StorageLocation : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Production Supply Area'
    SupplyArea : String(10);
    @sap.display.format : 'UpperCase'
    @sap.label : 'MRP Controller'
    MRPController : String(3);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Order path'
    OrderPathValue : String(2);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Order level'
    OrderLevelValue : String(2);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Pegged Requirement'
    @sap.quickinfo : 'Higher-Level Assembly Material'
    Assembly : String(40);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Assembly Order Path'
    AssemblyOrderPathValue : String(2);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Assembly Order Level'
    AssemblyOrderLevelValue : String(2);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Discontinuation Group'
    DiscontinuationGroup : String(2);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Discontinuation Type'
    MatlCompDiscontinuationType : String(1);
    @sap.label : 'Component is Follow-Up Material'
    @sap.quickinfo : 'Indicator: Component is Follow-Up Material'
    MatlCompIsFollowUpMaterial : Boolean;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Follow-up Group'
    FollowUpGroup : String(2);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Follow-Up / Original Material'
    FollowUpMaterial : String(40);
    @sap.label : 'Follow-Up Material is Active'
    @sap.quickinfo : 'Indicator: Follow-Up Material is Active'
    FollowUpMaterialIsNotActive : Boolean;
    @odata.Type : 'Edm.DateTimeOffset'
    @sap.label : 'Change Time Stamp'
    @sap.quickinfo : 'Last Change to Planned Order: Time Stamp'
    LastChangeDateTime : DateTime;
  };

  @cds.external : true
  type SchedldProdOrdOpMessage {
    @sap.label : 'Planned Order'
    PlannedOrder : String(10) not null;
    CapacityRequirement : String not null;
    CapacityRequirementItem : String not null;
    CapacityRqmtItemCapacity : String not null;
    @sap.label : 'Activity'
    Operation : String(4) not null;
    Message : String;
  };
};


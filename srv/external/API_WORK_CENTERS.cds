/* checksum : 9b1ef65c2190532b4214d2aca16658ef */
@cds.external : true
@m.IsDefaultEntityContainer : 'true'
@sap.message.scope.supported : 'true'
@sap.supported.formats : 'atom json xlsx'
service API_WORK_CENTERS {
  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Capacity Assignment'
  entity A_WorkCenterAllCapacity {
    @sap.display.format : 'NonNegative'
    @sap.label : 'Object ID'
    @sap.quickinfo : 'Object ID of the resource'
    key WorkCenterInternalID : String(8) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Object Type'
    @sap.quickinfo : 'Object types of the CIM resource'
    key WorkCenterTypeCode : String(2) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity ID'
    key CapacityInternalID : String(8) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity Allocation'
    @sap.quickinfo : 'Capacity Category Allocation'
    key CapacityCategoryAllocation : String(4) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center'
    WorkCenter : String(8);
    @sap.label : 'Work Center Text'
    WorkCenterDesc : String(40);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Plant'
    Plant : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center Category'
    WorkCenterCategoryCode : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Person Responsible'
    @sap.quickinfo : 'Person Responsible for the Work Center'
    WorkCenterResponsible : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Prodn Supply Area'
    @sap.quickinfo : 'Production Supply Area'
    SupplyArea : String(10);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center Usage'
    @sap.quickinfo : 'Work Center Usage in Bill of Operations'
    WorkCenterUsage : String(3);
    @sap.label : 'Name of Responsible'
    @sap.quickinfo : 'Work Center Responsible Name'
    WorkCenterResponsibleName : String(40);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Capacity Category'
    CapacityCategoryCode : String(3);
    to_WorkCenterInterval : Association to many A_WorkCenterCapacityInterval {  };
    to_WorkCenterQueuingOp : Association to many A_WorkCenterCapPplineOp {  };
    to_WorkCenterTodayOp : Association to many A_WorkCenterCapDayOp {  };
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Capacity Assignment Version 2'
  entity A_WorkCenterAllCapacity_2 {
    @sap.display.format : 'NonNegative'
    @sap.label : 'Object ID'
    @sap.quickinfo : 'Object ID of the resource'
    key WorkCenterInternalID : String(8) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Object Type'
    @sap.quickinfo : 'Object types of the CIM resource'
    key WorkCenterTypeCode : String(2) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity Allocation'
    @sap.quickinfo : 'Capacity Category Allocation'
    key CapacityCategoryAllocation : String(4) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Plant'
    Plant : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center Category'
    WorkCenterCategoryCode : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center'
    WorkCenter : String(8);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity ID'
    CapacityInternalID : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Setup Formula'
    @sap.quickinfo : 'Formula for Setup Capacity Requirements'
    SetupCapRequirementFormula : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Processing Formula'
    @sap.quickinfo : 'Formula for Processing Capacity Requirements'
    ProcgCapRequirementFormula : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Teardown Formula'
    @sap.quickinfo : 'Formula for Teardown Capacity Requirements'
    TeardownCapRequirementFormula : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Other Formula'
    @sap.quickinfo : 'Formula for Other Capacity Requirements'
    OtherCapRequirementFormula : String(6);
    @odata.Type : 'Edm.DateTimeOffset'
    @odata.Precision : 7
    @sap.label : 'Date and Time of Last Change'
    WorkCenterLastChangeDateTime : Timestamp;
    to_Capacity : Association to A_WorkCenterCapacity {  };
    to_WorkCenterQueuingOp : Association to many A_WorkCenterCapPplineOp {  };
    to_WorkCenterTodayOp : Association to many A_WorkCenterCapDayOp {  };
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Capacity Header'
  entity A_WorkCenterCapacity {
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity ID'
    key CapacityInternalID : String(8) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Capacity'
    @sap.quickinfo : 'Capacity name'
    Capacity : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Capacity Category'
    CapacityCategoryCode : String(3);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Active Version'
    @sap.quickinfo : 'Active Version of Available Capacity'
    CapacityActiveVersion : String(2);
    @sap.label : 'Finite Scheduling'
    @sap.quickinfo : 'Indicator: Capacity Relevant to Finite Scheduling'
    CapacityIsFinite : Boolean;
    @sap.label : 'Pooled Capacity'
    @sap.quickinfo : 'Pooled Capacity Indicator'
    CapacityIsPooled : Boolean;
    @sap.label : 'Individ. Capacities'
    @sap.quickinfo : 'Has Individual Capacities'
    CapacityHasIndivCapacities : Boolean;
    @sap.label : 'No LongTerm Planning'
    @sap.quickinfo : 'Indicator: Capacity Excluded From Long-Term Planning'
    CapacityIsExcldFrmLongTermPlng : Boolean;
    @sap.label : 'No. Ind. Capacities'
    @sap.quickinfo : 'Number of Individual Capacities'
    CapacityNumberOfCapacities : Integer;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Capacity Planner'
    @sap.quickinfo : 'Capacity Responsible Planner Group'
    CapacityResponsiblePlanner : String(3);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity Utilization'
    @sap.quickinfo : 'Capacity Utilization Ratio in Percent'
    CapacityPlanUtilizationPercent : String(3);
    @sap.label : 'Break Duration'
    @sap.quickinfo : 'Cumulative Break Duration in Seconds (internal)'
    CapacityBreakDuration : Integer;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Plant'
    Plant : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Factory Calendar'
    @sap.quickinfo : 'Factory Calendar ID'
    FactoryCalendar : String(2);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Authorization'
    @sap.quickinfo : 'Authorization Group'
    AuthorizationGroup : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Shift Grouping'
    @sap.quickinfo : 'Grouping for Shift Definitions and Shift Sequences'
    ShiftGroup : String(2);
    @sap.label : 'Start Time'
    @sap.quickinfo : 'Start time in seconds (internal)'
    CapacityStartTime : Integer;
    @sap.label : 'End Time'
    @sap.quickinfo : 'End Time in Seconds (internal)'
    CapacityEndTime : Integer;
    @sap.label : 'Can Be Used By Several Operations'
    @sap.quickinfo : 'Indicator: Several Operations Can Use Capacity'
    CapIsUsedInMultiOperations : Boolean;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Referenced Capacity ID'
    ReferencedCapacityInternalID : String(8);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Overload (%)'
    @sap.quickinfo : 'Overload'
    CapOverloadThresholdInPercent : String(3);
    @sap.label : 'Capacity Unit'
    @sap.quickinfo : 'Capacity Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    CapacityQuantityUnit : String(3);
    @sap.label : 'Capacity Base Unit'
    @sap.quickinfo : 'Capacity Base Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    CapacityBaseQtyUnit : String(3);
    @odata.Type : 'Edm.DateTimeOffset'
    @odata.Precision : 7
    @sap.label : 'Capacity Last Change Date Time'
    CapacityLastChangeDateTime : Timestamp;
    to_CapacityInterval : Association to many A_WorkCenterCapacityInterval_2 {  };
    to_CapacityText : Association to many A_WorkCenterCapacityText {  };
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Capacity Interval'
  entity A_WorkCenterCapacityInterval {
    @sap.display.format : 'NonNegative'
    @sap.label : 'Object ID'
    @sap.quickinfo : 'Object ID of the resource'
    key WorkCenterInternalID : String(8) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Object Type'
    @sap.quickinfo : 'Object types of the CIM resource'
    key WorkCenterTypeCode : String(2) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity Allocation'
    @sap.quickinfo : 'Capacity Category Allocation'
    key CapacityCategoryAllocation : String(4) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity ID'
    key CapacityInternalID : String(8) not null;
    @sap.display.format : 'NonNegative'
    key CapacityActiveVersion : String(2) not null;
    @sap.display.format : 'Date'
    key IntervalEndDate : Date not null;
    @sap.display.format : 'Date'
    IntervalStartDate : Date;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center'
    WorkCenter : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Plant'
    Plant : String(4);
    WorkDayRule : String(1);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Interval Duration'
    @sap.quickinfo : 'Duration of an Available Capacity Interval'
    AvailableCapacityIntervalDurn : String(2);
    ShiftSequence : String(4);
    @sap.label : 'Capacity is Valid'
    @sap.quickinfo : 'Ind.: Standard Available Capacity is Valid for this Interval'
    StdAvailableCapacityIsValid : Boolean;
    to_WorkCenterShift : Association to many A_WorkCenterCapacityShift {  };
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Capacity Interval Version 2'
  entity A_WorkCenterCapacityInterval_2 {
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity ID'
    key CapacityInternalID : String(8) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Version'
    @sap.quickinfo : 'Available capacity version'
    key CapacityActiveVersion : String(2) not null;
    @sap.display.format : 'Date'
    @sap.label : 'Valid to'
    @sap.quickinfo : 'Valid-to date'
    key IntervalEndDate : Date not null;
    @sap.display.format : 'Date'
    @sap.label : 'Valid From'
    @sap.quickinfo : 'Valid-From Date'
    IntervalStartDate : Date;
    @sap.label : 'Capacity is Valid'
    @sap.quickinfo : 'Ind.: Standard Available Capacity is Valid for this Interval'
    StdAvailableCapacityIsValid : Boolean;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Interval Duration'
    @sap.quickinfo : 'Duration of an Available Capacity Interval'
    AvailableCapacityIntervalDurn : String(2);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Shift Sequence'
    @sap.quickinfo : 'Key for the Shift Sequence'
    ShiftSequence : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Workday Rule'
    @sap.quickinfo : 'Workday Rule Code'
    WorkDayRule : String(1);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Number of Shifts'
    @sap.quickinfo : 'Number of Shifts in a Day'
    CapacityNumberOfShifts : String(1);
    @sap.label : 'No. Ind. Capacities'
    @sap.quickinfo : 'Number of Individual Capacities'
    CapacityNumberOfCapacities : Integer;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity Utilization'
    @sap.quickinfo : 'Capacity Utilization Ratio in Percent'
    CapacityPlanUtilizationPercent : String(3);
    @odata.Type : 'Edm.DateTimeOffset'
    @odata.Precision : 7
    @sap.label : 'Capacity Last Change Date Time'
    CapacityLastChangeDateTime : Timestamp;
    to_CapacityShift : Association to many A_WorkCenterCapacityShift_2 {  };
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Capacity Shift'
  entity A_WorkCenterCapacityShift {
    @sap.display.format : 'NonNegative'
    @sap.label : 'Object ID'
    @sap.quickinfo : 'Object ID of the resource'
    key WorkCenterInternalID : String(8) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Object Type'
    @sap.quickinfo : 'Object types of the CIM resource'
    key WorkCenterTypeCode : String(2) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Work center cap. no.'
    @sap.quickinfo : 'Capacity allocation number'
    key CapacityCategoryAllocation : String(4) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity ID'
    key CapacityInternalID : String(8) not null;
    @sap.display.format : 'NonNegative'
    key CapacityActiveVersion : String(2) not null;
    @sap.display.format : 'Date'
    key IntervalEndDate : Date not null;
    key WeekDay : String(1) not null;
    key AvailableCapacityShift : String(1) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center'
    WorkCenter : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Plant'
    Plant : String(4);
    @sap.display.format : 'Date'
    IntervalStartDate : Date;
    ShiftName : String(4);
    @sap.display.format : 'Date'
    ShiftDefValidityStart : Date;
    @sap.display.format : 'Date'
    ShiftDefValidityEnd : Date;
    ShiftStartTime : Time;
    ShiftEndTime : Time;
    CapacityBreakDuration : Integer;
    @sap.display.format : 'NonNegative'
    CapacityPlanUtilizationPercent : String(3);
    CapacityNumberOfCapacities : Integer;
    @sap.unit : 'TotOperationDurationUnit'
    @sap.label : 'dec17_3'
    @sap.quickinfo : 'Decimal 17_3'
    TotOperatingDurationInHours : Decimal(17, 3);
    @sap.label : 'Base Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    TotOperationDurationUnit : String(3);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Capacity Shift Version 2'
  entity A_WorkCenterCapacityShift_2 {
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity ID'
    key CapacityInternalID : String(8) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Version'
    @sap.quickinfo : 'Available capacity version'
    key CapacityActiveVersion : String(2) not null;
    @sap.display.format : 'Date'
    @sap.label : 'Valid to'
    @sap.quickinfo : 'Valid-to date'
    key IntervalEndDate : Date not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Week Day'
    key WeekDay : String(1) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity Shift'
    @sap.quickinfo : 'Shift Number of an Available Capacity'
    key AvailableCapacityShift : String(1) not null;
    @sap.display.format : 'Date'
    @sap.label : 'Valid From'
    @sap.quickinfo : 'Valid-From Date'
    IntervalStartDate : Date;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Workday Rule'
    @sap.quickinfo : 'Workday Rule Code'
    WorkDayRule : String(1);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Shift Definition'
    ShiftDefinition : String(4);
    @sap.label : 'Start Time'
    ShiftStartTime : Time;
    @sap.label : 'End Time'
    ShiftEndTime : Time;
    @sap.display.format : 'Date'
    @sap.label : 'Start Date'
    ShiftDefValidityStartDate : Date;
    @sap.display.format : 'Date'
    @sap.label : 'End Date'
    ShiftDefValidityEndDate : Date;
    @sap.label : 'No. Ind. Capacities'
    @sap.quickinfo : 'Number of Individual Capacities'
    CapacityNumberOfCapacities : Integer;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity Utilization'
    @sap.quickinfo : 'Capacity Utilization Ratio in Percent'
    CapacityPlanUtilizationPercent : String(3);
    @sap.label : 'Break Duration'
    @sap.quickinfo : 'Cumulative Break Duration in Seconds (internal)'
    CapacityBreakDuration : Integer;
    @sap.label : 'Operating Duration'
    @sap.quickinfo : 'Operating Duration in Seconds'
    OperatingDurationInSeconds : Integer;
    @sap.label : 'Total Operating Duration In Seconds'
    TotOperatingDurationInSeconds : Integer;
    @odata.Type : 'Edm.DateTimeOffset'
    @odata.Precision : 7
    @sap.label : 'Capacity Last Change Date Time'
    CapacityLastChangeDateTime : Timestamp;
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Capacity Description'
  entity A_WorkCenterCapacityText {
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity ID'
    key CapacityInternalID : String(8) not null;
    @sap.label : 'Language Key'
    key Language : String(2) not null;
    @sap.label : 'Capacity Text'
    @sap.quickinfo : 'Capacity Short Text'
    CapacityText : String(40);
    @odata.Type : 'Edm.DateTimeOffset'
    @odata.Precision : 7
    @sap.label : 'Capacity Last Change Date Time'
    CapacityLastChangeDateTime : Timestamp;
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Daily Operations Capacity'
  entity A_WorkCenterCapDayOp {
    @sap.display.format : 'UpperCase'
    @sap.label : 'Plant'
    key Plant : String(4) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'MRP Controller'
    key MRPController : String(3) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center'
    key WorkCenter : String(8) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity ID'
    key CapacityInternalID : String(8) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity Requirement'
    @sap.quickinfo : 'ID of the Capacity Requirements Record'
    key CapacityRequirement : String(12) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Material'
    @sap.quickinfo : 'Material Number for Order'
    key Material : String(40) not null;
    key OrderID : String(12) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Activity'
    @sap.quickinfo : 'Activity Number'
    key Operation : String(4) not null;
    @sap.label : 'Work Center Text'
    WorkCenterDesc : String(40);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Person Responsible'
    @sap.quickinfo : 'Person Responsible for the Work Center'
    WorkCenterResponsible : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center Category'
    WorkCenterCategoryCode : String(4);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Object ID'
    @sap.quickinfo : 'Object ID of the resource'
    WorkCenterInternalID : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Capacity Requirement Origin'
    CapacityRequirementOrigin : String(1);
    @sap.label : 'Capacity Unit'
    @sap.quickinfo : 'Unit of Measure for Capacity Requirements'
    @sap.semantics : 'unit-of-measure'
    CapacityRequirementUnit : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Order Type'
    OrderType : String(4);
    @sap.label : 'Type Name'
    @sap.quickinfo : 'Planned Order Type Name'
    OrderTypeName : String(60);
    @sap.unit : 'BaseUnit'
    @sap.label : 'Total Order Quantity'
    OrderPlannedTotalQty : Decimal(13, 3);
    @sap.label : 'Base Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    BaseUnit : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Production Version'
    ProductionVersion : String(4);
    @sap.label : 'Short Description'
    @sap.quickinfo : 'Short Text for Fixed Values'
    OperationPlanningStatusText : String(60);
    OperationPlanningStatusCode : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'char8'
    @sap.quickinfo : 'Character field, 8 characters long'
    OperationLatestStartDate : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Reserve'
    @sap.quickinfo : 'Character field of length 6'
    OperationLatestStartTime : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'char8'
    @sap.quickinfo : 'Character field, 8 characters long'
    OperationLatestEndDate : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Reserve'
    @sap.quickinfo : 'Character field of length 6'
    OperationLatestEndTime : String(6);
    @sap.label : 'Status'
    @sap.quickinfo : 'Individual Status of an Object'
    OrderStatusText : String(30);
    OrderStatusCode : String(5);
    @sap.label : 'Short Description'
    @sap.quickinfo : 'Short Text for Fixed Values'
    OrderFirmingStatusText : String(60);
    @sap.display.format : 'UpperCase'
    @sap.label : 'char8'
    @sap.quickinfo : 'Character field, 8 characters long'
    OpLtstSchedldProcgStrtDte : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Reserve'
    @sap.quickinfo : 'Character field of length 6'
    OpLtstSchedldProcgStrtTme : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'char8'
    @sap.quickinfo : 'Character field, 8 characters long'
    OpLtstSchedldTrdwnStrtDte : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Reserve'
    @sap.quickinfo : 'Character field of length 6'
    OpLtstSchedldTrdwnStrtTme : String(6);
    RemainingCapReqOpSegSetupDurn : Decimal(10, 2);
    RemainingCapReqOpSegProcgDurn : Decimal(10, 2);
    RemainingCapReqOpSegTrdwnDurn : Decimal(10, 2);
    CapacityRequirementsAreDtmnd : Decimal(10, 2);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Order Internal ID'
    OrderInternalID : String(10);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.addressable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Operation Load Distribution'
  entity A_WorkCenterCapOrderPerBucketSet {
    @sap.display.format : 'Date'
    @sap.label : 'Date'
    key P_CapEvalStartDate : Date not null;
    @sap.display.format : 'Date'
    @sap.label : 'Date'
    key P_CapEvalEndDate : Date not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Single-Character Flag'
    key P_CapEvalBucketType : String(1) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Plant'
    key Plant : String(4) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'MRP controller'
    @sap.quickinfo : 'MRP controller for the order'
    key MRPController : String(3) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center'
    key WorkCenter : String(8) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Object Type'
    @sap.quickinfo : 'Object types of the CIM resource'
    key WorkCenterTypeCode : String(2) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity Allocation'
    @sap.quickinfo : 'Capacity Category Allocation'
    key CapacityCategoryAllocation : String(4) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity ID'
    key CapacityInternalID : String(8) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Material'
    @sap.quickinfo : 'Material Number'
    key Material : String(40) not null;
    key OrderID : String(12) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Activity'
    @sap.quickinfo : 'Activity Number'
    key Operation : String(4) not null;
    key CapacityEvaluationTimePeriod : String(10) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Shift Definition'
    key ShiftName : String(4) not null;
    CapEvalBucketType : String(1);
    @sap.label : 'Short Description'
    @sap.quickinfo : 'Short Text for Fixed Values'
    CapacityEvaluationTimePerdText : String(60);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Factory Calendar'
    @sap.quickinfo : 'Factory Calendar ID'
    FactoryCalendar : String(2);
    @sap.label : 'Work Center Text'
    WorkCenterDesc : String(40);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Person Responsible'
    @sap.quickinfo : 'Person Responsible for the Work Center'
    WorkCenterResponsible : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center Category'
    WorkCenterCategoryCode : String(4);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Object ID'
    @sap.quickinfo : 'Object ID of the resource'
    WorkCenterInternalID : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Capacity Requirement Origin'
    CapacityRequirementOrigin : String(1);
    @sap.label : 'Capacity Unit'
    @sap.quickinfo : 'Unit of Measure for Capacity Requirements'
    @sap.semantics : 'unit-of-measure'
    CapacityRequirementUnit : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Order Type'
    OrderType : String(4);
    @sap.label : 'Type Name'
    @sap.quickinfo : 'Planned Order Type Name'
    OrderTypeName : String(60);
    @sap.unit : 'BaseUnit'
    @sap.label : 'Total Order Quantity'
    OrderPlannedTotalQty : Decimal(13, 3);
    @sap.label : 'Base Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    BaseUnit : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Order Category'
    OrderCategory : String(2);
    @sap.label : 'Category Name'
    @sap.quickinfo : 'Planned Order Category Name'
    OrderCategoryName : String(60);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Production Version'
    ProductionVersion : String(4);
    @sap.label : 'Short Description'
    @sap.quickinfo : 'Short Text for Fixed Values'
    OperationPlanningStatusText : String(60);
    OperationPlanningStatusCode : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'char8'
    @sap.quickinfo : 'Character field, 8 characters long'
    OperationLatestStartDate : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Reserve'
    @sap.quickinfo : 'Character field of length 6'
    OperationLatestStartTime : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'char8'
    @sap.quickinfo : 'Character field, 8 characters long'
    OperationLatestEndDate : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Reserve'
    @sap.quickinfo : 'Character field of length 6'
    OperationLatestEndTime : String(6);
    @sap.label : 'Status'
    @sap.quickinfo : 'Individual Status of an Object'
    OrderStatusText : String(30);
    OrderStatusCode : String(5);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Single-Character Flag'
    @sap.heading : ''
    OrderFirmingStatusCode : String(1);
    @sap.label : 'Short Description'
    @sap.quickinfo : 'Short Text for Fixed Values'
    OrderFirmingStatusText : String(60);
    @sap.display.format : 'UpperCase'
    @sap.label : 'char8'
    @sap.quickinfo : 'Character field, 8 characters long'
    OpLtstSchedldProcgStrtDte : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Reserve'
    @sap.quickinfo : 'Character field of length 6'
    OpLtstSchedldProcgStrtTme : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'char8'
    @sap.quickinfo : 'Character field, 8 characters long'
    OpLtstSchedldTrdwnStrtDte : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Reserve'
    @sap.quickinfo : 'Character field of length 6'
    OpLtstSchedldTrdwnStrtTme : String(6);
    @sap.unit : 'CapacityRequirementUnit'
    RemainingCapReqOpSegSetupDurn : Decimal(10, 2);
    @sap.unit : 'CapacityRequirementUnit'
    RemainingCapReqOpSegProcgDurn : Decimal(10, 2);
    @sap.unit : 'CapacityRequirementUnit'
    RemainingCapReqOpSegTrdwnDurn : Decimal(10, 2);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Order Internal ID'
    OrderInternalID : String(10);
    CapacityStartTime : Decimal(10, 2);
    CapacityEndTime : Decimal(10, 2);
    @sap.unit : 'WorkCenterCapacityUnit'
    WorkCenterAvailableCapacity : Decimal(10, 2);
    @sap.unit : 'WorkCenterCapacityUnit'
    WorkCenterCapRqmtInCapUnit : Decimal(10, 2);
    @sap.label : 'Base Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    WorkCenterCapacityUnit : String(3);
    @sap.label : 'Meas. Unit Text'
    @sap.quickinfo : 'Unit of Measurement Text (Maximum 10 Characters)'
    WorkCenterCapUnitText : String(10);
    @sap.filterable : 'false'
    Parameters : Association to A_WorkCenterCapOrderPerBucket {  };
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.pageable : 'false'
  @sap.content.version : '1'
  @sap.semantics : 'parameters'
  entity A_WorkCenterCapOrderPerBucket {
    @sap.display.format : 'Date'
    @sap.parameter : 'mandatory'
    @sap.label : 'Date'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key P_CapEvalStartDate : Date not null;
    @sap.display.format : 'Date'
    @sap.parameter : 'mandatory'
    @sap.label : 'Date'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key P_CapEvalEndDate : Date not null;
    @sap.display.format : 'UpperCase'
    @sap.parameter : 'mandatory'
    @sap.label : 'Single-Character Flag'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key P_CapEvalBucketType : String(1) not null;
    Set : Association to many A_WorkCenterCapOrderPerBucketSet {  };
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.addressable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Capacity Evaluation'
  entity A_WorkCenterCapPerBucketSet {
    @sap.display.format : 'Date'
    @sap.label : 'Date'
    key P_CapEvalStartDate : Date not null;
    @sap.display.format : 'Date'
    @sap.label : 'Date'
    key P_CapEvalEndDate : Date not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Single-Character Flag'
    key P_CapEvalBucketType : String(1) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Plant'
    key Plant : String(4) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center'
    key WorkCenter : String(8) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity ID'
    key CapacityInternalID : String(8) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Shift Definition'
    key ShiftName : String(4) not null;
    key CapacityEvaluationTimePeriod : String(10) not null;
    key CapEvalBucketType : String(1) not null;
    @sap.label : 'Short Description'
    @sap.quickinfo : 'Short Text for Fixed Values'
    CapacityEvaluationTimePerdText : String(60);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Object ID'
    @sap.quickinfo : 'Object ID of the resource'
    WorkCenterInternalID : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Person Responsible'
    @sap.quickinfo : 'Person Responsible for the Work Center'
    WorkCenterResponsible : String(3);
    @sap.label : 'Start Time'
    @sap.quickinfo : 'Start time in seconds (internal)'
    CapacityStartTime : Integer;
    @sap.label : 'End Time'
    @sap.quickinfo : 'End Time in Seconds (internal)'
    CapacityEndTime : Integer;
    @sap.unit : 'WorkCenterCapacityUnit'
    WorkCenterAvailableCapacity : Decimal(10, 2);
    @sap.unit : 'WorkCenterCapacityUnit'
    WorkCenterCapRqmtInCapUnit : Decimal(10, 2);
    @sap.unit : 'WorkCenterCapacityUnit'
    WrkCtrRmngCapInCapUnit : Decimal(11, 2);
    WorkCenterTotUtilznInTmePerd : Double;
    @sap.label : 'Base Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    WorkCenterCapacityUnit : String(3);
    @sap.label : 'Meas. Unit Text'
    @sap.quickinfo : 'Unit of Measurement Text (Maximum 10 Characters)'
    WorkCenterCapUnitText : String(10);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Object Type'
    @sap.quickinfo : 'Object types of the CIM resource'
    WorkCenterTypeCode : String(2);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity Allocation'
    @sap.quickinfo : 'Capacity Category Allocation'
    CapacityCategoryAllocation : String(4);
    @sap.filterable : 'false'
    Parameters : Association to A_WorkCenterCapPerBucket {  };
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.pageable : 'false'
  @sap.content.version : '1'
  @sap.semantics : 'parameters'
  entity A_WorkCenterCapPerBucket {
    @sap.display.format : 'Date'
    @sap.parameter : 'mandatory'
    @sap.label : 'Date'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key P_CapEvalStartDate : Date not null;
    @sap.display.format : 'Date'
    @sap.parameter : 'mandatory'
    @sap.label : 'Date'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key P_CapEvalEndDate : Date not null;
    @sap.display.format : 'UpperCase'
    @sap.parameter : 'mandatory'
    @sap.label : 'Single-Character Flag'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    key P_CapEvalBucketType : String(1) not null;
    Set : Association to many A_WorkCenterCapPerBucketSet {  };
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Queued Operations Capacity'
  entity A_WorkCenterCapPplineOp {
    @sap.display.format : 'UpperCase'
    @sap.label : 'Plant'
    key Plant : String(4) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'MRP Controller'
    key MRPController : String(3) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center'
    key WorkCenter : String(8) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity ID'
    key CapacityInternalID : String(8) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity Requirement'
    @sap.quickinfo : 'ID of the Capacity Requirements Record'
    key CapacityRequirement : String(12) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Material'
    @sap.quickinfo : 'Material Number for Order'
    key Material : String(40) not null;
    key OrderID : String(12) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Activity'
    @sap.quickinfo : 'Activity Number'
    key Operation : String(4) not null;
    @sap.label : 'Work Center Text'
    WorkCenterDesc : String(40);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Person Responsible'
    @sap.quickinfo : 'Person Responsible for the Work Center'
    WorkCenterResponsible : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center Category'
    WorkCenterCategoryCode : String(4);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Object ID'
    @sap.quickinfo : 'Object ID of the resource'
    WorkCenterInternalID : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Capacity Requirement Origin'
    CapacityRequirementOrigin : String(1);
    @sap.label : 'Capacity Unit'
    @sap.quickinfo : 'Unit of Measure for Capacity Requirements'
    @sap.semantics : 'unit-of-measure'
    CapacityRequirementUnit : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Order Type'
    OrderType : String(4);
    @sap.label : 'Type Name'
    @sap.quickinfo : 'Planned Order Type Name'
    OrderTypeName : String(60);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Order Category'
    OrderCategory : String(2);
    @sap.label : 'Category Name'
    @sap.quickinfo : 'Planned Order Category Name'
    OrderCategoryName : String(60);
    @sap.label : 'Base Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    BaseUnit : String(3);
    @sap.unit : 'BaseUnit'
    @sap.label : 'Total Order Quantity'
    OrderPlannedTotalQty : Decimal(13, 3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Production Version'
    ProductionVersion : String(4);
    OperationPlanningStatusCode : String(4);
    @sap.label : 'Short Description'
    @sap.quickinfo : 'Short Text for Fixed Values'
    OperationPlanningStatusText : String(60);
    @sap.display.format : 'UpperCase'
    @sap.label : 'char8'
    @sap.quickinfo : 'Character field, 8 characters long'
    OperationLatestStartDate : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Reserve'
    @sap.quickinfo : 'Character field of length 6'
    OperationLatestStartTime : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'char8'
    @sap.quickinfo : 'Character field, 8 characters long'
    OperationLatestEndDate : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Reserve'
    @sap.quickinfo : 'Character field of length 6'
    OperationLatestEndTime : String(6);
    OrderStatusCode : String(5);
    @sap.label : 'Status'
    @sap.quickinfo : 'Individual Status of an Object'
    OrderStatusText : String(30);
    @sap.label : 'Status'
    @sap.quickinfo : 'Individual status of an object (short form)'
    OrderStatusShortText : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Single-Character Flag'
    @sap.heading : ''
    OrderFirmingStatusCode : String(1);
    @sap.label : 'Short Description'
    @sap.quickinfo : 'Short Text for Fixed Values'
    OrderFirmingStatusText : String(60);
    @sap.display.format : 'UpperCase'
    @sap.label : 'char8'
    @sap.quickinfo : 'Character field, 8 characters long'
    OpLtstSchedldProcgStrtDte : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Reserve'
    @sap.quickinfo : 'Character field of length 6'
    OpLtstSchedldProcgStrtTme : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'char8'
    @sap.quickinfo : 'Character field, 8 characters long'
    OpLtstSchedldTrdwnStrtDte : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Reserve'
    @sap.quickinfo : 'Character field of length 6'
    OpLtstSchedldTrdwnStrtTme : String(6);
    @sap.unit : 'CapacityRequirementUnit'
    RemainingCapReqOpSegSetupDurn : Decimal(10, 2);
    @sap.unit : 'CapacityRequirementUnit'
    RemainingCapReqOpSegProcgDurn : Decimal(10, 2);
    @sap.unit : 'CapacityRequirementUnit'
    RemainingCapReqOpSegTrdwnDurn : Decimal(10, 2);
    CapacityRequirementsAreDtmnd : Decimal(10, 2);
    @sap.unit : 'CapacityRequirementUnit'
    RemainingCapReqExecutionDurn : Decimal(10, 2);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Order Internal ID'
    OrderInternalID : String(10);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Cost Center Allocation'
  entity A_WorkCenterCostCenter {
    @sap.display.format : 'NonNegative'
    @sap.label : 'Object ID'
    @sap.quickinfo : 'Object ID of the resource'
    key WorkCenterInternalID : String(8) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Object Type'
    @sap.quickinfo : 'Object types of the CIM resource'
    key WorkCenterTypeCode : String(2) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Cost Center Allocation'
    key CostCenterAllocation : String(4) not null;
    @sap.display.format : 'Date'
    @sap.label : 'End Date'
    key ValidityEndDate : Date not null;
    @sap.display.format : 'Date'
    @sap.label : 'Start date'
    @sap.quickinfo : 'Start Date'
    ValidityStartDate : Date;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center'
    WorkCenter : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Plant'
    Plant : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center Category'
    WorkCenterCategoryCode : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Controlling Area'
    ControllingArea : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Cost Center'
    CostCenter : String(10);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Activity Type'
    CostCtrActivityType : String(6);
    @sap.label : 'Activity Unit'
    @sap.semantics : 'unit-of-measure'
    CostCtrActivityTypeQtyUnit : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Business Process'
    BusinessProcess : String(12);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Activity Description Origin Type'
    ActivityDescOriginType : String(1);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Alternative Activity Description ID'
    @sap.quickinfo : 'ID for Alternative Activity Description'
    CostCenterActivityAltvDescID : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Formula key costing'
    @sap.quickinfo : 'Formula key for costing'
    CostCenterActivityTypeFormula : String(6);
    @sap.label : 'Reference indicator'
    @sap.quickinfo : 'Field is referenced'
    CostCtrActyTypeIsReferenced : Boolean;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Incentive wages ind.'
    @sap.quickinfo : 'Transfer activity types to incentive wages'
    CostCtrActyTypeIncntvWageCode : String(1);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Rec. type group'
    @sap.quickinfo : 'Record type group'
    CostCtrActyTypeRecdTypeGrpCode : String(1);
    @odata.Type : 'Edm.DateTimeOffset'
    @odata.Precision : 7
    @sap.label : 'Date and Time of Last Change'
    WorkCenterLastChangeDateTime : Timestamp;
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Daily Operations'
  entity A_WorkCenterDayOperation {
    @sap.display.format : 'NonNegative'
    @sap.label : 'Work Center Internal'
    @sap.quickinfo : 'Work Center Internal ID'
    key WorkCenterInternalID : String(8) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Production Order'
    @sap.quickinfo : 'Manufacturing Order ID'
    key ManufacturingOrder : String(12) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Operation'
    @sap.quickinfo : 'Manufacturing Order Operation'
    key ManufacturingOrderOperation : String(4) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Order Category'
    @sap.quickinfo : 'Manufacturing Order Category'
    key ManufacturingOrderCategory : String(2) not null;
    @sap.label : 'Operation Text'
    @sap.quickinfo : 'Manufacturing Order Operation Text'
    MfgOrderOperationText : String(40);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Material'
    @sap.quickinfo : 'Material Number for Order'
    Material : String(40);
    @sap.label : 'Operation Is Released'
    @sap.quickinfo : 'Boolean Variable (X = True, - = False, Space = Unknown)'
    OperationIsReleased : Boolean;
    @sap.display.format : 'Date'
    @sap.label : 'Planned Start Date'
    @sap.quickinfo : 'Earliest Scheduled Execution Start Date'
    OpErlstSchedldExecStrtDte : Date;
    @sap.label : 'Planned Start Time'
    @sap.quickinfo : 'Earliest Scheduled Execution Start Time'
    OpErlstSchedldExecStrtTme : Time;
    @sap.display.format : 'Date'
    @sap.label : 'Planned End Date'
    @sap.quickinfo : 'Earliest Scheduled Execution End Date'
    OpErlstSchedldExecEndDte : Date;
    @sap.label : 'Planned End Time'
    @sap.quickinfo : 'Earliest Scheduled Execution End Time'
    OpErlstSchedldExecEndTme : Time;
    @sap.unit : 'OperationUnit'
    @sap.label : 'Operation Quantity'
    @sap.quickinfo : 'Operation Total Quantity'
    OpPlannedTotalQuantity : Decimal(13, 3);
    @sap.label : 'Operation Unit'
    @sap.quickinfo : 'Operation Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    OperationUnit : String(3);
    @sap.unit : 'ConfirmedQuantityUnit'
    ConfirmedQuantity : Decimal(13, 3);
    @sap.unit : 'ConfirmedQuantityUnit'
    @sap.label : 'Production Unit'
    @sap.quickinfo : 'Production Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    ConfirmedQuantityInBaseUnit : String(3);
    @sap.label : 'Production Unit'
    @sap.quickinfo : 'Production Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    ConfirmedQuantityUnit : String(3);
    @sap.label : 'Planned Duration'
    @sap.quickinfo : 'Earliest Scheduled Execution Duration in Workdays'
    ErlstSchedldExecDurnInWorkdays : Integer;
    @sap.label : 'Actual Duration'
    @sap.quickinfo : 'Actual Execution Duration in Workdays'
    OpActualExecutionDays : Integer;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Sequence'
    @sap.quickinfo : 'Manufacturing Order Sequence'
    ManufacturingOrderSequence : String(6);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Description'
  entity A_WorkCenterDescription {
    @sap.display.format : 'NonNegative'
    @sap.label : 'Object ID'
    @sap.quickinfo : 'Object ID of the resource'
    key WorkCenterInternalID : String(8) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Resource Type'
    @sap.quickinfo : 'Production Resource Type'
    key WorkCenterTypeCode : String(2) not null;
    @sap.label : 'Language Key'
    key Language : String(2) not null;
    @sap.label : 'Work Center Text'
    WorkCenterDesc : String(40);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center'
    WorkCenter : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Plant'
    Plant : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center Category'
    WorkCenterCategoryCode : String(4);
    @odata.Type : 'Edm.DateTimeOffset'
    @odata.Precision : 7
    @sap.label : 'Date and Time of Last Change'
    WorkCenterLastChangeDateTime : Timestamp;
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Queued Operations'
  entity A_WorkCenterPipeLineOperation {
    @sap.display.format : 'NonNegative'
    @sap.label : 'Work Center Internal'
    @sap.quickinfo : 'Work Center Internal ID'
    key WorkCenterInternalID : String(8) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Production Order'
    @sap.quickinfo : 'Manufacturing Order ID'
    key ManufacturingOrder : String(12) not null;
    @sap.display.format : 'UpperCase'
    @sap.text : 'MfgOrderOperationText'
    @sap.label : 'Operation'
    @sap.quickinfo : 'Manufacturing Order Operation'
    key ManufacturingOrderOperation : String(4) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Order Category'
    @sap.quickinfo : 'Manufacturing Order Category'
    key ManufacturingOrderCategory : String(2) not null;
    @sap.label : 'Operation Text'
    @sap.quickinfo : 'Manufacturing Order Operation Text'
    MfgOrderOperationText : String(40);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Material'
    @sap.quickinfo : 'Material Number for Order'
    Material : String(40);
    @sap.label : 'Operation Is Released'
    @sap.quickinfo : 'Boolean Variable (X = True, - = False, Space = Unknown)'
    OperationIsReleased : Boolean;
    @sap.display.format : 'Date'
    @sap.label : 'Planned Start Date'
    @sap.quickinfo : 'Earliest Scheduled Execution Start Date'
    OpErlstSchedldExecStrtDte : Date;
    @sap.label : 'Planned Start Time'
    @sap.quickinfo : 'Earliest Scheduled Execution Start Time'
    OpErlstSchedldExecStrtTme : Time;
    @sap.display.format : 'Date'
    @sap.label : 'Planned End Date'
    @sap.quickinfo : 'Earliest Scheduled Execution End Date'
    OpErlstSchedldExecEndDte : Date;
    @sap.label : 'Planned End Time'
    @sap.quickinfo : 'Earliest Scheduled Execution End Time'
    OpErlstSchedldExecEndTme : Time;
    @sap.unit : 'OperationUnit'
    @sap.label : 'Total Queue Quantity'
    @sap.quickinfo : 'Operation Total Quantity'
    OpPlannedTotalQuantity : Decimal(13, 3);
    @sap.label : 'Operation Unit'
    @sap.quickinfo : 'Operation Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    OperationUnit : String(3);
    @sap.unit : 'ConfirmedQuantityUnit'
    @sap.label : 'Confirmed Quantity'
    ConfirmedQuantity : Decimal(13, 3);
    @sap.unit : 'ConfirmedQuantityUnit'
    @sap.label : 'Base Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    ConfirmedQuantityInBaseUnit : String(3);
    @sap.label : 'Production Unit'
    @sap.quickinfo : 'Production Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    ConfirmedQuantityUnit : String(3);
    @sap.label : 'Planned Duration'
    @sap.quickinfo : 'Earliest Scheduled Execution Duration in Workdays'
    ErlstSchedldExecDurnInWorkdays : Integer;
    @sap.label : 'Remaining Duration'
    RemainingDuration : Integer;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Sequence'
    @sap.quickinfo : 'Manufacturing Order Sequence'
    ManufacturingOrderSequence : String(6);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Header'
  entity A_WorkCenters {
    @sap.display.format : 'NonNegative'
    @sap.label : 'Work Center Internal Id'
    @sap.quickinfo : 'Object ID of the resource'
    key WorkCenterInternalID : String(8) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center Type Code'
    @sap.quickinfo : 'Object types of the CIM resource'
    key WorkCenterTypeCode : String(2) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center'
    WorkCenter : String(8);
    @sap.label : 'Work Center Text'
    WorkCenterDesc : String(40);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Plant'
    Plant : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center Category'
    WorkCenterCategoryCode : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Person Responsible'
    @sap.quickinfo : 'Person Responsible for the Work Center'
    WorkCenterResponsible : String(3);
    @sap.label : 'Name of Responsible'
    @sap.quickinfo : 'Work Center Responsible Name'
    WorkCenterResponsibleName : String(40);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Prodn Supply Area'
    @sap.quickinfo : 'Production Supply Area'
    SupplyArea : String(10);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Work Center Usage'
    @sap.quickinfo : 'Work Center Usage in Bill of Operations'
    WorkCenterUsage : String(3);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Capacity ID'
    CapacityInternalID : String(8);
    @sap.label : 'Deletion Flag'
    @sap.quickinfo : 'Deletion flag for work center'
    WorkCenterIsToBeDeleted : Boolean;
    @sap.display.format : 'Date'
    @sap.label : 'Valid-From Date'
    ValidityStartDate : Date;
    @sap.display.format : 'Date'
    @sap.label : 'Valid-To Date'
    ValidityEndDate : Date;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Formula Parameter 1'
    @sap.quickinfo : 'Work Center Formula Parameter 1'
    WorkCenterFormulaParam1 : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Formula Parameter 2'
    @sap.quickinfo : 'Work Center Formula Parameter 2'
    WorkCenterFormulaParam2 : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Formula Parameter 3'
    @sap.quickinfo : 'Work Center Formula Parameter 3'
    WorkCenterFormulaParam3 : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Formula Parameter 4'
    @sap.quickinfo : 'Work Center Formula Parameter 4'
    WorkCenterFormulaParam4 : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Formula Parameter 5'
    @sap.quickinfo : 'Work Center Formula Parameter 5'
    WorkCenterFormulaParam5 : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Formula Parameter 6'
    @sap.quickinfo : 'Work Center Formula Parameter 6'
    WorkCenterFormulaParam6 : String(6);
    @sap.unit : 'WorkCenterFmlaParamUnit1'
    @sap.label : 'Formula Parameter Value 1'
    @sap.quickinfo : 'Work Center Formula Parameter Value 1'
    WorkCenterFmlaParamValue1 : Decimal(9, 3);
    @sap.unit : 'WorkCenterFmlaParamUnit2'
    @sap.label : 'Formula Parameter Value 2'
    @sap.quickinfo : 'Work Center Formula Parameter Value 2'
    WorkCenterFmlaParamValue2 : Decimal(9, 3);
    @sap.unit : 'WorkCenterFmlaParamUnit3'
    @sap.label : 'Formula Parameter Value 3'
    @sap.quickinfo : 'Work Center Formula Parameter Value 3'
    WorkCenterFmlaParamValue3 : Decimal(9, 3);
    @sap.unit : 'WorkCenterFmlaParamUnit4'
    @sap.label : 'Formula Parameter Value 4'
    @sap.quickinfo : 'Work Center Formula Parameter Value 4'
    WorkCenterFmlaParamValue4 : Decimal(9, 3);
    @sap.unit : 'WorkCenterFmlaParamUnit5'
    @sap.label : 'Formula Parameter Value 5'
    @sap.quickinfo : 'Work Center Formula Parameter Value 5'
    WorkCenterFmlaParamValue5 : Decimal(9, 3);
    @sap.unit : 'WorkCenterFmlaParamUnit6'
    @sap.label : 'Formula Parameter Value 6'
    @sap.quickinfo : 'Work Center Formula Parameter Value 6'
    WorkCenterFmlaParamValue6 : Decimal(9, 3);
    @sap.label : 'Formula Parameter Unit 1'
    @sap.quickinfo : 'Work Center Formula Parameter Unit 1'
    @sap.semantics : 'unit-of-measure'
    WorkCenterFmlaParamUnit1 : String(3);
    @sap.label : 'Formula Parameter Unit 2'
    @sap.quickinfo : 'Work Center Formula Parameter Unit 2'
    @sap.semantics : 'unit-of-measure'
    WorkCenterFmlaParamUnit2 : String(3);
    @sap.label : 'Formula Parameter Unit 3'
    @sap.quickinfo : 'Work Center Formula Parameter Unit 3'
    @sap.semantics : 'unit-of-measure'
    WorkCenterFmlaParamUnit3 : String(3);
    @sap.label : 'Formula Parameter Unit 4'
    @sap.quickinfo : 'Work Center Formula Parameter Unit 4'
    @sap.semantics : 'unit-of-measure'
    WorkCenterFmlaParamUnit4 : String(3);
    @sap.label : 'Formula Parameter Unit 5'
    @sap.quickinfo : 'Work Center Formula Parameter Unit 5'
    @sap.semantics : 'unit-of-measure'
    WorkCenterFmlaParamUnit5 : String(3);
    @sap.label : 'Formula Parameter Unit 6'
    @sap.quickinfo : 'Work Center Formula Parameter Unit 6'
    @sap.semantics : 'unit-of-measure'
    WorkCenterFmlaParamUnit6 : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Standard Value Key'
    StandardWorkFormulaParamGroup : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Standard Value Maintenance Rule 1'
    WrkCtrStdValMaintRule1 : String(1);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Standard Value Maintenance Rule 2'
    WrkCtrStdValMaintRule2 : String(1);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Standard Value Maintenance Rule 3'
    WrkCtrStdValMaintRule3 : String(1);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Standard Value Maintenance Rule 4'
    WrkCtrStdValMaintRule4 : String(1);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Standard Value Maintenance Rule 5'
    WrkCtrStdValMaintRule5 : String(1);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Standard Value Maintenance Rule 6'
    WrkCtrStdValMaintRule6 : String(1);
    @sap.label : 'Work Quantity Unit 1'
    @sap.quickinfo : 'Standard Work Quantity Unit 1'
    @sap.semantics : 'unit-of-measure'
    WorkCenterStandardWorkQtyUnit1 : String(3);
    @sap.label : 'Work Quantity Unit 2'
    @sap.quickinfo : 'Standard Work Quantity Unit 2'
    @sap.semantics : 'unit-of-measure'
    WorkCenterStandardWorkQtyUnit2 : String(3);
    @sap.label : 'Work Quantity Unit 3'
    @sap.quickinfo : 'Standard Work Quantity Unit 3'
    @sap.semantics : 'unit-of-measure'
    WorkCenterStandardWorkQtyUnit3 : String(3);
    @sap.label : 'Work Quantity Unit 4'
    @sap.quickinfo : 'Standard Work Quantity Unit 4'
    @sap.semantics : 'unit-of-measure'
    WorkCenterStandardWorkQtyUnit4 : String(3);
    @sap.label : 'Work Quantity Unit 5'
    @sap.quickinfo : 'Standard Work Quantity Unit 5'
    @sap.semantics : 'unit-of-measure'
    WorkCenterStandardWorkQtyUnit5 : String(3);
    @sap.label : 'Work Quantity Unit 6'
    @sap.quickinfo : 'Standard Work Quantity Unit 6'
    @sap.semantics : 'unit-of-measure'
    WorkCenterStandardWorkQtyUnit6 : String(3);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Control Profile'
    @sap.quickinfo : 'Operation Control Profile'
    OperationControlProfile : String(4);
    @sap.label : 'Backflush'
    @sap.quickinfo : 'Indicator: Backflushing'
    MatlCompIsMarkedForBackflush : Boolean;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Location'
    @sap.quickinfo : 'Work center location'
    WorkCenterLocation : String(10);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Location Group'
    WorkCenterLocationGroup : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Duration of Setup'
    @sap.quickinfo : 'Formula for setup time'
    WrkCtrSetupSchedgFmla : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Processing Duration'
    @sap.quickinfo : 'Formula for the duration of processing time'
    WrkCtrProcgSchedgFmla : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Duration of Teardown'
    @sap.quickinfo : 'Formula for teardown time'
    WrkCtrTeardownSchedgFmla : String(6);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Internal Processing Duration'
    @sap.quickinfo : 'Formula for the Internal Processing Duration'
    WrkCtrIntProcgSchedgFmla : String(6);
    @odata.Type : 'Edm.DateTimeOffset'
    @odata.Precision : 7
    @sap.label : 'Date and Time of Last Change'
    WorkCenterLastChangeDateTime : Timestamp;
    to_Capacity : Association to A_WorkCenterCapacity {  };
    to_WorkCenterAllCapacity : Association to many A_WorkCenterAllCapacity_2 {  };
    to_WorkCenterCapacity : Association to many A_WorkCenterAllCapacity {  };
    to_WorkCenterCostCenter : Association to many A_WorkCenterCostCenter {  };
    to_WorkCenterDescription : Association to many A_WorkCenterDescription {  };
    to_WorkCenterQueuingOp : Association to many A_WorkCenterPipeLineOperation {  };
    to_WorkCenterTodayOp : Association to many A_WorkCenterDayOperation {  };
  };
};


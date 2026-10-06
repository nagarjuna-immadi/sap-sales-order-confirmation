/* checksum : 4caa4a517b09da90e9d3b3a2b25bfd7a */
@cds.external : true
@m.IsDefaultEntityContainer : 'true'
@sap.supported.formats : 'atom json xlsx'
service API_PRODUCT_AVAILY_INFO_BASIC {
  @cds.external : true
  type AvailabilityRecord {
    @odata.Type : 'Edm.DateTime'
    @sap.label : 'Perd Start Date Time'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    PeriodStartUTCDateTime : DateTime not null;
    @sap.label : 'Perd Start Time Zone'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    PeriodStartTimeZone : String(6) not null;
    @odata.Type : 'Edm.DateTime'
    @sap.label : 'Perd End Date Time'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    PeriodEndUTCDateTime : DateTime not null;
    @sap.label : 'Perd End Time Zone'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    PeriodEndTimeZone : String(6) not null;
    @sap.unit : 'BaseUnit'
    @sap.label : 'Available Quantity'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    AvailableQuantityInBaseUnit : Decimal(16, 3) not null;
    @sap.label : 'Unit'
    @sap.creatable : 'false'
    @sap.updatable : 'false'
    @sap.sortable : 'false'
    @sap.filterable : 'false'
    @sap.semantics : 'unit-of-measure'
    BaseUnit : String(3) not null;
  };

  @cds.external : true
  function DetermineAvailabilityAt(
    @sap.label : 'Plant'
    SupplyingPlant : String(4),
    @sap.label : 'Material'
    Material : String(40),
    @sap.label : 'Checking rule'
    ATPCheckingRule : String(2),
    @odata.Type : 'Edm.DateTimeOffset'
    @odata.Precision : 7
    @sap.label : 'Date'
    RequestedUTCDateTime : Timestamp
  ) returns AvailabilityRecord;

  @cds.external : true
  function DetermineAvailabilityOf(
    @sap.label : 'Requested Qty'
    RequestedQuantityInBaseUnit : Decimal(3, 3),
    @sap.label : 'Material'
    Material : String(40),
    @sap.label : 'Plant'
    SupplyingPlant : String(4),
    @sap.label : 'Checking rule'
    ATPCheckingRule : String(2)
  ) returns AvailabilityRecord;

  @cds.external : true
  function CalculateAvailabilityTimeseries(
    @sap.label : 'Checking rule'
    ATPCheckingRule : String(2),
    @sap.label : 'Material'
    Material : String(40),
    @sap.label : 'Plant'
    SupplyingPlant : String(4)
  ) returns many AvailabilityRecord;
};


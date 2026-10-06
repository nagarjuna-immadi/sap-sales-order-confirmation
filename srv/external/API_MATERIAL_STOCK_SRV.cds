/* checksum : 93b39af71b2a127956d9cbcc0b7225b3 */
@cds.external : true
@m.IsDefaultEntityContainer : 'true'
@sap.message.scope.supported : 'true'
@sap.supported.formats : 'atom json xlsx'
service API_MATERIAL_STOCK_SRV {
  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Serial Numbers with Material Stock'
  entity A_MaterialSerialNumber {
    @sap.display.format : 'UpperCase'
    @sap.label : 'Material'
    @sap.quickinfo : 'Material Number'
    key Material : String(40) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Serial Number'
    key SerialNumber : String(18) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Plant'
    Plant : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Storage Location'
    StorageLocation : String(4);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Special Stock'
    @sap.quickinfo : 'Special Stock Indicator'
    InventorySpecialStockType : String(1);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Stock batch'
    @sap.quickinfo : 'Batch Number'
    Batch : String(10);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Stock Type'
    @sap.quickinfo : 'Stock Type of Goods Movement (Primary Posting)'
    InventoryStockType : String(2);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Equipment'
    @sap.quickinfo : 'Equipment Number'
    Equipment : String(18);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Spec. stock customer'
    @sap.quickinfo : 'Special stock customer account number'
    Customer : String(10);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Special stock vendor'
    @sap.quickinfo : 'Account number of the vendor'
    Supplier : String(10);
    @sap.display.format : 'UpperCase'
    @sap.label : 'Sales Order'
    @sap.quickinfo : 'Sales Order Number'
    SDDocument : String(10);
    @sap.display.format : 'NonNegative'
    @sap.label : 'Sales Order Item'
    @sap.quickinfo : 'Item Number in Sales Order'
    SDDocumentItem : String(6);
    @sap.display.format : 'NonNegative'
    @sap.label : 'WBS Internal ID'
    @sap.quickinfo : 'WBS Element'
    WBSElementInternalID : String(8);
    @sap.display.format : 'UpperCase'
    @sap.label : 'WBS Element'
    @sap.quickinfo : 'Work Breakdown Structure Element (WBS Element) Edited'
    WBSElementExternalID : String(24);
    to_MatlStkInAcctMod : Association to many A_MatlStkInAcctMod {  };
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Material Master'
  entity A_MaterialStock {
    @sap.display.format : 'UpperCase'
    @sap.label : 'Material'
    @sap.quickinfo : 'Material Number'
    key Material : String(40) not null;
    @sap.label : 'Base Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    MaterialBaseUnit : String(3);
    to_MatlStkInAcctMod : Association to many A_MatlStkInAcctMod {  };
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.deletable : 'false'
  @sap.content.version : '1'
  @sap.label : 'Material Stock'
  entity A_MatlStkInAcctMod {
    @sap.display.format : 'UpperCase'
    @sap.label : 'Material for Stock Mamangement'
    key Material : String(40) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Plant'
    key Plant : String(4) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Storage Location'
    key StorageLocation : String(4) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Batch SID'
    @sap.quickinfo : 'Batch Number (Stock Identifier)'
    key Batch : String(10) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Supplier SID'
    @sap.quickinfo : 'Supplier for Special Stock'
    key Supplier : String(10) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Customer SID'
    @sap.quickinfo : 'Customer for Special Stock'
    key Customer : String(10) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'WBS Internal ID'
    @sap.quickinfo : 'WBS Element'
    key WBSElementInternalID : String(8) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Sales Order'
    @sap.quickinfo : 'Sales Order Number of Valuated Sales Order Stock'
    key SDDocument : String(10) not null;
    @sap.display.format : 'NonNegative'
    @sap.label : 'Sales Order Item'
    @sap.quickinfo : 'Sales Order Item of Valuated Sales Order Stock'
    key SDDocumentItem : String(6) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Special Stock Type'
    key InventorySpecialStockType : String(1) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'Stock Type'
    @sap.quickinfo : 'Stock Type of Goods Movement (Stock Identifier)'
    key InventoryStockType : String(2) not null;
    @sap.display.format : 'UpperCase'
    @sap.label : 'WBS Element'
    @sap.quickinfo : 'Work Breakdown Structure Element (WBS Element) Edited'
    WBSElementExternalID : String(24);
    @sap.label : 'Base Unit of Measure'
    @sap.semantics : 'unit-of-measure'
    MaterialBaseUnit : String(3);
    @sap.unit : 'MaterialBaseUnit'
    MatlWrhsStkQtyInMatlBaseUnit : Decimal(31, 14);
    to_MaterialSerialNumber : Association to many A_MaterialSerialNumber {  };
    to_MaterialStock : Association to A_MaterialStock {  };
  };
};


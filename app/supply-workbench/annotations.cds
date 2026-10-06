using SupplyPlanningService as service from '../../srv/supply-service';

/*
 * Supply Planning Workbench (blueprint §6.1, development plan phase 3).
 *
 * Pages: Cases list (the supply planner's worklist, HIGH first) → Case object
 * page with the supply picture, the agent's recommendation, the capacity
 * request and the Case Timeline. The actions sit in the object page header and
 * show only in the status that allows them; the orchestrator still checks
 * every call. Labels, texts, the case header and the timeline columns are
 * shared with the other case apps (srv/common-annotations.cds).
 *
 * Reject's reason is marked mandatory in webapp/annotations/annotation.xml,
 * not here: a server-side @mandatory would refuse an empty reason before the
 * orchestrator sees it, and the refusal would not be audited (rule 4).
 */

// === Cases ==========================================================================

annotate service.Cases with {
  customerName            @title: 'Customer Name';
  activeCrId              @title: 'Capacity Request'  @UI.HiddenFilter;
  dataSource              @title: 'Data Source'  @UI.HiddenFilter;
  recommendedOption       @title: 'Recommended Option ID'  @UI.HiddenFilter;
  recommendedOptionLabel  @title: 'Recommended Option'  @UI.HiddenFilter;
  recommendationRationale @title: 'Rationale'  @UI.MultiLineText  @UI.HiddenFilter;
  rationaleSource         @title: 'Text Source'  @UI.HiddenFilter;
  summarySource           @title: 'Summary Source'  @UI.HiddenFilter;
  productionCheckQuestion @title: 'Production Check Question'  @UI.MultiLineText  @UI.HiddenFilter;
  excessWarning           @title: 'Excess Inventory Warning'  @UI.HiddenFilter;
  penaltyCriticality      @UI.Hidden;
  dataSourceCriticality   @UI.Hidden;
  canConfirmFromStock       @UI.Hidden;
  canApproveStockTransfer   @UI.Hidden;
  canApproveReallocation    @UI.Hidden;
  canRequestProductionCheck @UI.Hidden;
  canReject                 @UI.Hidden;
  canConfirmDateToSales     @UI.Hidden;
};

annotate service.Cases with @(
  UI.SelectionFields                : [
    plant,
    lane_code,
    status_code,
    material,
    requestedDate,
    penaltyRisk,
  ],

  // High importance: the columns that stay when the table is narrow
  UI.LineItem                       : [
    {Value: caseId, ![@UI.Importance]: #High},
    {Value: salesOrder},
    {Value: item},
    {Value: customer_ID},
    {Value: material, ![@UI.Importance]: #High},
    {Value: quantity},
    {Value: requestedDate, ![@UI.Importance]: #High},
    {Value: lane_code, Criticality: lane.criticality, ![@UI.Importance]: #High},
    {Value: status_code, Criticality: status.criticality, ![@UI.Importance]: #High},
    {Value: waitingForRole},
    {Value: penaltyRisk, Criticality: penaltyCriticality, ![@UI.Importance]: #High},
  ],

  // HIGH before MEDIUM, then the earliest requested date (§2.2)
  UI.PresentationVariant            : {
    SortOrder     : [
      {Property: laneRank},
      {Property: requestedDate},
    ],
    Visualizations: ['@UI.LineItem'],
  },

  UI.HeaderFacets                   : [
    {$Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#lane'},
    {$Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#status'},
    {$Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#CaseHeader'},
    {$Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#SupplyHeader'},
  ],

  // the active CR, and where the supply data came from (mock or s4, §4.3)
  UI.FieldGroup #SupplyHeader       : {Data: [
    {Value: activeCrId},
    {Value: dataSource, Criticality: dataSourceCriticality},
  ]},

  UI.FieldGroup #Order              : {Data: [
    {Value: salesOrder},
    {Value: item},
    {Value: customer_ID},
    {Value: material},
    {Value: plant},
    {Value: quantity},
    {Value: deliveryPriority},
    {Value: penaltyRule},
    {Value: penaltyAmount},
    {Value: summary},
    {Value: summarySource},
  ]},

  UI.FieldGroup #Recommendation     : {Data: [
    {Value: recommendedOptionLabel},
    {Value: excessWarning},
    {Value: productionCheckQuestion},
    {Value: recommendationRationale},
    {Value: rationaleSource},
  ]},

  UI.Facets                         : [
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Order',
      Label : 'Order',
      Target: '@UI.FieldGroup#Order',
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'SupplyPicture',
      Label : 'Supply Picture',
      Target: 'supplyTree/@UI.LineItem',
    },
    {
      $Type : 'UI.CollectionFacet',
      ID    : 'Recommendation',
      Label : 'Recommendation',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'SuggestedByAgent',
          Label : 'Suggested by agent',
          Target: '@UI.FieldGroup#Recommendation',
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'SupplyOptions',
          Label : 'Options',
          Target: 'supplyOptions/@UI.LineItem',
        },
      ],
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'CapacityRequest',
      Label : 'Capacity Request',
      Target: 'capacityRequests/@UI.LineItem',
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'CaseTimeline',
      Label : 'Case Timeline',
      Target: 'timeline/@UI.LineItem',
    },
  ],

  // Object page header actions, each shown only in the status that allows it
  UI.Identification                 : [
    {
      $Type             : 'UI.DataFieldForAction',
      Action            : 'SupplyPlanningService.confirmFromStock',
      Label             : 'Confirm from Stock',
      ![@UI.Hidden]     : {$edmJson: {$Not: {$Path: 'canConfirmFromStock'}}},
    },
    {
      $Type             : 'UI.DataFieldForAction',
      Action            : 'SupplyPlanningService.approveStockTransfer',
      Label             : 'Approve Stock Transfer',
      ![@UI.Hidden]     : {$edmJson: {$Not: {$Path: 'canApproveStockTransfer'}}},
    },
    {
      $Type             : 'UI.DataFieldForAction',
      Action            : 'SupplyPlanningService.approveReallocation',
      Label             : 'Approve Reallocation',
      ![@UI.Hidden]     : {$edmJson: {$Not: {$Path: 'canApproveReallocation'}}},
    },
    {
      $Type             : 'UI.DataFieldForAction',
      Action            : 'SupplyPlanningService.requestProductionCheck',
      Label             : 'Request Production Check',
      ![@UI.Hidden]     : {$edmJson: {$Not: {$Path: 'canRequestProductionCheck'}}},
    },
    {
      $Type             : 'UI.DataFieldForAction',
      Action            : 'SupplyPlanningService.confirmDateToSales',
      Label             : 'Confirm Date to Sales',
      ![@UI.Hidden]     : {$edmJson: {$Not: {$Path: 'canConfirmDateToSales'}}},
    },
    {
      $Type             : 'UI.DataFieldForAction',
      Action            : 'SupplyPlanningService.reject',
      Label             : 'Reject',
      Criticality       : #Negative,
      ![@UI.Hidden]     : {$edmJson: {$Not: {$Path: 'canReject'}}},
    },
  ],
);

// After an action: the case comes back as the action's result; the status
// text and the lists on the object page are read again.
annotate service.Cases actions {
  confirmFromStock       @Core.OperationAvailable: {$edmJson: {$Path: 'in/canConfirmFromStock'}}
                         @Common.SideEffects: {TargetEntities: ['in/status', 'in/timeline', 'in/supplyOptions', 'in/capacityRequests']}
                         (comment @title: 'Comment'  @UI.MultiLineText);
  approveStockTransfer   @Core.OperationAvailable: {$edmJson: {$Path: 'in/canApproveStockTransfer'}}
                         @Common.SideEffects: {TargetEntities: ['in/status', 'in/timeline', 'in/supplyOptions', 'in/capacityRequests']}
                         (comment @title: 'Comment'  @UI.MultiLineText);
  approveReallocation    @Core.OperationAvailable: {$edmJson: {$Path: 'in/canApproveReallocation'}}
                         @Common.SideEffects: {TargetEntities: ['in/status', 'in/timeline', 'in/supplyOptions', 'in/capacityRequests']}
                         (comment @title: 'Comment'  @UI.MultiLineText);
  requestProductionCheck @Core.OperationAvailable: {$edmJson: {$Path: 'in/canRequestProductionCheck'}}
                         @Common.SideEffects: {TargetEntities: ['in/status', 'in/timeline', 'in/supplyOptions', 'in/capacityRequests']}
                         (comment @title: 'Question to Production'  @UI.MultiLineText);
  reject                 @Core.OperationAvailable: {$edmJson: {$Path: 'in/canReject'}}
                         @Common.SideEffects: {TargetEntities: ['in/status', 'in/timeline', 'in/supplyOptions', 'in/capacityRequests']}
                         (reason @title: 'Reason'  @UI.MultiLineText);
  confirmDateToSales     @Core.OperationAvailable: {$edmJson: {$Path: 'in/canConfirmDateToSales'}}
                         @Common.SideEffects: {TargetEntities: ['in/status', 'in/timeline', 'in/supplyOptions', 'in/capacityRequests']}
                         (comment @title: 'Comment'  @UI.MultiLineText);
};

// === Supply picture: the material tree, one row per node ===========================

annotate service.SupplyTreeNodes with {
  caseId               @UI.Hidden;
  nodeNo               @UI.Hidden;
  level                @title: 'Level';
  material             @title: 'Material ID';
  materialTree         @title: 'Material';
  parent               @title: 'Parent';
  requiredQty          @title: 'Required'  @Measures.Unit: unit;
  availableQty         @title: 'Available'  @Measures.Unit: unit;
  shortfallQty         @title: 'Shortfall'  @Measures.Unit: unit;
  shortfallCriticality @UI.Hidden;
  unit                 @title: 'Unit';
  stockOtherPlants     @title: 'Stock in Other Plants'  @Measures.Unit: unit;
  otherPlants          @title: 'Other Plants';
  openReceiptsQty      @title: 'Open Receipts'  @Measures.Unit: unit;
  openReceipts         @title: 'Open Receipts';
  slowMoving           @title: 'Slow-Moving';
  excess               @title: 'Excess';
  excessInfo           @title: 'Slow-Moving / Excess';
};

annotate service.SupplyTreeNodes with @(UI.LineItem: [
  {Value: materialTree},
  {Value: requiredQty},
  {Value: availableQty},
  {Value: shortfallQty, Criticality: shortfallCriticality},
  {Value: otherPlants},
  {Value: openReceipts},
  {Value: excessInfo},
]);

// === Recommendation: the ranked options (§7 A3 ladder) ==============================

annotate service.SupplyOptions with {
  caseId        @UI.Hidden;
  optionId      @title: 'Option ID';
  rank          @title: 'Rank';
  label         @title: 'Option';
  feasible      @title: 'Possible';
  reason        @title: 'Why Not';
  recommended   @title: 'Recommended';
  criticality   @UI.Hidden;
  confirmedDate @title: 'Confirmed Date';
  confirmedQty  @title: 'Confirmed Quantity';
};

annotate service.SupplyOptions with @(UI.LineItem: [
  {Value: rank},
  {Value: label, Criticality: criticality},
  {Value: feasible},
  {Value: reason},
  {Value: recommended},
  {Value: confirmedDate},
]);

// === Capacity requests of the case ==================================================

annotate service.CapacityRequests with @(UI.LineItem: [
  {Value: crId},
  {Value: status_code, Criticality: status.criticality},
  {Value: needByDate},
  {Value: quantity},
  {Value: chosenOption},
  {Value: overrideUsed},
  {Value: decidedBy},
  {Value: decidedAt},
  {Value: reason},
]);

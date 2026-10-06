using ProductionService as service from '../../srv/production-service';

/*
 * Production Capacity Workbench (blueprint §6.1, development plan 4).
 *
 * Pages: Capacity Requests list (the production planner's worklist, HIGH
 * first, then by need-by date) → Capacity Request object page with the scored
 * options, the load before / after (custom section, the only chart in the
 * demo: webapp/ext/fragment/LoadChart.fragment.xml), the impact on other
 * orders, the agent's comparison and the parent case's Case Timeline. The
 * header is the shared case header (srv/common-annotations.cds, through
 * parentCase) plus the CR's status and need-by date. The actions sit in the
 * object page header and show only when the case and the CR allow them; the
 * orchestrator still checks every call.
 *
 * The reasons and the option are marked mandatory in
 * webapp/annotations/annotation.xml, not here: a server-side @mandatory would
 * refuse an empty value before the orchestrator sees it, and the refusal would
 * not be audited (rule 4).
 */

// === Capacity requests ===============================================================

annotate service.CapacityRequests with {
  crId                   @title: 'Capacity Request';
  caseId                 @title: 'Case';
  caseStatus             @title: 'Case Status'  @UI.HiddenFilter;
  waitingForRole         @title: 'Waiting For';
  salesOrder             @title: 'Sales Order';
  item                   @title: 'Item';
  customerName           @title: 'Customer';
  material               @title: 'Material';
  plant                  @title: 'Plant';
  quantity               @Measures.Unit: quantityUnit;
  quantityUnit           @title: 'Unit';
  requestedDate          @title: 'Requested Date';
  lane                   @title: 'Lane'  @Common.Text: laneName  @Common.TextArrangement: #TextOnly
                         @Common.ValueListWithFixedValues
                         @Common.ValueList: {
                           CollectionPath: 'Lanes',
                           Parameters    : [
                             {$Type: 'Common.ValueListParameterInOut', LocalDataProperty: lane, ValueListProperty: 'code'},
                             {$Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name'},
                           ],
                         };
  laneName               @title: 'Lane'  @UI.Hidden;
  laneRank               @UI.Hidden;
  penaltyRisk            @title: 'Penalty Risk';
  caseVersion            @UI.Hidden;
  parentCase             @title: 'Case'  @UI.Hidden;
  recommendedOption      @title: 'Recommended Option'  @UI.HiddenFilter;
  recommendedOptionLabel @title: 'Suggested by Agent'  @UI.HiddenFilter;
  overrideOption         @UI.Hidden;
  comparison             @title: 'Comparison (Lower Score Is Better)'  @UI.MultiLineText  @UI.HiddenFilter;
  comparisonSource       @title: 'Text Source'  @UI.HiddenFilter;
  frozenHorizon          @title: 'Frozen Horizon'  @UI.HiddenFilter;
  canChooseOption         @UI.Hidden;
  canChooseOverrideOption @UI.Hidden;
  canRejectProduction     @UI.Hidden;
};

annotate service.CapacityRequests with @(
  UI.SelectionFields                : [
    lane,
    status_code,
    material,
    needByDate,
    caseId,
  ],

  // all High: the lane and status columns are estimated wide, and the table
  // would move the other columns into the pop-in
  UI.LineItem                       : [
    {Value: crId, ![@UI.Importance]: #High},
    {Value: caseId, ![@UI.Importance]: #High},
    {Value: material, ![@UI.Importance]: #High},
    {Value: quantity, ![@UI.Importance]: #High},
    {Value: needByDate, ![@UI.Importance]: #High},
    {Value: lane, Criticality: laneRank, ![@UI.Importance]: #High},
    {Value: status_code, Criticality: status.criticality, ![@UI.Importance]: #High},
    {Value: recommendedOption, ![@UI.Importance]: #High},
  ],

  // HIGH before MEDIUM (lane rank = lane criticality), then the earliest need-by date
  UI.PresentationVariant            : {
    SortOrder     : [
      {Property: laneRank},
      {Property: needByDate},
    ],
    Visualizations: ['@UI.LineItem'],
  },

  UI.HeaderInfo                     : {
    TypeName      : 'Capacity Request',
    TypeNamePlural: 'Capacity Requests',
    Title         : {Value: crId},
    Description   : {Value: caseId},
  },

  UI.DataPoint #crStatus            : {
    Value      : status_code,
    Title      : 'Request Status',
    Criticality: status.criticality,
  },

  UI.FieldGroup #RequestHeader      : {Data: [
    {Value: needByDate},
    {Value: salesOrder},
    {Value: item},
  ]},

  // the shared case header of the parent case, then the CR's own status and need-by date
  UI.HeaderFacets                   : [
    {$Type: 'UI.ReferenceFacet', Target: 'parentCase/@UI.DataPoint#lane'},
    {$Type: 'UI.ReferenceFacet', Target: 'parentCase/@UI.DataPoint#status'},
    {$Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#crStatus'},
    {$Type: 'UI.ReferenceFacet', Target: 'parentCase/@UI.FieldGroup#CaseHeader'},
    {$Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#RequestHeader'},
  ],

  UI.FieldGroup #Comparison         : {Data: [
    {Value: recommendedOptionLabel},
    {Value: comparison},
    {Value: comparisonSource},
  ]},

  UI.FieldGroup #Decision           : {Data: [
    {Value: chosenOption},
    {Value: overrideUsed},
    {Value: decidedBy},
    {Value: decidedAt},
    {Value: reason},
  ]},

  // The Load Before / After section is a custom section after Options (manifest.json)
  UI.Facets                         : [
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Options',
      Label : 'Options',
      Target: 'capacityOptions/@UI.LineItem',
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Impact',
      Label : 'Impact on Other Orders',
      Target: 'movedOrders/@UI.LineItem',
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Comparison',
      Label : 'Comparison',
      Target: '@UI.FieldGroup#Comparison',
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Decision',
      Label : 'Decision',
      Target: '@UI.FieldGroup#Decision',
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'CaseTimeline',
      Label : 'Case Timeline',
      Target: 'timeline/@UI.LineItem',
    },
  ],

  // Object page header actions, each shown only when the case and the CR allow it
  UI.Identification                 : [
    {
      $Type        : 'UI.DataFieldForAction',
      Action       : 'ProductionService.chooseOption',
      Label        : 'Choose Option',
      ![@UI.Hidden]: {$edmJson: {$Not: {$Path: 'canChooseOption'}}},
    },
    {
      $Type        : 'UI.DataFieldForAction',
      Action       : 'ProductionService.chooseOverrideOption',
      Label        : 'Choose Override Option',
      ![@UI.Hidden]: {$edmJson: {$Not: {$Path: 'canChooseOverrideOption'}}},
    },
    {
      $Type        : 'UI.DataFieldForAction',
      Action       : 'ProductionService.rejectProduction',
      Label        : 'Reject',
      Criticality  : #Negative,
      ![@UI.Hidden]: {$edmJson: {$Not: {$Path: 'canRejectProduction'}}},
    },
  ],
);

// The option to choose: the options of the open capacity requests, with
// score and override flag. Choose Option starts on the recommended option,
// Choose Override Option on the best option that needs an override. After an
// action the CR comes back as the result; the CR status text, the parent case
// (the header) and the lists on the object page are read again.
annotate service.CapacityRequests actions {
  chooseOption         @Core.OperationAvailable: {$edmJson: {$Path: 'in/canChooseOption'}}
                       @Common.SideEffects: {TargetEntities: ['in/status', 'in/parentCase', 'in/timeline', 'in/capacityOptions', 'in/movedOrders']}
                       (optionId @title: 'Option'
                                 @UI.ParameterDefaultValue: {$edmJson: {$Path: 'in/recommendedOption'}}
                                 @Common.ValueList: {
                                   CollectionPath: 'CapacityOptions',
                                   Parameters    : [
                                     {$Type: 'Common.ValueListParameterInOut', LocalDataProperty: optionId, ValueListProperty: 'optionId'},
                                     {$Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'crId'},
                                     {$Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'label'},
                                     {$Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'score'},
                                     {$Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'needsOverride'},
                                     {$Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'suggestion'},
                                   ],
                                 },
                        comment  @title: 'Comment'  @UI.MultiLineText);
  chooseOverrideOption @Core.OperationAvailable: {$edmJson: {$Path: 'in/canChooseOverrideOption'}}
                       @Common.SideEffects: {TargetEntities: ['in/status', 'in/parentCase', 'in/timeline', 'in/capacityOptions', 'in/movedOrders']}
                       (optionId @title: 'Option'
                                 @UI.ParameterDefaultValue: {$edmJson: {$Path: 'in/overrideOption'}}
                                 @Common.ValueList: {
                                   CollectionPath: 'CapacityOptions',
                                   Parameters    : [
                                     {$Type: 'Common.ValueListParameterInOut', LocalDataProperty: optionId, ValueListProperty: 'optionId'},
                                     {$Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'crId'},
                                     {$Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'label'},
                                     {$Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'score'},
                                     {$Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'needsOverride'},
                                   ],
                                 },
                        reason   @title: 'Reason for the Override'  @UI.MultiLineText);
  rejectProduction     @Core.OperationAvailable: {$edmJson: {$Path: 'in/canRejectProduction'}}
                       @Common.SideEffects: {TargetEntities: ['in/status', 'in/parentCase', 'in/timeline', 'in/capacityOptions', 'in/movedOrders']}
                       (reason @title: 'Reason'  @UI.MultiLineText);
};

// === Options: scored by the Production Capacity Balancing agent (§7 A4) ==============

annotate service.CapacityOptions with {
  crId                    @title: 'Capacity Request';
  optionId                @title: 'Option ID';
  rank                    @title: 'Rank';
  label                   @title: 'Option';
  productionVersion       @title: 'Production Version';
  feasible                @title: 'Feasible';
  infeasibleReason        @title: 'Why Not Feasible';
  feasibility             @title: 'Feasible';
  feasibilityCriticality  @UI.Hidden;
  score                   @title: 'Score';
  needsOverride           @title: 'Override';
  finishDate              @title: 'Finish Date';
  movedOrders             @title: 'Moved Orders';
  peakUtilization         @title: 'Peak Utilization (%)';
  frozenHorizonViolations @title: 'Frozen-Horizon Changes';
  recommended             @title: 'Recommended';
  suggestion              @title: 'Agent';
  suggestionCriticality   @UI.Hidden;
  criticality             @UI.Hidden;
};

// The recommended row is highlighted (row criticality: green recommended,
// orange needs override, red not feasible) and says "Suggested by agent"
annotate service.CapacityOptions with @(
  UI.LineItem                 : [
    {Value: optionId, ![@UI.Importance]: #High},
    {Value: suggestion, Criticality: suggestionCriticality, ![@UI.Importance]: #High},
    {Value: label, ![@UI.Importance]: #High},
    {Value: feasibility, Criticality: feasibilityCriticality, ![@UI.Importance]: #High},
    {Value: score, ![@UI.Importance]: #High},
    {Value: needsOverride, ![@UI.Importance]: #High},
    {Value: finishDate, ![@UI.Importance]: #High},
    {Value: movedOrders, ![@UI.Importance]: #High},
  ],
  UI.LineItem.@UI.Criticality : criticality,
);

// === Impact on other orders ==========================================================

annotate service.MovedOrders with {
  crId                @UI.Hidden;
  optionId            @title: 'Option ID';
  order               @title: 'Production Order';
  salesOrder          @title: 'Sales Order';
  workCenter          @title: 'Work Center';
  qty                 @title: 'Quantity';
  fromDate            @title: 'Old Date';
  toDate              @title: 'New Date';
  dueDate             @title: 'Due Date';
  daysLate            @title: 'Days Late';
  insideFrozenHorizon @title: 'Inside Frozen Horizon';
  onTime              @title: 'Still on Time';
  criticality         @UI.Hidden;
};

annotate service.MovedOrders with @(UI.LineItem: [
  {Value: optionId},
  {Value: salesOrder},
  {Value: order},
  {Value: workCenter},
  {Value: qty},
  {Value: fromDate},
  {Value: toDate},
  {Value: dueDate},
  {Value: onTime, Criticality: criticality},
  {Value: daysLate},
  {Value: insideFrozenHorizon},
]);

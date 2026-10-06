using SalesService as service from '../../srv/sales-service';

/*
 * Sales Order Feasibility (blueprint §6.1, development plan phase 5).
 *
 * Pages: Cases list (Sales' order items, grouped by sales order, AUTO_CONFIRMED
 * ones included) → Case object page with the intake summary and penalty, the
 * agent's latest recommendation, the customer confirmation (custom section:
 * the Communication agent's draft in an editable text area,
 * webapp/ext/fragment/CustomerConfirmation.fragment.xml) and the Case
 * Timeline. Labels, texts, the case header and the timeline columns are shared
 * with the other case apps (srv/common-annotations.cds).
 *
 * Confirm to customer is a custom header action (webapp/ext/controller/CaseActions.ts):
 * it sends the edited draft as the action's customerDraft parameter. It is
 * offered on every open case, so that the orchestrator's refusal before
 * SUPPLY_CONFIRMED can be shown (scenario 5); the refusal is in the timeline.
 */

// === Cases ==========================================================================

annotate service.Cases with {
  customer                @Common.ValueList: {
                            CollectionPath: 'Customers',
                            Parameters    : [
                              {$Type: 'Common.ValueListParameterInOut', LocalDataProperty: customer_ID, ValueListProperty: 'ID'},
                              {$Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name'},
                            ],
                          };
  customerName            @title: 'Customer Name';
  recommendationAgent     @title: 'Agent'  @UI.HiddenFilter;
  recommendationKind      @title: 'Kind'  @UI.HiddenFilter;
  recommendedOptionLabel  @title: 'Recommended'  @UI.HiddenFilter;
  recommendationRationale @title: 'Explanation'  @UI.MultiLineText  @UI.HiddenFilter;
  rationaleSource         @title: 'Text Source'  @UI.HiddenFilter;
  summarySource           @title: 'Summary Source'  @UI.HiddenFilter;
  draftSource             @title: 'Draft Source'  @UI.HiddenFilter;
  recommendationAt        @title: 'Suggested At'  @UI.HiddenFilter;
  draftKind               @title: 'Draft'  @UI.HiddenFilter;
  penaltyCriticality      @UI.Hidden;
  canConfirmToCustomer    @UI.Hidden;
  canClose                @UI.Hidden;
  offerConfirmToCustomer  @UI.Hidden;
  canCheckFeasibility     @UI.Hidden;
};

annotate service.Customers with {
  ID   @title: 'Customer';
  name @title: 'Name';
};

annotate service.Cases with @(
  UI.SelectionFields                : [
    salesOrder,
    customer_ID,
    lane_code,
    status_code,
    penaltyRisk,
    requestedDate,
  ],

  // High importance: the columns that stay when the table is narrow
  UI.LineItem                       : [
    {Value: salesOrder, ![@UI.Importance]: #High},
    {Value: item, ![@UI.Importance]: #High},
    {Value: caseId},
    {Value: customer_ID, ![@UI.Importance]: #High},
    {Value: material},
    {Value: quantity},
    {Value: requestedDate, ![@UI.Importance]: #High},
    {Value: lane_code, Criticality: lane.criticality, ![@UI.Importance]: #High},
    {Value: status_code, Criticality: status.criticality, ![@UI.Importance]: #High},
    {Value: waitingForRole},
    {Value: penaltyRisk, Criticality: penaltyCriticality},
    {Value: confirmedDate, ![@UI.Importance]: #High},
  ],

  // the items of one order together (§7 A2: one case per item, grouped by order)
  UI.PresentationVariant            : {
    SortOrder     : [
      {Property: salesOrder},
      {Property: item},
    ],
    GroupBy       : [salesOrder],
    Visualizations: ['@UI.LineItem'],
  },

  UI.HeaderFacets                   : [
    {$Type: 'UI.ReferenceFacet', ID: 'Lane', Target: '@UI.DataPoint#lane'},
    {$Type: 'UI.ReferenceFacet', ID: 'Status', Target: '@UI.DataPoint#status'},
    {$Type: 'UI.ReferenceFacet', ID: 'CaseHeader', Target: '@UI.FieldGroup#CaseHeader'},
  ],

  UI.FieldGroup #Summary            : {Data: [
    {Value: summary},
    {Value: summarySource},
    {Value: salesOrder},
    {Value: item},
    {Value: plant},
    {Value: deliveryPriority},
    {Value: penaltyRisk, Criticality: penaltyCriticality},
    {Value: penaltyRule},
    {Value: penaltyAmount},
  ]},

  UI.FieldGroup #Recommendation     : {Data: [
    {Value: recommendedOptionLabel},
    {Value: recommendationKind},
    {Value: recommendationAgent},
    {Value: recommendationAt},
    {Value: recommendationRationale},
    {Value: rationaleSource},
  ]},

  // The Customer Confirmation section is a custom section after Recommendation (manifest.json)
  UI.Facets                         : [
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Summary',
      Label : 'Summary',
      Target: '@UI.FieldGroup#Summary',
    },
    {
      $Type : 'UI.CollectionFacet',
      ID    : 'Recommendation',
      Label : 'Recommendation',
      Facets: [{
        $Type : 'UI.ReferenceFacet',
        ID    : 'SuggestedByAgent',
        Label : 'Suggested by agent',
        Target: '@UI.FieldGroup#Recommendation',
      }],
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
      $Type        : 'UI.DataFieldForAction',
      Action       : 'SalesService.checkFeasibility',
      Label        : 'Check Feasibility',
      ![@UI.Hidden]: {$edmJson: {$Not: {$Path: 'canCheckFeasibility'}}},
    },
    {
      $Type        : 'UI.DataFieldForAction',
      Action       : 'SalesService.close',
      Label        : 'Close',
      ![@UI.Hidden]: {$edmJson: {$Not: {$Path: 'canClose'}}},
    },
  ],
);

// After an action: the case comes back as the action's result; the status
// and lane texts and the timeline are read again.
annotate service.Cases actions {
  checkFeasibility  @Core.OperationAvailable: {$edmJson: {$Path: 'in/canCheckFeasibility'}}
                    @Common.SideEffects: {TargetEntities: ['in/lane', 'in/status', 'in/timeline']};
  confirmToCustomer @Common.SideEffects: {TargetEntities: ['in/status', 'in/timeline']}
                    (customerDraft @title: 'Customer Message'  @UI.MultiLineText,
                     comment       @title: 'Comment'  @UI.MultiLineText);
  close             @Core.OperationAvailable: {$edmJson: {$Path: 'in/canClose'}}
                    @Common.SideEffects: {TargetEntities: ['in/status', 'in/timeline']}
                    (comment @title: 'How the Customer Was Informed'  @UI.MultiLineText);
};

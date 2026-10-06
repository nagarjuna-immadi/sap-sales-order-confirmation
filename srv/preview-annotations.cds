using {order.conf as db} from '../db/schema';
using {SupplyPlanningService} from './supply-service';
using {ProductionService} from './production-service';
using {SalesService} from './sales-service';

/*
 * Just enough UI for the Fiori preview on the CAP index page (development plan
 * 1.4): lists, object pages, the Case Timeline and the action buttons, so
 * scenario 1 can be walked by hand. The case apps of phases 3–5 bring their
 * own annotations (srv/common-annotations.cds, app/<app>/annotations.cds); this
 * file goes away then.
 */

// --- Shared, on the domain model (all services inherit them) -----------------

annotate db.OrderFeasibilityCase with @(
  UI.HeaderInfo         : {
    TypeName      : 'Case',
    TypeNamePlural: 'Cases',
    Title         : {Value: caseId},
    Description   : {Value: salesOrder},
  },
  UI.LineItem           : [
    {Value: caseId, Label: 'Case'},
    {Value: salesOrder, Label: 'Sales Order'},
    {Value: item, Label: 'Item'},
    {Value: customer_ID, Label: 'Customer'},
    {Value: material, Label: 'Material'},
    {Value: quantity, Label: 'Quantity'},
    {Value: requestedDate, Label: 'Requested'},
    {Value: lane_code, Label: 'Lane', Criticality: lane.criticality},
    {Value: status_code, Label: 'Status', Criticality: status.criticality},
    {Value: waitingForRole, Label: 'Waiting For'},
  ],
  UI.FieldGroup #Case   : {Data: [
    {Value: caseId, Label: 'Case'},
    {Value: salesOrder, Label: 'Sales Order'},
    {Value: item, Label: 'Item'},
    {Value: customer_ID, Label: 'Customer'},
    {Value: material, Label: 'Material'},
    {Value: plant, Label: 'Plant'},
    {Value: quantity, Label: 'Quantity'},
    {Value: requestedDate, Label: 'Requested'},
    {Value: deliveryPriority, Label: 'Delivery Priority'},
    {Value: lane_code, Label: 'Lane', Criticality: lane.criticality},
    {Value: status_code, Label: 'Status', Criticality: status.criticality},
    {Value: waitingForRole, Label: 'Waiting For'},
    {Value: confirmedDate, Label: 'Confirmed Date'},
    {Value: confirmedQty, Label: 'Confirmed Qty'},
    {Value: version, Label: 'Version'},
  ]},
  UI.Facets             : [
    {$Type: 'UI.ReferenceFacet', Label: 'Case', Target: '@UI.FieldGroup#Case'},
    {$Type: 'UI.ReferenceFacet', Label: 'Capacity Requests', Target: 'capacityRequests/@UI.LineItem'},
    {$Type: 'UI.ReferenceFacet', Label: 'Recommendations', Target: 'recommendations/@UI.LineItem'},
    {$Type: 'UI.ReferenceFacet', Label: 'Case Timeline', Target: 'timeline/@UI.LineItem'},
  ],
);

annotate db.CapacityRequest with @(UI.LineItem: [
  {Value: crId, Label: 'Request'},
  {Value: status_code, Label: 'Status', Criticality: status.criticality},
  {Value: needByDate, Label: 'Need By'},
  {Value: quantity, Label: 'Quantity'},
  {Value: chosenOption, Label: 'Chosen Option'},
  {Value: overrideUsed, Label: 'Override'},
  {Value: decidedBy, Label: 'Decided By'},
  {Value: decidedAt, Label: 'Decided At'},
  {Value: reason, Label: 'Reason'},
]);

annotate db.Recommendation with @(UI.LineItem: [
  {Value: agent, Label: 'Agent'},
  {Value: kind_code, Label: 'Kind'},
  {Value: recommendedOption, Label: 'Recommended'},
  {Value: rationale, Label: 'Rationale'},
  {Value: llmUsed, Label: 'LLM'},
  {Value: accepted, Label: 'Accepted'},
  {Value: createdAt, Label: 'Created'},
]);

annotate db.CaseTimeline with @(UI.LineItem: [
  {Value: at, Label: 'At'},
  {Value: step, Label: 'Step'},
  {Value: action, Label: 'Action'},
  {Value: actor, Label: 'Actor'},
  {Value: role, Label: 'Role'},
  {Value: fromStatus, Label: 'From'},
  {Value: toStatus, Label: 'To'},
  {Value: outcome, Label: 'Outcome'},
  {Value: refusalCode, Label: 'Refusal'},
  {Value: comment, Label: 'Comment'},
  {Value: reason, Label: 'Reason'},
  {Value: durationText, Label: 'Since Previous Step'},
]);

// --- Actions per service ------------------------------------------------------

annotate SupplyPlanningService.Cases with @(UI.Identification: [
  {$Type: 'UI.DataFieldForAction', Action: 'SupplyPlanningService.confirmFromStock', Label: 'Confirm from Stock'},
  {$Type: 'UI.DataFieldForAction', Action: 'SupplyPlanningService.approveStockTransfer', Label: 'Approve Stock Transfer'},
  {$Type: 'UI.DataFieldForAction', Action: 'SupplyPlanningService.approveReallocation', Label: 'Approve Reallocation'},
  {$Type: 'UI.DataFieldForAction', Action: 'SupplyPlanningService.requestProductionCheck', Label: 'Request Production Check'},
  {$Type: 'UI.DataFieldForAction', Action: 'SupplyPlanningService.reject', Label: 'Reject'},
  {$Type: 'UI.DataFieldForAction', Action: 'SupplyPlanningService.confirmDateToSales', Label: 'Confirm Date to Sales'},
]);

annotate SalesService.Cases with @(UI.Identification: [
  {$Type: 'UI.DataFieldForAction', Action: 'SalesService.confirmToCustomer', Label: 'Confirm to Customer'},
  {$Type: 'UI.DataFieldForAction', Action: 'SalesService.close', Label: 'Close'},
]);

annotate ProductionService.CapacityRequests with @(
  UI.HeaderInfo         : {
    TypeName      : 'Capacity Request',
    TypeNamePlural: 'Capacity Requests',
    Title         : {Value: crId},
    Description   : {Value: caseId},
  },
  UI.LineItem           : [
    {Value: crId, Label: 'Request'},
    {Value: caseId, Label: 'Case'},
    {Value: salesOrder, Label: 'Sales Order'},
    {Value: material, Label: 'Material'},
    {Value: quantity, Label: 'Quantity'},
    {Value: requestedDate, Label: 'Requested'},
    {Value: lane, Label: 'Lane'},
    {Value: status_code, Label: 'Status', Criticality: status.criticality},
    {Value: caseStatus, Label: 'Case Status'},
  ],
  UI.FieldGroup #Request: {Data: [
    {Value: crId, Label: 'Request'},
    {Value: status_code, Label: 'Status', Criticality: status.criticality},
    {Value: needByDate, Label: 'Need By'},
    {Value: quantity, Label: 'Quantity'},
    {Value: options, Label: 'Options (JSON)'},
    {Value: chosenOption, Label: 'Chosen Option'},
    {Value: overrideUsed, Label: 'Override'},
    {Value: decidedBy, Label: 'Decided By'},
    {Value: reason, Label: 'Reason'},
  ]},
  UI.FieldGroup #Case   : {Data: [
    {Value: caseId, Label: 'Case'},
    {Value: caseStatus, Label: 'Case Status'},
    {Value: salesOrder, Label: 'Sales Order'},
    {Value: item, Label: 'Item'},
    {Value: customerName, Label: 'Customer'},
    {Value: material, Label: 'Material'},
    {Value: plant, Label: 'Plant'},
    {Value: requestedDate, Label: 'Requested'},
    {Value: lane, Label: 'Lane'},
    {Value: penaltyRisk, Label: 'Penalty Risk'},
    {Value: caseVersion, Label: 'Case Version'},
  ]},
  UI.Facets             : [
    {$Type: 'UI.ReferenceFacet', Label: 'Request', Target: '@UI.FieldGroup#Request'},
    {$Type: 'UI.ReferenceFacet', Label: 'Case', Target: '@UI.FieldGroup#Case'},
    {$Type: 'UI.ReferenceFacet', Label: 'Case Timeline', Target: 'timeline/@UI.LineItem'},
  ],
  UI.Identification     : [
    {$Type: 'UI.DataFieldForAction', Action: 'ProductionService.chooseOption', Label: 'Choose Option'},
    {$Type: 'UI.DataFieldForAction', Action: 'ProductionService.chooseOverrideOption', Label: 'Override Frozen Horizon'},
    {$Type: 'UI.DataFieldForAction', Action: 'ProductionService.rejectProduction', Label: 'Reject'},
  ],
);

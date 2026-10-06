using {order.conf as db} from '../db/schema';
using {SalesService} from './sales-service';

/*
 * Just enough UI for the Fiori preview on the CAP index page (development plan
 * 1.4): lists, object pages and the action buttons, so scenario 1 can be walked
 * by hand. The case apps of phases 3–5 bring their own annotations
 * (srv/common-annotations.cds, app/<app>/annotations.cds): the Supply Planning
 * Workbench has its own since phase 3, the Production Capacity Workbench since
 * phase 4, and this file goes away after phase 5.
 */

// --- Shared, on the domain model (all services inherit them) -----------------

annotate db.OrderFeasibilityCase with @(
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

// --- Actions per service ------------------------------------------------------

annotate SalesService.Cases with @(UI.Identification: [
  {$Type: 'UI.DataFieldForAction', Action: 'SalesService.confirmToCustomer', Label: 'Confirm to Customer'},
  {$Type: 'UI.DataFieldForAction', Action: 'SalesService.close', Label: 'Close'},
]);

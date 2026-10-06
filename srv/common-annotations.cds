using {order.conf as db} from '../db/schema';

/*
 * Labels, texts and value helps shared by the three case apps (blueprint
 * §6.1, development plan 3), plus the shared case header and Case Timeline.
 * Each app adds its own list, facets and actions in app/<app>/annotations.cds.
 *
 * The code lists are sap.common.CodeList, which carries @cds.odata.valuelist:
 * CAP already generates a Common.ValueList for every association to one.
 * Added here: the names as texts, dropdowns, and the criticality of lane and
 * status (the code lists' criticality column: 1 red, 2 yellow, 3 green).
 */

// --- Code lists: show the name, pick from a dropdown -------------------------------

annotate db.Lanes with {
  code @Common.Text: name  @title: 'Lane';
};

annotate db.CaseStatus with {
  code @Common.Text: name  @title: 'Status';
};

annotate db.CapacityRequestStatus with {
  code @Common.Text: name  @title: 'Request Status';
};

annotate db.RecommendationKinds with {
  code @Common.Text: name  @title: 'Kind';
};

// --- Order Feasibility Case --------------------------------------------------------

annotate db.OrderFeasibilityCase with {
  caseId           @title: 'Case';
  salesOrder       @title: 'Sales Order';
  item             @title: 'Item';
  customer         @title: 'Customer'  @Common.Text: customer.name  @Common.TextArrangement: #TextFirst;
  material         @title: 'Material';
  plant            @title: 'Plant';
  quantity         @title: 'Quantity'  @Measures.Unit: quantityUnit;
  quantityUnit     @title: 'Unit';
  requestedDate    @title: 'Requested Date';
  deliveryPriority @title: 'Delivery Priority';
  lane             @title: 'Lane'  @Common.Text: lane.name  @Common.TextArrangement: #TextOnly
                   @Common.ValueListWithFixedValues;
  laneRank         @title: 'Lane Rank'  @UI.Hidden;
  penaltyRisk      @title: 'Penalty Risk';
  penaltyAmount    @title: 'Penalty per Day'  @Measures.ISOCurrency: currency;
  currency         @title: 'Currency';
  penaltyRule      @title: 'Penalty Rule';
  status           @title: 'Status'  @Common.Text: status.name  @Common.TextArrangement: #TextOnly
                   @Common.ValueListWithFixedValues;
  waitingForRole   @title: 'Waiting For';
  summary          @title: 'Summary'  @UI.MultiLineText;
  atpResult        @UI.Hidden;
  confirmedDate    @title: 'Confirmed Date';
  confirmedQty     @title: 'Confirmed Quantity'  @Measures.Unit: quantityUnit;
  customerDraft    @title: 'Customer Draft'  @UI.MultiLineText;
  version          @title: 'Version'  @UI.Hidden;
};

// The case header all three apps show: lane and status as colored data
// points, then who has to act and the dates.
annotate db.OrderFeasibilityCase with @(
  UI.HeaderInfo            : {
    TypeName      : 'Case',
    TypeNamePlural: 'Cases',
    Title         : {Value: caseId},
    Description   : {Value: salesOrder},
  },
  UI.DataPoint #lane       : {
    Value      : lane_code,
    Title      : 'Lane',
    Criticality: lane.criticality,
  },
  UI.DataPoint #status     : {
    Value      : status_code,
    Title      : 'Status',
    Criticality: status.criticality,
  },
  UI.FieldGroup #CaseHeader: {Data: [
    {Value: customer_ID},
    {Value: material},
    {Value: quantity},
    {Value: waitingForRole},
    {Value: penaltyRisk},
    {Value: requestedDate},
    {Value: confirmedDate},
  ]},
);

// --- Capacity request, recommendation -----------------------------------------------

annotate db.CapacityRequest with {
  crId         @title: 'Capacity Request';
  status       @title: 'Request Status'  @Common.Text: status.name  @Common.TextArrangement: #TextOnly;
  needByDate   @title: 'Need By';
  quantity     @title: 'Quantity';
  options      @UI.Hidden;
  chosenOption @title: 'Chosen Option';
  overrideUsed @title: 'Frozen-Horizon Override';
  decidedBy    @title: 'Decided By';
  decidedAt    @title: 'Decided At';
  reason       @title: 'Reason';
};

annotate db.Recommendation with {
  kind @Common.Text: kind.name  @Common.TextArrangement: #TextOnly;
};

// --- Case Timeline (§7 A1): every action, refused ones included ---------------------

annotate db.CaseTimeline with {
  at           @title: 'At';
  step         @title: 'Step';
  action       @title: 'Action';
  actor        @title: 'Actor';
  role         @title: 'Role';
  fromStatus   @title: 'From';
  toStatus     @title: 'To';
  outcome      @title: 'Outcome';
  refusalCode  @title: 'Refusal';
  comment      @title: 'Comment';
  reason       @title: 'Reason';
  durationText @title: 'Since Previous Step';
  stepNo       @UI.Hidden;
  previousAt   @UI.Hidden;
  payload      @UI.Hidden;
};

annotate db.CaseTimeline with @(UI.LineItem: [
  {Value: at},
  {Value: step},
  {Value: action},
  {Value: actor},
  {Value: role},
  {Value: fromStatus},
  {Value: toStatus},
  {Value: outcome},
  {Value: refusalCode},
  {Value: comment},
  {Value: reason},
  {Value: durationText},
]);

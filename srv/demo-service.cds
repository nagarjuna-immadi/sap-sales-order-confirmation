using {cap.agent} from '@cap-js/agents/srv/entities';

/**
 * Demo helpers (development plan 2.4). Demo only, never part of the case
 * apps: simulated S/4 sales order events that call Sales Order Intake, a
 * delivery priority change, the scenario 4 switch and a reset. Event Mesh is
 * not on trial, so the events are posted here in the S/4 format (CloudEvents
 * 1.0, Hub event object Sales Order Events 1.0.0, phase 0.1). From phase 6
 * also the agents' Claude runs (AgentTasks), to check them by hand.
 */
@path    : '/odata/v4/demo'
@requires: 'authenticated-user'
service DemoService {

  /** The data part of SalesOrder.Created.v1 / Changed.v1 (all strings, as in the spec). */
  type SalesOrderEventData {
    SalesOrder           : String(10);
    SalesOrderType       : String(4);
    SalesOrganization    : String(4);
    DistributionChannel  : String(2);
    OrganizationDivision : String(2);
    SoldToParty          : String(10);
    EventRaisedDateTime  : String(30);
  }

  /** CloudEvents 1.0 envelope; id, specversion, source and type are required. */
  type S4Event {
    id              : String(64);
    specversion     : String(5);
    source          : String(255);
    type            : String(80);
    subject         : String(255);
    time            : String(30);
    datacontenttype : String(40);
    data            : SalesOrderEventData;
  }

  /** What Sales Order Intake did with one item. */
  type IntakeResult {
    caseId      : String(10);
    salesOrder  : String(10);
    item        : String(6);
    created     : Boolean;
    lane        : String(10);
    status      : String(25);
    laneChanged : Boolean;
  }

  /** For the Demo panel of the Sales Order Feasibility app (plan 5). */
  type DemoStatus {
    visible  : Boolean; // the user may walk the whole demo: all three case roles (demo_user)
    scenario : String(30);
  }

  type ResetResult {
    scenario : String(30);
    cases    : Integer;
  }

  /**
   * A sales order event in the S/4 format: sap.s4.beh.salesorder.v1.SalesOrder.Created.v1
   * or .Changed.v1. The payload carries no items, quantities or priority, so
   * Sales Order Intake reads the order through the sales order adapter. Items
   * with a case are re-evaluated (no status change), the others get a case.
   */
  action simulateS4Event(payload : S4Event)                                                   returns many IntakeResult;

  /** Shortcut: a Created event for a demo order (SO-5005, SO-5006, SO-5007). */
  action simulateNewOrder(salesOrder : String(10))                                            returns many IntakeResult;

  /**
   * Changes the delivery priority of an item in the S/4 mock, then posts a
   * Changed event. Refused when the sales order service is a real S/4 system.
   */
  action simulatePriorityChange(salesOrder : String(10), item : String(6), deliveryPriority : String(2)) returns many IntakeResult;

  /**
   * 'default' or 'sc4-assy02-down' (§8.3 scenario 4: WC-ASSY-02 has no
   * capacity). Set it before the production check is requested. Returns the
   * active scenario.
   */
  action setScenario(scenario : String(30))                                                    returns String;

  /** Whether the Demo panel is shown to this user, and the active scenario. */
  function demoStatus()                                                                      returns DemoStatus;

  /** Reseeds the database (cases, audit, mocks), scenario 'default', IDs from FC-0001 / CR-0001. */
  action resetDemo()                                                                          returns ResetResult;

  /**
   * The Claude runs of the agents (development plan 6.3): one row per run in
   * the plugin's cap.agent.Tasks, with state, tokens and tool calls.
   * Recommendation.agentTaskId points here. Read-only and without the task
   * payload; the plugin deletes rows after cds.agents.retention (30 days).
   */
  @readonly
  entity AgentTasks as
    projection on agent.Tasks {
      taskId,
      agentService,
      state,
      usageLlmTokens,
      usageToolCalls,
      createdAt,
      modifiedAt,
    };
}

/**
 * Demo helpers (development plan 1.4 and 2.4). Demo only, never part of the
 * case apps. Phase 1 has one action to open a case by hand; phase 2 adds the
 * simulated S/4 events (simulateS4Event, simulateNewOrder) that call Sales
 * Order Intake instead.
 */
@path    : '/odata/v4/demo'
@requires: 'authenticated-user'
service DemoService {

  type OpenedCase {
    caseId  : String(10);
    created : Boolean;
    lane    : String(10);
    status  : String(25);
  }

  /**
   * Runs Sales Order Intake for a sales order item from the S/4 mock (e.g.
   * SO-5005 / 10): lane, penalty, ATP, then auto-confirm or Supply Planning.
   * The same item again re-evaluates the existing case (no status change).
   */
  action openCase(salesOrder : String(10), item : String(6)) returns OpenedCase;
}

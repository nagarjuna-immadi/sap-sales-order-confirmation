// Supply & Inventory agent service (A3; blueprint §5.1, §5.2, development plan 6.2).
//
// Internal CAP agent: supply-inventory.js calls it with srv.chat after it has
// stored the supply picture and the ranked options with a template text.
// Claude explains the ranking and drafts the question to Production or the
// message to Sales; it never chooses or reorders an option. @requires
// internal-user (the A2A endpoint answers 403), read-only functions, no
// actions; persona in AGENTS.md next to this file. No customer data and no
// prices in any result. The result types are shared with the Order Assistant
// (srv/lib/case-snapshots.cds).

using { order.conf.snapshots } from '../../lib/case-snapshots';

/**
 * Supply check of the Sales-to-Planning order confirmation process. Each Order
 * Feasibility Case (ID FC-nnnn) is one sales order item; the supply check has
 * looked at stock, open receipts and production for it and ranked the ways to
 * supply it. The function returns that picture with the ranked options.
 */
@path    : 'supply-inventory-agent'
@requires: 'internal-user'
@agent
@agent.connect: 'none'
service SupplyInventoryAgentService {

  /**
   * The supply picture of a case with the ranked options and the recommended
   * one, as the supply check stored it last.
   */
  function getSupplyPicture(
    /** Order Feasibility Case ID, e.g. FC-0001. */
    caseId : String(10) @mandatory
  ) returns snapshots.SupplyPicture;
}

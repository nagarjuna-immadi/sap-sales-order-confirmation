// Production Capacity Balancing agent service (A4; blueprint §5.1, §5.2, development plan 6.2).
//
// Internal CAP agent: production-capacity-balancing.js calls it with srv.chat
// after it has stored the scored options of a capacity request with a
// template comparison. Claude compares the top options and drafts the
// planner's comment; scores and the recommended option are inputs, never
// outputs. @requires internal-user (the A2A endpoint answers 403), read-only
// functions, no actions; persona in AGENTS.md next to this file. No customer
// data and no prices in any result. The result types are shared with the Order Assistant
// (srv/lib/case-snapshots.cds).

using { order.conf.snapshots } from '../../lib/case-snapshots';

/**
 * Production check of the Sales-to-Planning order confirmation process. A
 * capacity request (ID CR-nnnn) asks the production planner whether a quantity
 * of a material can be produced by a need-by date for an Order Feasibility
 * Case (FC-nnnn). The function returns the simulated and scored options for it.
 */
@path    : 'production-capacity-balancing-agent'
@requires: 'internal-user'
@agent
@agent.connect: 'none'
service ProductionCapacityBalancingAgentService {

  /**
   * The simulated and scored options of a capacity request, with the
   * recommended one, as the capacity check stored them.
   */
  function getCapacityOptions(
    /** Capacity request ID, e.g. CR-0001. */
    crId : String(10) @mandatory
  ) returns snapshots.CapacityOptions;
}

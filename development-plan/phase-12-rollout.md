# Phase 12 · Rollout

**Goal.** Production use: all lanes and plants, controlled write-back to S/4HANA after human approval, and more notification channels.

**Duration.** Open; planned after the pilot review.

**Depends on.** Phase 11 go decision.

**Blueprint.** §3.3, §4.3 (write-back rule), §7 A3/A4/A5 guardrails (connected phase), §9 phase 3.

This phase is a high-level outline. Detail it after the pilot.

---

## 1. Scope extensions

| Item | Detail |
|---|---|
| All lanes | MEDIUM and NORMAL lanes live, including NORMAL auto-confirmation and exceptions. |
| All plants | Plant attribute per user; multi-plant stock transfer proposals. |
| Frozen horizon per plant | From `PlanningParameters`, maintained by the business. |

## 2. Controlled write-back

Only after a human approval in Fiori, executed by an approved, auditable API call or by the planner in S/4. S/4HANA stays the system of record and the **standard ATP check re-confirms the order** (§4.3).

| Approved decision | S/4 effect | Notes |
|---|---|---|
| Approve stock transfer (A3) | STO request / proposal | Planner posts or an approved API call creates it; result linked on the case. |
| Approve reallocation (A3) | Re-confirmation through standard ATP / V_V2 rescheduling | No direct schedule line edits. |
| Choose capacity option (A4) | Planned order changes via approved API, or a task for *Manage Production Orders* / *Capacity Scheduling Board* | Frozen-horizon overrides keep the mandatory reason. |
| Confirm to customer (Sales) | Customer output from S/4 or the agreed channel | The agent still never sends; Sales does. |

Each write call: idempotent, logged in the audit log with the S/4 document number, failure visible on the case.

## 3. Channels

- A5 notifications to email, Microsoft Teams, My Inbox / SAP Task Center (§7 A5).
- Optional Joule front end on the same read-only CAP tools (§5.3); the Order Assistant can stay or be retired.

## 4. Later options (not committed)

- Advanced ATP (Backorder Processing, Product Allocation) and embedded PP/DS could move parts of A3/A4 logic into S/4; the tool layer switches engines without changing the case flow (§3.3).

## 5. Rules that still hold

- Agents recommend; humans approve every write.
- Numbers from tools; audit row with every action; reasons for reject and override.
- Four apps; no analytical apps or dashboards unless the scope is formally changed in the blueprint.

## Exit criteria

- [ ] Production use across lanes and plants (§9 phase 3 outcome).
- [ ] Write-back paths approved by S/4 owners and audited.

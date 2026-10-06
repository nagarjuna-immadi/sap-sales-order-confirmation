---
name: supply-explanation
description: How to explain the recommended supply option and which message to draft (production check question or message to Sales) for each recommended option. Read it before calling emit_data_part.
---

# Supply explanation

## The ladder

The options are tried in rank order and the first feasible one is recommended:

| Rank | Option | Means |
| --- | --- | --- |
| 1 | `S-LOCAL` | Stock and open receipts in the delivering plant cover the order. |
| 2 | `S-TRANSFER` | Stock transfer from other plants (excess stock first). |
| 3 | `S-REALLOCATE` | Take supply from a lower-priority order that still meets its own date. |
| 4 | `S-PRODUCE` | Ask Production whether the quantity can be produced in time. |
| 5 | `S-REJECT` | Reject, with the earliest possible date. |
| 0 | `S-CONFIRM-DATE` | Production has confirmed an option: confirm the resulting date to Sales. |

## Explanation

Two to four sentences in English for the supply planner:

- Name the recommended option and why it ranks first: which higher-ranked options are not feasible and why, using their `reason`.
- Mention the facts that matter for the decision: shortfall in the plant, components available or missing (`materialTree`), stock in other plants, a leftover above the excess threshold (`excessWarning`).
- Do not say what the planner should do beyond the recommended option, and do not judge the ranking.

## Message

Depends on the recommended option:

| Recommended | message |
| --- | --- |
| `S-PRODUCE` | The production check question to the production planner: can {produceQty} × {material} be produced in plant {plant} by {needByDate}? Add which components are available and that no stock was found elsewhere, if the facts say so. |
| `S-CONFIRM-DATE` | Message to Sales: {confirmedQty} × {material} can be confirmed for {confirmedDate}, with the capacity request and chosen production option. |
| `S-REJECT` | Message to Sales: the order cannot be delivered by {requestedDate}; the earliest possible date is {earliestDate} (or none in the planning window), and the reason. |
| `S-LOCAL`, `S-TRANSFER`, `S-REALLOCATE` | Message to Sales: {confirmedQty} × {material} can be confirmed for {confirmedDate}, and from where. |

Address the message to its reader directly, in one paragraph, without a greeting or signature.

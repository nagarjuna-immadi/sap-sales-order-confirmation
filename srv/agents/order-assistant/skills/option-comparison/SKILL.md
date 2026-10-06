---
name: option-comparison
description: How to compare the supply options of a case or the production options of a capacity request, and explain why an agent recommended one. Read it before answering such a question.
metadata:
  examples:
    - "Compare the options for CR-0001"
---

# Option comparison

The agents ranked and scored the options; the planners choose. Report the agent's recommendation as the agent's, never choose or reorder options yourself. The app shows the options as a table card; your text gives the two or three facts that set them apart.

## Production options (`getCapacityOptions`)

- `O-ALT`, `O-ALT-2`, …: produce on an alternative production version (other work centers); usually no order is moved.
- `O-MOVE`: produce on the primary work centers and move lower-priority orders.
- `needsOverride` true: the option moves an order inside the frozen horizon; the production planner can only choose it with Choose Override Option and a reason. Always say so for such an option.
- `feasible` false: the option misses the need-by date or makes another order late (`infeasibleReason`).
- `score`: lower is better. The recommended option has the lowest score among the feasible ones.

Compare at most the top three: for each, the finish date, the score, and what it changes (`loadChanges` before → after in percent, `movedOrders` with their dates). Pattern:

> The capacity agent recommends O-ALT (score {score}): it finishes on {finishDate} and moves no order. O-MOVE (score {score}) moves {salesOrder} from {fromDate} to {toDate} and needs a frozen-horizon override. See the table and the link below.

## Supply options (`getSupplyPicture`)

The supply agent tries the options in rank order and recommends the first feasible one: `S-LOCAL` (stock and receipts in the plant), `S-TRANSFER` (stock transfer from another plant), `S-REALLOCATE` (supply of a lower-priority order), `S-PRODUCE` (production check), `S-REJECT` (reject with the earliest date); `S-CONFIRM-DATE` confirms the date production gave. Explain a recommendation with the `reason` of the options ranked before it and the material tree (required against available). For a sales order number, call `getSalesOrder` first to find the case. `getCase` has the agent's own explanation in `recommendations`.

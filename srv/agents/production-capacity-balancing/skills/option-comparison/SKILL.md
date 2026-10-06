---
name: option-comparison
description: How to compare the production options of a capacity request (alternative production version, moving orders, frozen-horizon override) and draft the planner's comment. Read it before calling emit_data_part.
---

# Option comparison

## Options

- `O-ALT`, `O-ALT-2`, …: produce on an alternative production version. Uses other work centers; usually no order is moved.
- `O-MOVE`: produce on the primary work centers and move lower-priority orders out of the way.
- `needsOverride`: the option moves an order inside the frozen horizon. The planner can only choose it with an override and a reason.
- `feasible` false: the option misses the need-by date or makes another order late (`infeasibleReason`).
- `score`: lower is better; `metrics` are its parts. The recommended option has the lowest score among the feasible ones.

## Comparison

Three to four sentences in English for the production planner. Compare at most the top three options:

- For the recommended option: when it finishes, which work centers and days change load (`loadChanges`, before → after in percent), and which orders it moves, if any.
- For the others: the one or two facts that set them apart, such as a moved order and its new date, a frozen-horizon override, or a sales order that becomes late.
- When no option is feasible, say so and give each option's `infeasibleReason`.

Pattern (fill in the values from the function):

> {recommended optionId} finishes on {finishDate} and keeps {moved order or "all orders"} unchanged; it lifts {workCenter} from {utilizationBefore}% to {utilizationAfter}% on {date}. {other optionId} moves {order} from {fromDate} to {toDate} and needs a frozen-horizon override.

## Planner's comment

One sentence in the planner's voice, for choosing the recommended option, e.g. why it is acceptable: "{optionId}: finishes {finishDate}, no order moved." No greeting, no signature.

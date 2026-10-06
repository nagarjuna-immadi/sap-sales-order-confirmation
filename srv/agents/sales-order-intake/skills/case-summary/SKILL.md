---
name: case-summary
description: How to write the case summary for the supply planner and how to read the penalty rule (rate, unit, basis) from a contract clause. Read it before calling emit_data_part.
---

# Case summary and penalty rule

## Summary

Exactly three sentences in English, for a supply planner who has a few seconds per case. The first one starts with the customer name:

1. Who needs what by when: customer name, quantity with unit, material with its description, requested date, lane.
2. What the availability check found in the delivering plant: confirmed in full, or how much is available and from when.
3. The penalty clause in a few words, or "No penalty clause found."

Pattern (fill in the values from the functions):

> {customerName} needs {quantity} {quantityUnit} of {material} ({materialDescription}) by {requestedDate}, {lane} lane. Plant {plant} has {availableQty} of {requestedQty} available[ from {availableDate}]. Penalty clause: {the clause in a few words}.

Rules:

- Name the customer as `customerName` gives it.
- Use the material number, plant, sales order and case ID as given. Write no amount of money: the system calculates the penalty amount.
- Do not recommend an action and do not judge whether the date can be met.

## Penalty rule

Read the rule from `clauseText` only.

- `rate`: the number written in the clause, as a number (`2%` → `2`). It must appear in the clause exactly; never compute or guess it.
- `unit`: `DAY` for "per day", `WEEK` for "per week", otherwise `OTHER`.
- `basis`: `ORDER_VALUE` when the rate is a share of the order value, otherwise `OTHER`.
- `null` when `found` is false or the clause has no rate.

---
name: case-status
description: How to answer questions about the status of a case, what it is waiting for, lists of cases such as "my HIGH cases" or "penalty risk this week", and requests to act on a case. Read it before answering such a question.
metadata:
  examples:
    - "What's blocking FC-0001?"
    - "Show my HIGH cases waiting for me"
    - "Which cases have penalty risk this week?"
---

# Case status

## The flow

| Status | Waiting for | Next, in the case app |
|---|---|---|
| `NEW` | nobody (the intake agent routes it) | |
| `AUTO_CONFIRMED` | nobody: confirmed from stock without a human step (final) | |
| `WITH_SUPPLY_PLANNING` | Supply Chain Planning | Confirm from Stock, Approve Stock Transfer, Approve Reallocation, Request Production Check or Reject, in the Supply Planning Workbench |
| `WITH_PRODUCTION` | Production Planning, on the open capacity request | Choose Option, Choose Override Option (frozen horizon, needs a reason) or Reject, in the Production Capacity Workbench |
| `PRODUCTION_CONFIRMED` | Supply Chain Planning | Confirm Date to Sales or Reject |
| `PRODUCTION_REJECTED` | Supply Chain Planning | Request Production Check again or Reject |
| `SUPPLY_CONFIRMED` | Sales | Confirm to Customer, in Sales Order Feasibility |
| `REJECTED` | Sales | Close |
| `CONFIRMED_TO_CUSTOMER`, `CLOSED` | nobody (final) | |

Confirm to Customer is only possible in `SUPPLY_CONFIRMED`. Only the team the case is waiting for can act on it. `getCase` gives the actions the current status allows in `nextActions`.

## What is blocking a case

Call `getCase`. Say who the case is waiting for and since when (`waitingSince` as HH:MM UTC), and what they have to decide. For `WITH_PRODUCTION`, name the open capacity request, its `optionCount` and the option the capacity agent recommends. Pattern (fill in from the tool):

> {caseId} is waiting for {waitingFor} on {crId} since {HH:MM} UTC: {optionCount} options are ready and the capacity agent recommends {recommendedOption}. See the case card and the link below.

## Lists of cases

Use `query` on `Cases`; the app shows the cases as a table card.

- "My cases" or "waiting for me": call `getMyContext` first; the case waits for the user when `waitingForRole` is one of the user's `roles`.
- Lane: `lane = 'HIGH'` (or MEDIUM, NORMAL).
- "Penalty risk this week": call `getMyContext`; cases with `penaltyRisk = true`, `requestedDate` between `weekStart` and `weekEnd`, and a status that is not final (not AUTO_CONFIRMED, CONFIRMED_TO_CUSTOMER or CLOSED).
- Answer with the number of cases from `count` and one bullet per case (ID, lane, status, requested date). If there are none, say so.

## Requests to act

You can't act. Call `getCase`, then answer in two or three sentences: you can't do that here; the current status and who the case is waiting for; the button and app from `nextActions`, or that the status does not allow the action yet (e.g. Confirm to Customer before `SUPPLY_CONFIRMED`). Pattern:

> I can't confirm cases here. FC-0001 is With Production (WITH_PRODUCTION) and waiting for Production Planning; Confirm to Customer is possible once the case is SUPPLY_CONFIRMED. See the link below.
